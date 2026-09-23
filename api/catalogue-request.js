// POST /api/catalogue-request
// Formulaire « Request catalogue » : enregistre la demande (statut new),
// prévient FutureMotion (CONTACT_EMAIL) avec le(s) fichier(s) à envoyer,
// puis adresse un court accusé de réception au demandeur.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CONSENT_TEXT, composeAcknowledgement, composeInternalEmail, parseRequest } from './_lib/catalogue-request.js';
import { hashIp, isRateLimited, markEmailSent, saveRequest } from './_lib/db.js';
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
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip');
  const ipHash = hashIp(ip);
  if (await isRateLimited({ ipHash, email: d.email })) return json({ error: 'rate_limited' }, 429);

  // L'enregistrement fait foi : une demande enregistrée est une demande reçue,
  // que l'email parte ou non. Elle est traitée depuis le back-office (/admin).
  const saved = await saveRequest(d, { ipHash, consentText: CONSENT_TEXT });

  // Les emails sont un confort en plus : leur échec ne doit pas renvoyer une
  // erreur au visiteur (tant que le domaine d'envoi n'est pas vérifié, ils
  // échouent tous les deux, et les demandes s'affichent quand même dans /admin).
  if (contact) {
    const internal = composeInternalEmail(d);
    try {
      await sendEmail({ to: contact, subject: internal.subject, text: internal.text, replyTo: d.email });
      await markEmailSent(saved.id);
    } catch (err) {
      console.error('Email interne non envoyé (demande enregistrée, visible dans /admin) :', err);
    }
    const ack = composeAcknowledgement(d);
    try {
      await sendEmail({ to: d.email, subject: ack.subject, text: ack.text, replyTo: contact });
    } catch (err) {
      console.error('Accusé de réception non envoyé :', err);
    }
  } else {
    console.error('CONTACT_EMAIL manquant : demande enregistrée, aucun email envoyé');
  }
  return json({ ok: true });
}
