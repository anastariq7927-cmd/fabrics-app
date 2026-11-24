// Email service: the only place in the system that talks SMTP.
// Internal only — callers must send the shared INTERNAL_TOKEN.
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { createService, validate, asyncHandler, HttpError } from '@fabrics/shared';

const PORT = Number(process.env.EMAIL_PORT ?? 4003);
const { app, listen } = createService('email');

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : // Without SMTP credentials, emails are printed instead of sent so local dev still works.
    nodemailer.createTransport({ jsonTransport: true });

// Without SMTP the terminal is the inbox: print the email as an email (real line breaks, links on
// their own line) so links can be copied cleanly, instead of one escaped JSON line.
function logUnsent({ to, replyTo, subject, text }) {
  const rule = '─'.repeat(64);
  console.log(
    [
      '',
      rule,
      '[email] SMTP não configurado — email NÃO enviado (só registrado aqui)',
      `Para:     ${to}`,
      replyTo ? `Resp. a:  ${replyTo}` : null,
      `Assunto:  ${subject}`,
      rule,
      text,
      rule,
      '',
    ]
      .filter((line) => line !== null)
      .join('\n'),
  );
}

app.use('/send', (req, _res, next) => {
  if (req.headers['x-internal-token'] !== process.env.INTERNAL_TOKEN) {
    return next(new HttpError(401, 'Unauthorized'));
  }
  next();
});

const sendSchema = z.object({
  to: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(20000),
  html: z.string().max(50000).optional(),
});

app.post(
  '/send',
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const { to, replyTo, subject, text, html } = req.body;
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || 'FabriCS <no-reply@fabrics.local>',
      to: to || process.env.MAIL_TO || process.env.SMTP_USER,
      replyTo,
      subject,
      text,
      html,
    });
    if (!smtpConfigured) logUnsent({ to: to || process.env.MAIL_TO || '(equipe)', replyTo, subject, text });
    res.status(202).json({ id: info.messageId, delivered: smtpConfigured });
  }),
);

listen(PORT);
