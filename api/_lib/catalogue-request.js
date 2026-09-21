// Logique de la demande de catalogue, séparée du handler pour être testable
// sans réseau ni base : validation, contexte de session, contenu des emails.
import { supplierLabel } from './raw-data.js';

export const CONSENT_TEXT = 'I agree to be contacted by FutureMotion about this request and sourcing in China';
export const LIMITS = { email: 254, company: 150, name: 100, message: 2000 };
const MAX_SESSION_SUPPLIERS = 30;
const MAX_SESSION_CATEGORIES = 15;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Champ sur une ligne : aucun caractère de contrôle (évite toute injection d'en-tête).
function line(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
}
function multiline(v, max) {
  return typeof v === 'string'
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max)
    : '';
}

export function isFreeEmail(email, config) {
  const domain = email.slice(email.lastIndexOf('@') + 1);
  return (config.domains || []).includes(domain)
      || (config.prefixes || []).some(p => domain.startsWith(p));
}

// Contexte de session envoyé par le navigateur : on ne garde que des ids
// fournisseurs existants (noms résolus côté serveur) et des libellés courts.
export function sanitizeSession(ctx, byId) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const categories = [...new Set((Array.isArray(c.categories) ? c.categories : [])
    .map(x => line(x, 60)).filter(Boolean))].slice(0, MAX_SESSION_CATEGORIES);
  const suppliers = [...new Set((Array.isArray(c.suppliers) ? c.suppliers : [])
    .filter(id => typeof id === 'string' && byId.has(id)))].slice(-MAX_SESSION_SUPPLIERS)
    .map(id => ({ id, name: supplierLabel(byId.get(id)) }));
  return { categories, suppliers };
}

// Renvoie { spam } | { error, fields? } | { data } (data prêt à enregistrer).
export function parseRequest(body, { byId, freeEmailConfig }) {
  const b = body && typeof body === 'object' ? body : {};
  // Pot de miel rempli : on fait semblant d'accepter, sans rien enregistrer ni envoyer.
  if (line(b.website, 200)) return { spam: true };

  const email = line(b.email, LIMITS.email).toLowerCase();
  const company = line(b.company, LIMITS.company);
  const fields = [];
  if (!EMAIL_RE.test(email)) fields.push('email');
  if (!company) fields.push('company');
  if (b.consent !== true) fields.push('consent');
  const supplier = typeof b.supplierId === 'string' ? byId.get(b.supplierId) : null;
  if (!supplier || !Array.isArray(supplier.catalogues) || !supplier.catalogues.length) fields.push('supplierId');
  if (fields.length) return { error: 'invalid_fields', fields };
  if (isFreeEmail(email, freeEmailConfig)) return { error: 'free_email', fields: ['email'] };

  return {
    data: {
      email,
      company,
      name: line(b.name, LIMITS.name) || null,
      message: multiline(b.message, LIMITS.message) || null,
      supplierId: supplier.id,
      supplierName: supplierLabel(supplier),
      hall: (supplier.halls && supplier.halls.length ? supplier.halls.join(' + ') : supplier.hall) || '',
      booth: supplier.booth || '',
      files: supplier.catalogues.map(f => ({ filename: f.filename, category_folder: f.category_folder })),
      session: sanitizeSession(b.session, byId),
      supplier,
    },
  };
}

function fileLabel(f) {
  return (f.category_folder ? f.category_folder + '/' : '') + f.filename;
}

// Email interne envoyé à CONTACT_EMAIL.
export function composeInternalEmail(d, now = new Date()) {
  const where = [d.hall && `Hall ${d.hall}`, d.booth].filter(Boolean).join(' / ') || 'no booth';
  const subject = `[Catalogue request] ${d.supplierName} — ${where}`.slice(0, 240);
  const s = d.supplier;
  const text = [
    `Catalogue request received ${now.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    'CATALOGUE FILE(S)',
    ...d.files.map(f => `  ${fileLabel(f)}`),
    '',
    'SUPPLIER',
    `  ${d.supplierName}`,
    s.cn ? `  ${s.cn}` : null,
    `  ${where}`,
    `  Directory ID: ${d.supplierId}`,
    '',
    'REQUESTER',
    `  Email:   ${d.email}`,
    `  Company: ${d.company}`,
    `  Name:    ${d.name || '—'}`,
    '',
    'MESSAGE',
    d.message ? d.message.split('\n').map(l => '  ' + l).join('\n') : '  —',
    '',
    'SESSION CONTEXT',
    `  Categories filtered: ${d.session.categories.length ? d.session.categories.join(', ') : '—'}`,
    `  Suppliers viewed (${d.session.suppliers.length}):`,
    ...(d.session.suppliers.length ? d.session.suppliers.map(x => `    - ${x.name} [${x.id}]`) : ['    —']),
    '',
    'Consent given: "' + CONSENT_TEXT + '"',
    'Reply to this email to answer the requester directly.',
  ].filter(l => l !== null).join('\n');
  return { subject, text };
}

// Accusé de réception envoyé au demandeur (texte fixe : rien de saisi par
// l'utilisateur n'y figure, ce qui limite l'intérêt d'un détournement).
export function composeAcknowledgement(d) {
  return {
    subject: `Your catalogue request — ${d.supplierName}`.slice(0, 240),
    text: `Thanks — we've received your request for the ${d.supplierName} catalogue. ` +
          `It will be sent by email within one business day.\n\n— FutureMotion`,
  };
}
