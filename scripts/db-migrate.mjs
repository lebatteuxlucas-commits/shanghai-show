// Applique db/schema.sql sur la base Neon pointée par DATABASE_URL.
// Usage : vercel env pull .env.local && npm run db:migrate
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant — lancer `vercel env pull .env.local` d’abord.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

// Le driver HTTP n'accepte qu'une instruction par requête : découpage sur « ; »
// (le schéma ne contient ni fonction ni bloc DO). Commentaires retirés au préalable.
const statements = schema
  .split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
  .split(';').map(s => s.trim()).filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
  console.log('✓', stmt.split('\n')[0]);
}
console.log(`Schéma appliqué (${statements.length} instructions).`);
