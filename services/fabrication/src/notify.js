// Client/team emails for the fabrication workflow, sent through the email service over HTTP.
const EMAIL_URL = process.env.EMAIL_SERVICE_URL ?? 'http://localhost:4003';
const SITE_URL = (process.env.PUBLIC_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

export const trackingUrl = (req) => `${SITE_URL}/${req.locale}/fabrication/suivi/${req.tracking_token}`;

const COPY = {
  fr: {
    hello: (n) => `Bonjour ${n},`,
    track: 'Suivre votre demande',
    sign: "L'équipe FabriCS",
    submitted: (r) => [`[FabriCS] Demande ${r.reference} reçue`, 'Nous avons bien reçu votre demande. Un membre de l’équipe l’examine sous 24 h ouvrées.'],
    quoted: (r) => [`[FabriCS] Votre devis ${r.reference} est prêt`, `Votre devis est prêt : ${r.quote?.total?.toFixed(2)} €. Vous pouvez le consulter et le régler en ligne.`],
    needs_info: (r) => [`[FabriCS] Une précision sur ${r.reference}`, 'Nous avons besoin d’une précision avant de continuer :'],
    rejected: (r) => [`[FabriCS] Demande ${r.reference} non retenue`, 'Nous ne pouvons malheureusement pas réaliser cette demande :'],
    ready: (r) => [`[FabriCS] ${r.reference} est prête !`, 'Votre pièce est prête. Vous pouvez venir la récupérer au FabriCS.'],
  },
  en: {
    hello: (n) => `Hello ${n},`,
    track: 'Track your request',
    sign: 'The FabriCS team',
    submitted: (r) => [`[FabriCS] Request ${r.reference} received`, 'We have received your request. A team member will review it within one working day.'],
    quoted: (r) => [`[FabriCS] Your quote ${r.reference} is ready`, `Your quote is ready: €${r.quote?.total?.toFixed(2)}. You can review and pay it online.`],
    needs_info: (r) => [`[FabriCS] A question about ${r.reference}`, 'We need a clarification before going further:'],
    rejected: (r) => [`[FabriCS] Request ${r.reference} declined`, 'Unfortunately we cannot take on this request:'],
    ready: (r) => [`[FabriCS] ${r.reference} is ready!`, 'Your part is ready. You can pick it up at FabriCS.'],
  },
  pt: {
    hello: (n) => `Olá ${n},`,
    track: 'Acompanhar seu pedido',
    sign: 'Equipe FabriCS',
    submitted: (r) => [`[FabriCS] Pedido ${r.reference} recebido`, 'Recebemos seu pedido. Alguém da equipe vai analisá-lo em até 1 dia útil.'],
    quoted: (r) => [`[FabriCS] Seu orçamento ${r.reference} está pronto`, `Seu orçamento está pronto: € ${r.quote?.total?.toFixed(2)}. Você pode consultá-lo e pagá-lo online.`],
    needs_info: (r) => [`[FabriCS] Uma dúvida sobre ${r.reference}`, 'Precisamos de um esclarecimento antes de continuar:'],
    rejected: (r) => [`[FabriCS] Pedido ${r.reference} recusado`, 'Infelizmente não podemos realizar este pedido:'],
    ready: (r) => [`[FabriCS] ${r.reference} está pronto!`, 'Sua peça está pronta. Você pode retirá-la na FabriCS.'],
  },
};

async function send(body) {
  const res = await fetch(`${EMAIL_URL}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`email service answered ${res.status}`);
}

/** Emails the requester about a workflow step. Never throws: the state change already happened. */
export function notifyClient(kind, request, message) {
  const copy = COPY[request.locale] ?? COPY.fr;
  const [subject, intro] = copy[kind](request);
  const text = [copy.hello(request.name), '', intro, message ? `\n${message}\n` : '', `${copy.track}:`, trackingUrl(request), '', copy.sign]
    .filter((line) => line !== null)
    .join('\n');
  return send({ to: request.email, subject, text }).catch((err) =>
    console.error(`[fabrication] ${kind} email to client failed:`, err.message),
  );
}

export function notifyTeam(request) {
  const text = [
    `Référence : ${request.reference}`,
    `Service : ${request.service_key}`,
    `Demandeur : ${request.name} <${request.email}> (${request.tier})`,
    request.profile ? `Profil : ${request.profile}${request.profile_other ? ` — ${request.profile_other}` : ''}` : null,
    request.project_frame
      ? `Cadre : ${request.project_frame}${request.frame_other ? ` — ${request.frame_other}` : ''}${request.association_name ? ` (${request.association_name})` : ''}`
      : null,
    request.service_other ? `Besoin : ${request.service_other}` : null,
    request.organization ? `Structure : ${request.organization}` : null,
    request.file_name ? `Fichier : ${request.file_name}` : null,
    request.estimate_eur ? `Estimation : ${request.estimate_eur} €` : null,
    '',
    request.notes ?? '',
  ]
    .filter((l) => l !== null)
    .join('\n');
  return send({ replyTo: request.email, subject: `[FabriCS] Nouvelle demande ${request.reference}`, text }).catch((err) =>
    console.error('[fabrication] team email failed:', err.message),
  );
}
