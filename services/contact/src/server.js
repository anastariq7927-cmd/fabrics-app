// Contact service: stores "Rejoindre" form submissions and asks the email service to notify the team.
import { z } from 'zod';
import { createService, validate, asyncHandler, supabaseService, LOCALES } from '@fabrics/shared';

const PORT = Number(process.env.CONTACT_PORT ?? 4002);
const EMAIL_URL = process.env.EMAIL_SERVICE_URL ?? 'http://localhost:4003';
const { app, listen } = createService('contact');

const INTENTIONS = ['construire', 'apprendre', 'transmettre', 'rayonner', 'autre'];

const messageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  intention: z.enum(INTENTIONS),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(LOCALES).default('fr'),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0).optional(),
});

async function notifyTeam(entry) {
  const response = await fetch(`${EMAIL_URL}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
    body: JSON.stringify({
      replyTo: entry.email,
      subject: `[FabriCS] Nouveau message — ${entry.intention} — ${entry.name}`,
      text: `Nom : ${entry.name}\nEmail : ${entry.email}\nIntention : ${entry.intention}\nLangue : ${entry.locale}\n\n${entry.message}`,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`email service answered ${response.status}`);
}

app.post(
  '/messages',
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const { website: _honeypot, ...entry } = req.body;
    const { data, error } = await supabaseService()
      .from('contact_messages')
      .insert(entry)
      .select('id, created_at')
      .single();
    if (error) throw error;

    // The message is already saved; a mail outage must not fail the visitor's request.
    notifyTeam(entry).catch((err) => console.error('[contact] email notification failed:', err.message));

    res.status(201).json(data);
  }),
);

listen(PORT);
