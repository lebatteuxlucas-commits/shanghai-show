// Envoi d'emails via l'API HTTP de Resend (simple fetch, pas de SDK).
export async function sendEmail({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  // En local (hors Vercel) sans configuration : l'email est affiché dans le terminal.
  if ((!key || !from) && !process.env.VERCEL) {
    console.log(`[dev] email non envoyé (Resend non configuré)\nÀ : ${to}\nReply-To : ${replyTo || '—'}\nObjet : ${subject}\n\n${text}\n`);
    return;
  }
  if (!key || !from) throw new Error('RESEND_API_KEY ou FROM_EMAIL manquant');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
}
