// Stockage des demandes de catalogue (Neon Postgres, driver HTTP).
// Tout l'accès à la base est ici : changer de stockage ne touche que ce fichier.
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

let _sql = null;
function sql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant (intégration Neon non connectée ?)');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export const RATE_LIMIT = { perIp: 5, perEmail: 10, windowMinutes: 10, emailWindowMinutes: 60 };

// L'IP n'est pas stockée en clair : seulement un hachage, utilisé pour la
// limitation de débit (pseudonymisation, pas anonymisation).
export function hashIp(ip) {
  return ip ? createHash('sha256').update('fm-catalogue|' + ip).digest('hex').slice(0, 32) : null;
}

export async function isRateLimited({ ipHash, email }) {
  const [r] = await sql()`
    select
      count(*) filter (where ip_hash = ${ipHash}
                         and created_at > now() - make_interval(mins => ${RATE_LIMIT.windowMinutes}))::int as by_ip,
      count(*) filter (where email = ${email}
                         and created_at > now() - make_interval(mins => ${RATE_LIMIT.emailWindowMinutes}))::int as by_email
    from catalogue_requests
    where created_at > now() - make_interval(mins => ${Math.max(RATE_LIMIT.windowMinutes, RATE_LIMIT.emailWindowMinutes)})`;
  return (ipHash && r.by_ip >= RATE_LIMIT.perIp) || r.by_email >= RATE_LIMIT.perEmail;
}

// ── Back-office (/admin) ───────────────────────────────────────────────────
export async function listRequests({ status = 'new', limit = 200 } = {}) {
  return status === 'all'
    ? sql()`select * from catalogue_requests order by created_at desc limit ${limit}`
    : sql()`select * from catalogue_requests where status = ${status} order by created_at desc limit ${limit}`;
}

export async function countByStatus() {
  const rows = await sql()`select status, count(*)::int as n from catalogue_requests group by status`;
  return Object.fromEntries(rows.map(r => [r.status, r.n]));
}

// « traité le » est posé quand la demande quitte l'état « new ».
export async function setRequestStatus(id, status) {
  await sql()`
    update catalogue_requests
    set status = ${status},
        processed_at = ${status === 'new' ? null : new Date().toISOString()}
    where id = ${id}`;
}

export async function saveRequest(d, { ipHash, consentText }) {
  const [row] = await sql()`
    insert into catalogue_requests
      (email, company, name, message, supplier_id, supplier_name, hall, booth,
       files, session_context, consent_text, ip_hash)
    values
      (${d.email}, ${d.company}, ${d.name}, ${d.message}, ${d.supplierId}, ${d.supplierName},
       ${d.hall}, ${d.booth}, ${JSON.stringify(d.files)}::jsonb, ${JSON.stringify(d.session)}::jsonb,
       ${consentText}, ${ipHash})
    returning id, created_at`;
  return row;
}

// L'email interne est-il bien parti pour cette demande ?
export async function markEmailSent(id) {
  await sql()`update catalogue_requests set email_sent = true where id = ${id}`;
}
