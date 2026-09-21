// POST /api/catalogue-request
// Formulaire « Request catalogue » : enregistre la demande (statut new),
// prévient FutureMotion (CONTACT_EMAIL) avec le(s) fichier(s) à envoyer,
// puis adresse un court accusé de réception au demandeur.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CONSENT_TEXT, composeAcknowledgement, composeInternalEmail, parseRequest } from './_lib/catalogue-request.js';
import { hashIp, isRateLimited, saveRequest } from './_lib/db.js';
import { sendEmail } from './_lib/mailer.js';
import { suppliersById } from './_lib/raw-data.js';

let _freeEmailConfig = null;
function freeEmailConfig() {
  if (!_freeEmailConfig) {
    _freeEmailConfig = JSON.parse(readFileSync(path.join(process.cwd(), 'config/free-email-domains.json'), 'utf8'));
  }
  return _freeEmailConfig;
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Refuse les envois depuis un autre site (un POST fetch envoie toujours Origin).
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);

  const raw = await request.text();
  if (raw.length > 16000) return json({ error: 'too_large' }, 413);
  let body = null;
  try { body = JSON.parse(raw); } catch {}

  const parsed = parseRequest(body, { byId: suppliersById(), freeEmailConfig: freeEmailConfig() });
  if (parsed.spam) return json({ ok: true });
  if (parsed.error) return json({ error: parsed.error, fields: parsed.fields }, 400);
  const d = parsed.data;

  const contact = process.env.CONTACT_EMAIL;
  if (!contact) {
    console.error('CONTACT_EMAIL manquant');
    return json({ error: 'send_failed' }, 500);
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip');
  const ipHash = hashIp(ip);
  if (await isRateLimited({ ipHash, email: d.email })) return json({ error: 'rate_limited' }, 429);

  // Enregistrement d'abord : si l'envoi échoue, la demande n'est pas perdue.
  await saveRequest(d, { ipHash, consentText: CONSENT_TEXT });

  const internal = composeInternalEmail(d);
  try {
    await sendEmail({ to: contact, subject: internal.subject, text: internal.text, replyTo: d.email });
  } catch (err) {
    console.error('Email interne non envoyé (demande enregistrée) :', err);
    return json({ error: 'send_failed' }, 502);
  }

  // L'accusé de réception n'est pas bloquant : la demande est déjà transmise.
  const ack = composeAcknowledgement(d);
  try {
    await sendEmail({ to: d.email, subject: ack.subject, text: ack.text, replyTo: contact });
  } catch (err) {
    console.error('Accusé de réception non envoyé :', err);
  }
  return json({ ok: true });
}
