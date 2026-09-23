// Back-office des demandes de catalogue — servi sur /admin (rewrite vercel.json).
// Protégé par mot de passe (ADMIN_PASSWORD) via l'authentification HTTP Basic :
// le navigateur affiche sa propre fenêtre de connexion, rien à coder côté page.
//
// Les demandes sont enregistrées même quand l'email ne part pas (domaine
// d'envoi non vérifié) : cette page est donc la source de vérité.
import { createHash, timingSafeEqual } from 'node:crypto';
import { countByStatus, listRequests, setRequestStatus } from './_lib/db.js';

// En-tête HTTP : caractères ASCII uniquement (un tiret long y est refusé).
const REALM = 'FutureMotion catalogue requests';

// Comparaison à durée constante, sur des empreintes pour accepter toute longueur.
export function isAuthorized(authHeader, password) {
  if (!password) return false;
  const m = /^Basic (.+)$/.exec(authHeader || '');
  if (!m) return false;
  let decoded = '';
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return false; }
  const given = decoded.slice(decoded.indexOf(':') + 1);
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(password).digest();
  return timingSafeEqual(a, b);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const html = (body, status = 200) => new Response(body, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
});
const askPassword = () => new Response('Authentification requise', {
  status: 401,
  headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`, 'Cache-Control': 'no-store' },
});

const fileLabel = (f) => (f.category_folder ? f.category_folder + '/' : '') + f.filename;

// Lien « répondre » : l'email est pré-rempli, il ne reste qu'à joindre le PDF.
function replyLink(r) {
  const files = (r.files || []).map(fileLabel).join('\n');
  const subject = `Your catalogue request — ${r.supplier_name}`;
  const body = [
    `Hello${r.name ? ' ' + r.name : ''},`, '',
    `Please find attached the catalogue of ${r.supplier_name}${r.booth ? ` (${r.hall} · ${r.booth})` : ''}.`,
    '', 'Best regards,', 'FutureMotion', '',
    '--- fichier(s) à joindre ---', files,
  ].join('\n');
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function card(r) {
  const files = (r.files || []).map(f => `<li>${esc(fileLabel(f))}</li>`).join('') || '<li class="muted">aucun fichier</li>';
  const ctx = r.session_context || {};
  const viewed = (ctx.suppliers || []).map(s => esc(s.name)).join(' · ');
  const when = new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return `
  <article class="card status-${esc(r.status)}">
    <div class="head">
      <div>
        <div class="supplier">${esc(r.supplier_name)}</div>
        <div class="muted">${esc(r.hall || '')} ${esc(r.booth || '')} · ${esc(r.supplier_id)}</div>
      </div>
      <div class="when">${esc(when)}<span class="badge">${esc(r.status)}</span></div>
    </div>

    <div class="files"><strong>Fichier(s) à envoyer</strong><ul>${files}</ul></div>

    <div class="who">
      <div><strong>${esc(r.company)}</strong>${r.name ? ' · ' + esc(r.name) : ''}</div>
      <div><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></div>
      ${r.message ? `<div class="msg">${esc(r.message)}</div>` : ''}
      ${viewed ? `<div class="muted small">Fournisseurs consultés : ${viewed}</div>` : ''}
      ${(ctx.categories || []).length ? `<div class="muted small">Catégories filtrées : ${esc((ctx.categories || []).join(', '))}</div>` : ''}
    </div>

    <div class="actions">
      <a class="btn primary" href="${replyLink(r)}">Répondre avec le catalogue</a>
      <form method="post">
        <input type="hidden" name="id" value="${esc(r.id)}">
        ${r.status === 'new'
          ? '<button class="btn" name="status" value="sent">Marquer comme envoyé</button>'
          : '<button class="btn" name="status" value="new">Remettre à traiter</button>'}
        ${r.status !== 'closed' ? '<button class="btn" name="status" value="closed">Clore</button>' : ''}
      </form>
    </div>
  </article>`;
}

function page(rows, counts, status, emailReady) {
  const tab = (key, label) => `<a class="tab${status === key ? ' active' : ''}" href="/admin?status=${key}">${label} <b>${counts[key] ?? 0}</b></a>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Demandes de catalogue — FutureMotion</title>
<style>
  :root { --charcoal:#1F2A35; --dark:#2A3742; --mid:#5A6770; --bg:#F4F6F8; --white:#fff;
          --teal:#1FA876; --teal-dark:#16835B; --teal-light:#E4F5ED; --border:#E1E5E8;
          --mono:'SF Mono',Menlo,'Courier New',monospace; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--charcoal); font-size:15px; }
  header { background:var(--dark); color:#fff; padding:14px 20px; }
  header h1 { font-size:16px; font-weight:600; }
  .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .tab { color:rgba(255,255,255,.75); text-decoration:none; font-size:13px; padding:5px 10px; border-radius:4px; background:rgba(255,255,255,.08); }
  .tab.active { background:var(--teal); color:#fff; }
  .warn { background:#fff7e0; color:#8a6d00; padding:10px 20px; font-size:13px; }
  main { padding:16px; max-width:820px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
  .card { background:var(--white); border:1px solid var(--border); border-radius:8px; padding:14px 16px; }
  .card.status-sent { opacity:.75; }
  .card.status-closed { opacity:.55; }
  .head { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .supplier { font-weight:600; overflow-wrap:anywhere; }
  .when { font-family:var(--mono); font-size:11px; color:var(--mid); text-align:right; white-space:nowrap; }
  .badge { display:inline-block; margin-left:8px; background:var(--teal-light); color:var(--teal-dark); border-radius:3px; padding:1px 6px; }
  .muted { color:var(--mid); }
  .small { font-size:12px; }
  .files { background:var(--teal-light); border-radius:6px; padding:10px 12px; margin-bottom:10px; font-size:13px; }
  .files ul { margin:6px 0 0 18px; font-family:var(--mono); font-size:12px; overflow-wrap:anywhere; }
  .who { font-size:14px; line-height:1.5; margin-bottom:12px; overflow-wrap:anywhere; }
  .msg { background:var(--bg); border-left:3px solid var(--border); padding:8px 10px; margin:6px 0; white-space:pre-wrap; font-size:13px; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .actions form { display:flex; gap:8px; flex-wrap:wrap; }
  .btn { display:inline-block; background:var(--white); border:1px solid var(--border); border-radius:5px; padding:8px 12px;
         font:inherit; font-size:13px; font-weight:600; color:var(--dark); cursor:pointer; text-decoration:none; }
  .btn:hover { border-color:var(--teal); color:var(--teal-dark); }
  .btn.primary { background:var(--teal); border-color:var(--teal); color:#fff; }
  .empty { text-align:center; color:var(--mid); padding:40px 0; }
</style></head><body>
<header>
  <h1>Demandes de catalogue</h1>
  <div class="tabs">${tab('new', 'À traiter')}${tab('sent', 'Envoyées')}${tab('closed', 'Closes')}${tab('all', 'Toutes')}</div>
</header>
${emailReady ? '' : '<div class="warn">Envoi d’emails inactif : le domaine d’envoi n’est pas encore vérifié chez Resend. Les demandes arrivent ici, mais ni vous ni le demandeur ne recevez d’email. Répondez depuis cette page.</div>'}
<main>${rows.length ? rows.map(card).join('') : '<div class="empty">Aucune demande dans cette vue.</div>'}</main>
</body></html>`;
}

export async function GET(request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.ADMIN_PASSWORD)) return askPassword();
  const status = new URL(request.url).searchParams.get('status') || 'new';
  const [rows, counts] = await Promise.all([listRequests({ status }), countByStatus()]);
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
  const emailReady = !!(process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL && process.env.FROM_EMAIL);
  return html(page(rows, counts, status, emailReady));
}

export async function POST(request) {
  if (!isAuthorized(request.headers.get('authorization'), process.env.ADMIN_PASSWORD)) return askPassword();
  const form = new URLSearchParams(await request.text());
  const id = form.get('id');
  const status = form.get('status');
  if (id && ['new', 'sent', 'closed'].includes(status)) await setRequestStatus(id, status);
  // PRG : on renvoie sur la liste pour qu'un rafraîchissement ne rejoue pas l'action.
  return new Response(null, { status: 303, headers: { Location: '/admin', 'Cache-Control': 'no-store' } });
}
