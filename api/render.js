// GET /api/render?page=home|privacy — servi sur « / » et « /privacy » (rewrites
// de vercel.json). Rend côté serveur l'accueil (en-tête, compteurs, premières
// lignes) et injecte l'email de contact (CONTACT_EMAIL) dans les deux pages.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applySiteVars, renderHome } from './_lib/home-render.js';

const PAGES = {
  home: { file: 'china_cycle_suppliers.html', render: renderHome },
  privacy: { file: 'privacy.html', render: applySiteVars },
};

// Le résultat ne dépend que des fichiers déployés et des variables
// d'environnement : on le calcule une fois par instance.
const cache = new Map();

export function GET(request) {
  const name = new URL(request.url).searchParams.get('page') || 'home';
  const page = PAGES[name];
  if (!page) return new Response('Not found', { status: 404 });

  let html = cache.get(name);
  if (!html) {
    const template = readFileSync(path.join(process.cwd(), page.file), 'utf8');
    try {
      html = page.render(template, {
        contactEmail: process.env.CONTACT_EMAIL || '',
        siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
      });
    } catch (err) {
      // Gabarit modifié sans mettre à jour le rendu serveur : on sert la page
      // statique (le client la rend entièrement) plutôt qu'une erreur.
      console.error(`Rendu serveur « ${name} » impossible :`, err);
      html = template;
    }
    cache.set(name, html);
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache CDN : invalidé à chaque déploiement, le contenu ne change qu'à ce moment-là.
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
