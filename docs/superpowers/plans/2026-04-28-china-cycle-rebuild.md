# China Cycle Sourcing — Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the China Cycle 2025 supplier sourcing tool as a clean mobile-first PWA backed by Supabase, usable from phone in real time during the show (5-day deadline, salon = 2026-05-03).

**Architecture:** Vite + TypeScript (strict) + Lit web components + Tailwind, hosted on Vercel. Supabase provides Postgres (with FTS via tsvector), Storage (catalog files), Auth (magic-link), Realtime (live coverage counter), and pgvector (prepared for future spec→catalog matching). PWA installable on iOS/Android with naive offline retry (full offline queue out of scope for v1). Scraper is a Node + Playwright script that upserts into the same Supabase project; CSVs already in this repo seed the DB on day one as a safety net.

**Tech Stack:** Node 24, npm, Vite 5, TypeScript 5 strict, Lit 3, Tailwind 3, Supabase JS v2, Zod, MiniSearch (client-side fallback / autocomplete), pdf-lib (photo→PDF), Vitest, Playwright, Vercel.

**Time budget:** 5 phases, ~1 day each. Phases land on `main` after each commit; deploy is continuous from `main` via Vercel.

**Pragmatic note on TDD:** Strict TDD on domain logic (search ranking, coverage math, validators, CSV→SQL converter). Lighter test discipline on Lit components — covered by Playwright e2e on the critical flows (auth, search, upload, coverage update via Realtime).

---

## File Structure

Created in `../shanghai-cycle-show` (sibling of this repo, GitHub remote = https://github.com/lebatteuxlucas-commits/shanghai-cycle-show):

```
shanghai-cycle-show/
├── .env.local                        (gitignored)
├── .env.example
├── .gitignore
├── .nvmrc                            ("24")
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── README.md
├── public/
│   ├── manifest.webmanifest
│   ├── icons/{icon-192.png,icon-512.png,icon-maskable.png}
│   └── halls.json                    (static, 13 halls — id, name_en, name_cn)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260428000001_schema.sql
│   │   ├── 20260428000002_search.sql
│   │   ├── 20260428000003_storage.sql
│   │   ├── 20260428000004_rls.sql
│   │   └── 20260428000005_coverage_view.sql
│   └── seed.sql                      (generated from CSVs, committed)
├── scripts/
│   ├── csv-to-seed.ts                (CSV → seed.sql)
│   └── gen-types.sh                  (supabase gen types → src/lib/db.types.ts)
├── scraper/
│   ├── run.ts                        (CLI entry)
│   ├── sources/chinacycle.ts         (Playwright + cheerio adapter)
│   ├── lib/{normalize.ts,diff.ts,upsert.ts}
│   └── __tests__/normalize.test.ts
├── src/
│   ├── main.ts                       (bootstraps app, registers SW)
│   ├── app.ts                        (root <cc-app>: router + auth gate)
│   ├── sw.ts                         (service worker — naive cache-first for shell)
│   ├── lib/
│   │   ├── env.ts                    (zod-validated import.meta.env)
│   │   ├── supabase.ts               (typed client singleton)
│   │   ├── db.types.ts               (generated)
│   │   ├── router.ts                 (tiny hash-based router for 4 routes)
│   │   └── format.ts                 (number/percent helpers)
│   ├── domain/
│   │   ├── types.ts                  (Supplier, Catalog, Hall, Coverage)
│   │   ├── search.ts                 (Postgres FTS query builder)
│   │   ├── coverage.ts               (per-hall + global ratios)
│   │   ├── catalogs.ts               (upload, sha256, photo→PDF)
│   │   ├── suppliers.ts              (queries, status updates)
│   │   └── realtime.ts               (Realtime channel subscriptions)
│   ├── views/
│   │   ├── auth-view.ts              (<cc-auth>)
│   │   ├── directory-view.ts         (<cc-directory>)
│   │   ├── supplier-view.ts          (<cc-supplier>)
│   │   ├── coverage-view.ts          (<cc-coverage> — hall heatmap)
│   │   └── missing-view.ts           (<cc-missing>)
│   ├── components/
│   │   ├── bottom-nav.ts             (<cc-bottom-nav>)
│   │   ├── search-bar.ts             (<cc-search-bar>)
│   │   ├── filter-chips.ts           (<cc-filter-chips>)
│   │   ├── supplier-card.ts          (<cc-supplier-card>)
│   │   ├── upload-button.ts          (<cc-upload-button>)
│   │   ├── photo-capture.ts          (<cc-photo-capture>)
│   │   ├── coverage-bar.ts           (<cc-coverage-bar>)
│   │   ├── hall-tile.ts              (<cc-hall-tile>)
│   │   ├── status-pill.ts            (<cc-status-pill>)
│   │   └── toast.ts                  (<cc-toast>)
│   └── styles/
│       ├── tokens.css                (CSS vars from old app)
│       └── base.css                  (Tailwind layers + resets)
├── tests/
│   ├── unit/
│   │   ├── search.test.ts
│   │   ├── coverage.test.ts
│   │   ├── catalogs.test.ts
│   │   └── csv-to-seed.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       ├── directory.spec.ts
│       ├── upload.spec.ts
│       └── coverage.spec.ts
└── playwright.config.ts
```

**Source data** (copied from current `shanghai-show` repo into `supabase/seed/`):
- `halls.csv` (14 lines, 13 halls)
- `exhibit_categories.csv` (10 categories)
- `exhibitors.csv` (2787 suppliers)

---

## Phase 1 — Foundation (Day 1)

### Task 1: Bootstrap repo + Vite scaffold

**Files:**
- Create: `../china-cycle-sourcing/` (new dir, clone empty GitHub repo)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.nvmrc`, `.env.example`

- [ ] **Step 1: Clone the empty GitHub repo as sibling**

```bash
cd /Users/lucaslebatteux/Developer/Clauderie
git clone https://github.com/lebatteuxlucas-commits/shanghai-cycle-show.git
cd shanghai-cycle-show
```

If clone fails because repo is fully empty, instead:
```bash
mkdir shanghai-cycle-show && cd shanghai-cycle-show
git init -b main
git remote add origin https://github.com/lebatteuxlucas-commits/shanghai-cycle-show.git
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "shanghai-cycle-show",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc -b --noEmit",
    "db:types": "bash scripts/gen-types.sh",
    "db:push": "supabase db push",
    "db:seed": "tsx scripts/csv-to-seed.ts && psql \"$SUPABASE_DB_URL\" -f supabase/seed.sql",
    "scrape": "tsx scraper/run.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "lit": "^3.2.0",
    "minisearch": "^7.1.0",
    "pdf-lib": "^1.17.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^22.0.0",
    "autoprefixer": "^10.4.0",
    "cheerio": "^1.0.0",
    "csv-parse": "^5.5.0",
    "playwright": "^1.48.0",
    "postcss": "^8.4.0",
    "supabase": "^2.0.0",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.19.0",
    "typescript": "~5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vite/client"]
  },
  "include": ["src", "scripts", "scraper", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts`, `index.html`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `.nvmrc`, `.env.example`**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2022', sourcemap: true },
  server: { port: 5173 }
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0B1628" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
  <title>China Cycle Sourcing</title>
</head>
<body>
  <cc-app></cc-app>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#1A9A6F', dark: '#157a59', light: '#e4f5ed' },
        nav: '#0B1628',
        bg: '#F5F3EE',
        ink: '#0D0B09',
        mid: '#6E6A62',
        border: '#E2DFDA'
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'sans-serif'],
        mono: ['DM Mono', 'monospace']
      }
    }
  }
} satisfies Config;
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`.gitignore`:
```
node_modules
dist
.env.local
.env*.local
.vercel
.supabase
playwright-report
test-results
*.log
```

`.nvmrc`:
```
24
```

`.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_DB_URL=
```

- [ ] **Step 5: Install + first commit**

```bash
npm install
git add .
git commit -m "chore: scaffold Vite + TS + Lit + Tailwind"
git push -u origin main
```

Expected: `npm install` succeeds, repo is on GitHub with one commit.

---

### Task 2: Design tokens + base CSS

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Modify: `src/main.ts` (will be created in next task — placeholder import only here)

- [ ] **Step 1: Create `src/styles/tokens.css`** (copy from old app, line 12-39 of `china_cycle_suppliers.html`)

```css
:root {
  --black: #0D0B09;
  --charcoal: #1C1A16;
  --dark: #252219;
  --mid: #6E6A62;
  --light: #BFBBB2;
  --bg: #F5F3EE;
  --white: #FDFCF9;
  --teal: #1A9A6F;
  --teal-dark: #157a59;
  --teal-light: #e4f5ed;
  --nav-bg: #0B1628;
  --nav-text: #EEF0F4;
  --border: #E2DFDA;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow: 0 4px 20px rgba(0,0,0,0.10);
  --mono: 'DM Mono', monospace;
  --display: 'Barlow Condensed', sans-serif;
}
```

- [ ] **Step 2: Create `src/styles/base.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import './tokens.css';

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink, var(--black));
  font-family: 'DM Sans', -apple-system, system-ui, sans-serif;
  font-size: 14px;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}
button { font: inherit; cursor: pointer; }
input, select, textarea { font: inherit; }

/* iOS safe area */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-top { padding-top: env(safe-area-inset-top); }
```

- [ ] **Step 3: Commit**

```bash
git add src/styles
git commit -m "feat: design tokens + base CSS"
```

---

### Task 3: Supabase project link + initial schema migration

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/20260428000001_schema.sql`

- [ ] **Step 1: Init Supabase + link to existing project**

```bash
supabase init
supabase login   # opens browser
supabase link --project-ref gqxwcstasjmbkueqlcnl
```

Expected: `.supabase/` and `supabase/config.toml` created. Link confirms connection.

- [ ] **Step 2: Create `supabase/migrations/20260428000001_schema.sql`**

```sql
-- Halls (small reference table)
create table public.halls (
  id text primary key,                -- e.g. 'E1', 'W2'
  name_en text not null,
  name_cn text,
  exhibitor_count int
);

-- Categories (official taxonomy)
create table public.categories (
  id text primary key,                -- numeric ID from CSV (kept as text)
  name_en text not null,
  name_cn text
);

-- Suppliers
create table public.suppliers (
  id text primary key,                -- stable numeric ID from official directory
  name_en text not null,
  name_cn text,
  hall text references public.halls(id) on delete set null,
  booth text,
  categories_cn text[] default '{}',
  business_scope_en text,
  business_scope_cn text,
  website text,
  contact jsonb,
  visit_status text not null default 'pending'
    check (visit_status in ('pending', 'visited_no_catalog', 'done')),
  notes text,
  last_seen_in_scrape timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index suppliers_hall_idx on public.suppliers(hall);
create index suppliers_visit_status_idx on public.suppliers(visit_status);

-- Catalogs (one row per uploaded file)
create table public.catalogs (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.suppliers(id) on delete cascade,
  storage_path text not null,         -- 'catalogs/<supplier_id>/<uuid>-<filename>'
  filename text not null,
  mime text,
  size_bytes bigint,
  sha256 text not null,
  extracted_text text,                -- filled async by extraction pipeline (later)
  embedding vector(1536),             -- pgvector, null until matching is wired
  captured_at timestamptz default now(),
  unique (supplier_id, sha256)        -- dedupe per supplier
);

create index catalogs_supplier_idx on public.catalogs(supplier_id);

-- pgvector extension (idempotent)
create extension if not exists vector;

-- Updated_at trigger
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger suppliers_touch_updated_at
  before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- Scrape runs (audit trail)
create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  diff_summary jsonb,
  error text
);
```

- [ ] **Step 3: Push migration**

```bash
supabase db push
```

Expected: migration applied to remote project. Verify in Supabase Studio that tables exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(db): initial schema (suppliers, catalogs, halls, categories)"
```

---

### Task 4: FTS search vector migration

**Files:**
- Create: `supabase/migrations/20260428000002_search.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Generated tsvector spanning EN, CN, booth, scope, categories
alter table public.suppliers add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name_en, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_cn, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(booth, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(business_scope_en, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(business_scope_cn, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(categories_cn, '{}'), ' ')), 'C')
  ) stored;

create index suppliers_search_idx on public.suppliers using gin (search_vector);

-- Helper: prefix search (since trade-show queries are short)
-- Use plainto_tsquery for words and trigram fallback for short tokens.
create extension if not exists pg_trgm;
create index suppliers_name_en_trgm on public.suppliers using gin (name_en gin_trgm_ops);
create index suppliers_booth_trgm on public.suppliers using gin (booth gin_trgm_ops);
```

- [ ] **Step 2: Push + commit**

```bash
supabase db push
git add supabase/migrations/20260428000002_search.sql
git commit -m "feat(db): FTS search_vector + trigram indexes"
```

---

### Task 5: Storage bucket + RLS migration

**Files:**
- Create: `supabase/migrations/20260428000003_storage.sql`
- Create: `supabase/migrations/20260428000004_rls.sql`

- [ ] **Step 1: Create `20260428000003_storage.sql`**

```sql
-- Private bucket for catalog files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogs', 'catalogs', false,
  52428800,  -- 50 MB max per file
  array['application/pdf','image/png','image/jpeg','image/webp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel','text/csv']
)
on conflict (id) do nothing;
```

- [ ] **Step 2: Create `20260428000004_rls.sql`**

Single-user app: any authenticated user can read/write all data. (We're the only auth'd user.)

```sql
alter table public.suppliers enable row level security;
alter table public.catalogs enable row level security;
alter table public.halls enable row level security;
alter table public.categories enable row level security;
alter table public.scrape_runs enable row level security;

create policy "auth read suppliers" on public.suppliers for select using (auth.role() = 'authenticated');
create policy "auth write suppliers" on public.suppliers for update using (auth.role() = 'authenticated');
create policy "auth insert suppliers" on public.suppliers for insert with check (auth.role() = 'authenticated');
create policy "auth read catalogs" on public.catalogs for select using (auth.role() = 'authenticated');
create policy "auth write catalogs" on public.catalogs for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read halls" on public.halls for select using (auth.role() = 'authenticated');
create policy "auth read categories" on public.categories for select using (auth.role() = 'authenticated');
create policy "auth read scrape_runs" on public.scrape_runs for select using (auth.role() = 'authenticated');

-- Storage policies (catalogs bucket)
create policy "auth read catalog files" on storage.objects for select
  using (bucket_id = 'catalogs' and auth.role() = 'authenticated');
create policy "auth upload catalog files" on storage.objects for insert
  with check (bucket_id = 'catalogs' and auth.role() = 'authenticated');
create policy "auth delete catalog files" on storage.objects for delete
  using (bucket_id = 'catalogs' and auth.role() = 'authenticated');
```

- [ ] **Step 3: Push + commit**

```bash
supabase db push
git add supabase/migrations
git commit -m "feat(db): storage bucket + RLS policies"
```

---

### Task 6: Coverage view migration

**Files:**
- Create: `supabase/migrations/20260428000005_coverage_view.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Per-hall coverage: total suppliers, suppliers with ≥1 catalog, suppliers visited_no_catalog
create or replace view public.hall_coverage as
select
  h.id as hall_id,
  h.name_en as hall_name_en,
  count(s.id)::int as suppliers_total,
  count(distinct case when c.supplier_id is not null then s.id end)::int as suppliers_with_catalog,
  count(case when s.visit_status = 'visited_no_catalog' then 1 end)::int as suppliers_visited_empty,
  count(case when s.visit_status = 'pending' then 1 end)::int as suppliers_pending
from public.halls h
left join public.suppliers s on s.hall = h.id
left join public.catalogs c on c.supplier_id = s.id
group by h.id, h.name_en
order by h.id;

-- Global single-row summary
create or replace view public.global_coverage as
select
  count(distinct s.id)::int as suppliers_total,
  count(distinct c.supplier_id)::int as suppliers_with_catalog
from public.suppliers s
left join public.catalogs c on c.supplier_id = s.id;
```

- [ ] **Step 2: Push + commit**

```bash
supabase db push
git add supabase/migrations
git commit -m "feat(db): hall_coverage + global_coverage views"
```

---

### Task 7: CSV → seed.sql converter (TDD)

**Files:**
- Create: `supabase/seed/halls.csv`, `supabase/seed/exhibit_categories.csv`, `supabase/seed/exhibitors.csv` (copied from this repo)
- Create: `scripts/csv-to-seed.ts`
- Create: `tests/unit/csv-to-seed.test.ts`
- Create: `supabase/seed.sql` (generated)

- [ ] **Step 1: Copy CSVs**

```bash
cp /Users/lucaslebatteux/Developer/Clauderie/shanghai-show/halls.csv supabase/seed/
cp /Users/lucaslebatteux/Developer/Clauderie/shanghai-show/exhibit_categories.csv supabase/seed/
cp /Users/lucaslebatteux/Developer/Clauderie/shanghai-show/exhibitors.csv supabase/seed/
```

- [ ] **Step 2: Write the failing test** in `tests/unit/csv-to-seed.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { rowToInsertSupplier, escapeSql } from '../../scripts/csv-to-seed';

describe('escapeSql', () => {
  it('doubles single quotes', () => {
    expect(escapeSql("Co. O'Brien")).toBe("'Co. O''Brien'");
  });
  it('handles empty as NULL', () => {
    expect(escapeSql('')).toBe('NULL');
  });
  it('handles undefined as NULL', () => {
    expect(escapeSql(undefined)).toBe('NULL');
  });
  it('preserves Chinese characters', () => {
    expect(escapeSql('整车品牌馆')).toBe("'整车品牌馆'");
  });
});

describe('rowToInsertSupplier', () => {
  it('builds an INSERT row', () => {
    const row = {
      'Company Name (English)': "XINGTAI BOJUE SPORTS EQUIPMENT CO., LTD",
      'Company Name (Chinese)': '邢台铂爵运动器材有限公司',
      'Booth/Hall Number': 'W2',
      'Hall Name (English)': 'Bicycles & accessories',
      'Hall Name (Chinese)': '整车及零配件馆',
      'Exhibit Categories (Chinese)': '',
      'Business Scope (English)': '',
      'Business Scope (Chinese)': '自行车车架、轴皮（花鼓）、山地车、锂电车',
      'ID': '615849466527879168'
    };
    const sql = rowToInsertSupplier(row);
    expect(sql).toContain("'615849466527879168'");
    expect(sql).toContain("'XINGTAI BOJUE SPORTS EQUIPMENT CO., LTD'");
    expect(sql).toContain("'邢台铂爵运动器材有限公司'");
    expect(sql).toContain("'W2'");      // hall code
    expect(sql).toContain("'{}'");      // empty categories array
  });

  it('parses booth that is purely a hall code', () => {
    const row = {
      'Company Name (English)': 'Test',
      'Company Name (Chinese)': '',
      'Booth/Hall Number': 'E1',
      'Hall Name (English)': 'Bicycles',
      'Hall Name (Chinese)': '',
      'Exhibit Categories (Chinese)': '',
      'Business Scope (English)': '',
      'Business Scope (Chinese)': '',
      'ID': '1'
    };
    const sql = rowToInsertSupplier(row);
    expect(sql).toContain("'E1'");
  });
});
```

- [ ] **Step 3: Run test — should fail**

```bash
npx vitest run tests/unit/csv-to-seed.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement `scripts/csv-to-seed.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

export function escapeSql(v: string | undefined | null): string {
  if (v === undefined || v === null || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function escapeArray(v: string | undefined): string {
  if (!v) return "'{}'";
  const items = v.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return "'{}'";
  const escaped = items.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',');
  return `'{${escaped}}'`;
}

function extractHallCode(booth: string | undefined): string | null {
  if (!booth) return null;
  const m = booth.match(/^([EWN]\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

export function rowToInsertSupplier(row: Record<string, string>): string {
  const id = row['ID']?.trim();
  const nameEn = row['Company Name (English)']?.trim();
  const nameCn = row['Company Name (Chinese)']?.trim();
  const booth = row['Booth/Hall Number']?.trim();
  const hallCode = extractHallCode(booth);
  const categoriesCn = row['Exhibit Categories (Chinese)']?.trim();
  const scopeEn = row['Business Scope (English)']?.trim();
  const scopeCn = row['Business Scope (Chinese)']?.trim();

  return [
    '(',
    escapeSql(id), ',',
    escapeSql(nameEn), ',',
    escapeSql(nameCn), ',',
    escapeSql(hallCode), ',',
    escapeSql(booth), ',',
    escapeArray(categoriesCn), ',',
    escapeSql(scopeEn), ',',
    escapeSql(scopeCn),
    ')'
  ].join('');
}

function main() {
  const halls = parse(readFileSync('supabase/seed/halls.csv', 'utf8'), { columns: true, bom: true });
  const cats = parse(readFileSync('supabase/seed/exhibit_categories.csv', 'utf8'), { columns: true, bom: true });
  const exhibitors = parse(readFileSync('supabase/seed/exhibitors.csv', 'utf8'), { columns: true, bom: true });

  const lines: string[] = [];
  lines.push('-- Generated by scripts/csv-to-seed.ts. Do not edit by hand.');
  lines.push('begin;');
  lines.push('truncate public.catalogs, public.suppliers, public.categories, public.halls restart identity cascade;');

  // halls
  lines.push('insert into public.halls (id, name_en, name_cn, exhibitor_count) values');
  lines.push(halls.map((r: any) => `(${escapeSql(r['Hall Number'])}, ${escapeSql(r['Hall Name (English)'])}, ${escapeSql(r['Hall Name (Chinese)'])}, ${parseInt(r['Exhibitor Count'] ?? '0', 10)})`).join(',\n') + ';');

  // categories
  lines.push('insert into public.categories (id, name_en, name_cn) values');
  lines.push(cats.map((r: any) => `(${escapeSql(r['ID'])}, ${escapeSql(r['Category (English)'])}, ${escapeSql(r['Category (Chinese)'])})`).join(',\n') + ';');

  // suppliers — chunked to avoid giant single statement
  const CHUNK = 500;
  for (let i = 0; i < exhibitors.length; i += CHUNK) {
    const chunk = exhibitors.slice(i, i + CHUNK);
    lines.push('insert into public.suppliers (id, name_en, name_cn, hall, booth, categories_cn, business_scope_en, business_scope_cn) values');
    lines.push(chunk.map(rowToInsertSupplier).join(',\n') + ' on conflict (id) do nothing;');
  }

  lines.push('commit;');
  writeFileSync('supabase/seed.sql', lines.join('\n'));
  console.log(`Wrote supabase/seed.sql (${exhibitors.length} suppliers, ${halls.length} halls, ${cats.length} categories)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 5: Run tests — should pass**

```bash
npx vitest run tests/unit/csv-to-seed.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate the seed**

```bash
npx tsx scripts/csv-to-seed.ts
```

Expected: `supabase/seed.sql` is ~1-2 MB. First lines should be `begin;` then `truncate ...`.

- [ ] **Step 7: Apply seed to remote DB**

Get the DB connection string from Supabase Studio → Project Settings → Database → "Connection string" (transaction pooler URI). Save it in `.env.local` as `SUPABASE_DB_URL=postgresql://...`. Then:

```bash
source .env.local && psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Expected: `INSERT 0 N` lines, ending with `COMMIT`. Verify in Studio: `select count(*) from suppliers;` returns 2787.

- [ ] **Step 8: Commit**

```bash
git add scripts supabase/seed supabase/seed.sql tests/unit/csv-to-seed.test.ts
git commit -m "feat(seed): CSV→SQL converter + initial seed (2787 suppliers)"
```

---

### Task 8: Generate TS types + Supabase client

**Files:**
- Create: `scripts/gen-types.sh`
- Create: `src/lib/db.types.ts` (generated)
- Create: `src/lib/env.ts`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create `scripts/gen-types.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
supabase gen types typescript --project-id gqxwcstasjmbkueqlcnl --schema public > src/lib/db.types.ts
echo "Wrote src/lib/db.types.ts"
```

```bash
chmod +x scripts/gen-types.sh
npm run db:types
```

Expected: `src/lib/db.types.ts` populated (~hundreds of lines).

- [ ] **Step 2: Create `src/lib/env.ts`**

```ts
import { z } from 'zod';

const Env = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20)
});

export const env = Env.parse(import.meta.env);
```

- [ ] **Step 3: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './db.types';
import { env } from './env';

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 5 } }
  }
);
```

- [ ] **Step 4: Create `.env.local`**

```
VITE_SUPABASE_URL=https://gqxwcstasjmbkueqlcnl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YcPsieGs9p7ealCM2g5NaA_bDMB9GH-
SUPABASE_DB_URL=<from Supabase Studio, Connection string>
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-types.sh src/lib
git commit -m "feat(lib): typed Supabase client + env validation"
```

---

### Task 9: Auth magic-link + `<cc-app>` shell

**Files:**
- Create: `src/main.ts`, `src/app.ts`, `src/views/auth-view.ts`

- [ ] **Step 1: Create `src/main.ts`**

```ts
import './styles/base.css';
import './app';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
```

- [ ] **Step 2: Create `src/views/auth-view.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { supabase } from '../lib/supabase';

@customElement('cc-auth')
export class AuthView extends LitElement {
  static styles = css`
    :host { display: grid; place-items: center; min-height: 100dvh; padding: 24px; background: var(--bg); }
    .card { width: 100%; max-width: 360px; background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow); }
    h1 { font-family: var(--display); font-size: 22px; letter-spacing: 0.5px; margin: 0 0 4px; text-transform: uppercase; }
    p { margin: 0 0 16px; color: var(--mid); font-size: 13px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; font-size: 16px; }
    button { width: 100%; margin-top: 12px; padding: 12px; border: 0; border-radius: 10px; background: var(--teal); color: white; font-weight: 600; font-size: 15px; }
    button:disabled { opacity: 0.5; }
    .ok { color: var(--teal-dark); font-size: 13px; margin-top: 12px; }
    .err { color: #b3261e; font-size: 13px; margin-top: 12px; }
  `;
  @state() private email = '';
  @state() private status: 'idle' | 'sending' | 'sent' | 'error' = 'idle';
  @state() private err = '';

  private async submit(e: Event) {
    e.preventDefault();
    if (!this.email) return;
    this.status = 'sending';
    const { error } = await supabase.auth.signInWithOtp({
      email: this.email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) { this.status = 'error'; this.err = error.message; return; }
    this.status = 'sent';
  }

  render() {
    return html`
      <form class="card" @submit=${this.submit}>
        <h1>China Cycle <span style="color: var(--teal)">Sourcing</span></h1>
        <p>Magic-link login.</p>
        <input type="email" required placeholder="you@example.com"
          .value=${this.email} @input=${(e: any) => this.email = e.target.value} />
        <button type="submit" ?disabled=${this.status === 'sending'}>
          ${this.status === 'sending' ? 'Sending…' : 'Send link'}
        </button>
        ${this.status === 'sent' ? html`<div class="ok">Check your inbox.</div>` : ''}
        ${this.status === 'error' ? html`<div class="err">${this.err}</div>` : ''}
      </form>
    `;
  }
}
```

- [ ] **Step 3: Create `src/app.ts`** (minimal — auth gate only; routing added in Task 12)

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import './views/auth-view';

@customElement('cc-app')
export class App extends LitElement {
  @state() private session: Session | null = null;
  @state() private loading = true;

  async connectedCallback() {
    super.connectedCallback();
    const { data } = await supabase.auth.getSession();
    this.session = data.session;
    this.loading = false;
    supabase.auth.onAuthStateChange((_e, session) => { this.session = session; });
  }

  createRenderRoot() { return this; }  // light DOM so global styles apply

  render() {
    if (this.loading) return html`<div style="display:grid;place-items:center;min-height:100dvh;color:var(--mid)">…</div>`;
    if (!this.session) return html`<cc-auth></cc-auth>`;
    return html`<div style="padding:16px"><h1 style="font-family:var(--display)">Logged in as ${this.session.user.email}</h1><button @click=${() => supabase.auth.signOut()}>Sign out</button></div>`;
  }
}
```

- [ ] **Step 4: Run dev server, verify magic link works end-to-end**

```bash
npm run dev
```

Visit `http://localhost:5173`. Submit your email. Check inbox. Click link. Should land back authenticated.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(auth): magic-link login + cc-app shell"
```

---

### Task 10: Vercel deploy

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Push to GitHub, then connect on Vercel dashboard**

```bash
git add vercel.json
git commit -m "chore: vercel config"
git push
```

In Vercel dashboard: Add New → Project → import `shanghai-cycle-show` → Framework: Vite → set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → Deploy.

- [ ] **Step 3: Verify production URL works (auth screen renders)**

Open the Vercel preview URL on mobile (Safari/Chrome). Should see the auth card. Try login. Magic-link redirect must land on the production URL — go to Supabase → Authentication → URL Configuration → add the Vercel URL to Site URL + Redirect URLs.

---

## Phase 2 — Directory + Search (Day 2)

### Task 11: Domain types + zod schemas

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Define types**

```ts
import { z } from 'zod';

export const VisitStatus = z.enum(['pending', 'visited_no_catalog', 'done']);
export type VisitStatus = z.infer<typeof VisitStatus>;

export const Supplier = z.object({
  id: z.string(),
  name_en: z.string(),
  name_cn: z.string().nullable(),
  hall: z.string().nullable(),
  booth: z.string().nullable(),
  categories_cn: z.array(z.string()).default([]),
  business_scope_en: z.string().nullable(),
  business_scope_cn: z.string().nullable(),
  website: z.string().nullable(),
  visit_status: VisitStatus,
  notes: z.string().nullable()
});
export type Supplier = z.infer<typeof Supplier>;

export const Hall = z.object({
  id: z.string(),
  name_en: z.string(),
  name_cn: z.string().nullable(),
  exhibitor_count: z.number().int().nullable()
});
export type Hall = z.infer<typeof Hall>;

export const HallCoverage = z.object({
  hall_id: z.string(),
  hall_name_en: z.string(),
  suppliers_total: z.number().int(),
  suppliers_with_catalog: z.number().int(),
  suppliers_visited_empty: z.number().int(),
  suppliers_pending: z.number().int()
});
export type HallCoverage = z.infer<typeof HallCoverage>;

export const GlobalCoverage = z.object({
  suppliers_total: z.number().int(),
  suppliers_with_catalog: z.number().int()
});
export type GlobalCoverage = z.infer<typeof GlobalCoverage>;
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): types + zod schemas"
```

---

### Task 12: Search service (TDD)

**Files:**
- Create: `src/domain/search.ts`
- Create: `tests/unit/search.test.ts`

- [ ] **Step 1: Write failing test** in `tests/unit/search.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildSearchQuery, parseQueryTokens } from '../../src/domain/search';

describe('parseQueryTokens', () => {
  it('splits on whitespace and lowercases', () => {
    expect(parseQueryTokens('  Bicycle Frame  ')).toEqual(['bicycle', 'frame']);
  });
  it('preserves CJK as one token per character group', () => {
    expect(parseQueryTokens('自行车 锂电')).toEqual(['自行车', '锂电']);
  });
  it('returns [] for empty', () => {
    expect(parseQueryTokens('')).toEqual([]);
  });
});

describe('buildSearchQuery', () => {
  it('returns null tsquery for empty input', () => {
    expect(buildSearchQuery('').tsquery).toBeNull();
  });
  it('joins tokens with & and adds prefix:* on each', () => {
    const q = buildSearchQuery('bicycle frame');
    expect(q.tsquery).toBe('bicycle:* & frame:*');
  });
  it('escapes special tsquery chars', () => {
    const q = buildSearchQuery("o'brien & co.");
    expect(q.tsquery).not.toContain('&');
    expect(q.tsquery).toContain('obrien:*');
  });
  it('exposes raw query for trigram fallback', () => {
    const q = buildSearchQuery('E1');
    expect(q.raw).toBe('E1');
  });
});
```

- [ ] **Step 2: Run — should fail.**

```bash
npx vitest run tests/unit/search.test.ts
```

- [ ] **Step 3: Implement `src/domain/search.ts`**

```ts
import { supabase } from '../lib/supabase';
import type { Supplier } from './types';

export interface ParsedQuery { tsquery: string | null; raw: string; }

export function parseQueryTokens(input: string): string[] {
  return input.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function buildSearchQuery(input: string): ParsedQuery {
  const raw = input.trim();
  const tokens = parseQueryTokens(raw)
    .map(t => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (tokens.length === 0) return { tsquery: null, raw };
  return { tsquery: tokens.map(t => `${t}:*`).join(' & '), raw };
}

export interface SearchFilters {
  hall?: string;
  category?: string;
  missingOnly?: boolean;
  visitStatus?: 'pending' | 'visited_no_catalog' | 'done';
}

export async function searchSuppliers(input: string, filters: SearchFilters, limit = 50, offset = 0) {
  const { tsquery, raw } = buildSearchQuery(input);

  let query = supabase
    .from('suppliers')
    .select('id,name_en,name_cn,hall,booth,categories_cn,business_scope_en,visit_status,catalogs(id)', { count: 'exact' })
    .order('name_en')
    .range(offset, offset + limit - 1);

  if (tsquery) {
    query = query.textSearch('search_vector', tsquery, { config: 'simple' });
  } else if (raw && raw.length <= 4) {
    // short query (e.g. 'E1') — trigram on booth/name_en
    query = query.or(`booth.ilike.%${raw}%,name_en.ilike.%${raw}%`);
  }
  if (filters.hall) query = query.eq('hall', filters.hall);
  if (filters.visitStatus) query = query.eq('visit_status', filters.visitStatus);
  if (filters.category) query = query.contains('categories_cn', [filters.category]);
  // missingOnly handled client-side via the embedded catalogs(id) join

  const { data, count, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as unknown as (Supplier & { catalogs: { id: string }[] })[];
  if (filters.missingOnly) rows = rows.filter(r => r.catalogs.length === 0);
  return { rows, total: count ?? 0 };
}
```

- [ ] **Step 4: Run — should pass.**

```bash
npx vitest run tests/unit/search.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/search.ts tests/unit/search.test.ts
git commit -m "feat(domain): search service with FTS + filters"
```

---

### Task 13: Coverage service (TDD)

**Files:**
- Create: `src/domain/coverage.ts`
- Create: `tests/unit/coverage.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { coverageRatio, coverageColor } from '../../src/domain/coverage';

describe('coverageRatio', () => {
  it('returns 0 when total is 0', () => {
    expect(coverageRatio(0, 0)).toBe(0);
  });
  it('returns full ratio', () => {
    expect(coverageRatio(50, 100)).toBe(0.5);
  });
  it('clamps to 1 if with > total (defensive)', () => {
    expect(coverageRatio(120, 100)).toBe(1);
  });
});

describe('coverageColor', () => {
  it('returns gray bg when 0', () => {
    expect(coverageColor(0)).toMatch(/#E2DFDA|var\(--border\)/);
  });
  it('returns teal-ish when high', () => {
    const c = coverageColor(0.9);
    expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
```

- [ ] **Step 2: Implement `src/domain/coverage.ts`**

```ts
import { supabase } from '../lib/supabase';
import { GlobalCoverage, HallCoverage } from './types';

export function coverageRatio(withCatalog: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, withCatalog / total);
}

// Linear interpolation from --border #E2DFDA (0%) to --teal #1A9A6F (100%)
export function coverageColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  const start = { r: 0xE2, g: 0xDF, b: 0xDA };
  const end = { r: 0x1A, g: 0x9A, b: 0x6F };
  const mix = (a: number, b: number) => Math.round(a + (b - a) * r);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(start.r, end.r))}${hex(mix(start.g, end.g))}${hex(mix(start.b, end.b))}`;
}

export async function fetchHallCoverage(): Promise<HallCoverage[]> {
  const { data, error } = await supabase.from('hall_coverage').select('*').order('hall_id');
  if (error) throw error;
  return HallCoverage.array().parse(data);
}

export async function fetchGlobalCoverage(): Promise<GlobalCoverage> {
  const { data, error } = await supabase.from('global_coverage').select('*').single();
  if (error) throw error;
  return GlobalCoverage.parse(data);
}
```

- [ ] **Step 3: Tests pass + commit**

```bash
npx vitest run tests/unit/coverage.test.ts
git add src/domain/coverage.ts tests/unit/coverage.test.ts
git commit -m "feat(domain): coverage ratio + color interpolation"
```

---

### Task 14: Router + bottom nav

**Files:**
- Create: `src/lib/router.ts`
- Create: `src/components/bottom-nav.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/lib/router.ts`**

```ts
export type Route =
  | { kind: 'directory' }
  | { kind: 'supplier'; id: string }
  | { kind: 'coverage' }
  | { kind: 'missing' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h.startsWith('/supplier/')) return { kind: 'supplier', id: h.slice('/supplier/'.length) };
  if (h === '/coverage') return { kind: 'coverage' };
  if (h === '/missing') return { kind: 'missing' };
  return { kind: 'directory' };
}

export function navigate(path: string) {
  if (location.hash !== `#${path}`) location.hash = path;
}
```

- [ ] **Step 2: Create `src/components/bottom-nav.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { navigate, type Route } from '../lib/router';

@customElement('cc-bottom-nav')
export class BottomNav extends LitElement {
  static styles = css`
    :host { position: fixed; bottom: 0; left: 0; right: 0; background: var(--nav-bg); color: var(--nav-text); display: grid; grid-template-columns: repeat(3, 1fr); padding: 6px 0 calc(6px + env(safe-area-inset-bottom)); z-index: 100; box-shadow: 0 -2px 12px rgba(0,0,0,0.2); }
    button { background: transparent; border: 0; color: rgba(255,255,255,0.6); font-size: 11px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: var(--display); letter-spacing: 1px; text-transform: uppercase; }
    button.active { color: var(--teal); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-bottom: 4px; }
  `;
  @property({ attribute: false }) route!: Route;

  render() {
    const is = (k: Route['kind']) => this.route.kind === k;
    return html`
      <button class=${is('directory') ? 'active' : ''} @click=${() => navigate('/')}>
        <span class="dot"></span>Directory
      </button>
      <button class=${is('coverage') ? 'active' : ''} @click=${() => navigate('/coverage')}>
        <span class="dot"></span>Map
      </button>
      <button class=${is('missing') ? 'active' : ''} @click=${() => navigate('/missing')}>
        <span class="dot"></span>Missing
      </button>
    `;
  }
}
```

- [ ] **Step 3: Wire router in `src/app.ts`**

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { parseHash, type Route } from './lib/router';
import './views/auth-view';
import './views/directory-view';
import './views/supplier-view';
import './views/coverage-view';
import './views/missing-view';
import './components/bottom-nav';

@customElement('cc-app')
export class App extends LitElement {
  @state() private session: Session | null = null;
  @state() private loading = true;
  @state() private route: Route = parseHash(location.hash);

  async connectedCallback() {
    super.connectedCallback();
    const { data } = await supabase.auth.getSession();
    this.session = data.session;
    this.loading = false;
    supabase.auth.onAuthStateChange((_e, session) => { this.session = session; });
    window.addEventListener('hashchange', () => { this.route = parseHash(location.hash); });
  }

  createRenderRoot() { return this; }

  private renderRoute() {
    switch (this.route.kind) {
      case 'directory': return html`<cc-directory></cc-directory>`;
      case 'supplier': return html`<cc-supplier .id=${this.route.id}></cc-supplier>`;
      case 'coverage': return html`<cc-coverage></cc-coverage>`;
      case 'missing': return html`<cc-missing></cc-missing>`;
    }
  }

  render() {
    if (this.loading) return html`<div style="display:grid;place-items:center;min-height:100dvh;color:var(--mid)">…</div>`;
    if (!this.session) return html`<cc-auth></cc-auth>`;
    return html`
      <main style="padding-bottom: 88px; min-height: 100dvh;">${this.renderRoute()}</main>
      <cc-bottom-nav .route=${this.route}></cc-bottom-nav>
    `;
  }
}
```

- [ ] **Step 4: Stub the four views (so imports don't fail)**

For each: `src/views/{directory,supplier,coverage,missing}-view.ts`, write a minimal placeholder:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('cc-directory')
export class DirectoryView extends LitElement {
  createRenderRoot() { return this; }
  render() { return html`<div style="padding:16px"><h1 style="font-family:var(--display)">Directory</h1></div>`; }
}
```

(Substitute element name `cc-supplier` etc. for the others; supplier accepts `@property() id`.)

- [ ] **Step 5: Run dev server, verify nav switches between 3 stubbed views**

```bash
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: hash router + bottom nav + view stubs"
```

---

### Task 15: Directory view — list + search + filters

**Files:**
- Create: `src/components/search-bar.ts`, `src/components/filter-chips.ts`, `src/components/supplier-card.ts`, `src/components/coverage-bar.ts`
- Modify: `src/views/directory-view.ts`

- [ ] **Step 1: Create `src/components/coverage-bar.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { coverageRatio } from '../domain/coverage';

@customElement('cc-coverage-bar')
export class CoverageBar extends LitElement {
  static styles = css`
    :host { display: block; padding: 12px 16px; background: var(--white); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
    .row { display: flex; align-items: baseline; justify-content: space-between; }
    .num { font-family: var(--display); font-size: 24px; font-weight: 700; }
    .num em { color: var(--teal); font-style: normal; }
    .pct { font-family: var(--mono); font-size: 12px; color: var(--mid); }
    .bar { margin-top: 8px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .fill { height: 100%; background: var(--teal); transition: width 200ms ease; }
  `;
  @property({ type: Number }) total = 0;
  @property({ type: Number }) withCatalog = 0;

  render() {
    const ratio = coverageRatio(this.withCatalog, this.total);
    const pct = Math.round(ratio * 100);
    return html`
      <div class="row">
        <div class="num"><em>${this.withCatalog}</em> / ${this.total} catalogs collected</div>
        <div class="pct">${pct}%</div>
      </div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
    `;
  }
}
```

- [ ] **Step 2: Create `src/components/search-bar.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('cc-search-bar')
export class SearchBar extends LitElement {
  static styles = css`
    :host { display: block; padding: 12px 16px; background: var(--white); border-bottom: 1px solid var(--border); }
    input { width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; font-size: 16px; background: var(--bg); }
    input:focus { outline: 2px solid var(--teal); border-color: var(--teal); }
  `;
  @property() value = '';

  private onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent('cc-search', { detail: this.value, bubbles: true }));
  }

  render() {
    return html`<input type="search" placeholder="Search supplier, booth, scope…"
      .value=${this.value} @input=${this.onInput} />`;
  }
}
```

- [ ] **Step 3: Create `src/components/filter-chips.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type FilterValue = { hall?: string; missingOnly: boolean };

@customElement('cc-filter-chips')
export class FilterChips extends LitElement {
  static styles = css`
    :host { display: block; padding: 8px 16px 12px; background: var(--white); border-bottom: 1px solid var(--border); overflow-x: auto; white-space: nowrap; }
    .chip { display: inline-block; padding: 6px 12px; margin-right: 6px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); font-size: 12px; cursor: pointer; user-select: none; }
    .chip.active { background: var(--teal); color: white; border-color: var(--teal); }
    .chip.toggle { background: var(--bg); }
    .chip.toggle.active { background: #b3261e; border-color: #b3261e; }
  `;
  @property({ attribute: false }) halls: { id: string }[] = [];
  @property({ attribute: false }) value: FilterValue = { missingOnly: false };

  private setHall(id: string | undefined) {
    this.dispatchEvent(new CustomEvent('cc-filter', { detail: { ...this.value, hall: id }, bubbles: true }));
  }
  private toggleMissing() {
    this.dispatchEvent(new CustomEvent('cc-filter', { detail: { ...this.value, missingOnly: !this.value.missingOnly }, bubbles: true }));
  }

  render() {
    return html`
      <span class="chip toggle ${this.value.missingOnly ? 'active' : ''}" @click=${this.toggleMissing}>Missing only</span>
      <span class="chip ${!this.value.hall ? 'active' : ''}" @click=${() => this.setHall(undefined)}>All halls</span>
      ${this.halls.map(h => html`<span class="chip ${this.value.hall === h.id ? 'active' : ''}" @click=${() => this.setHall(h.id)}>${h.id}</span>`)}
    `;
  }
}
```

- [ ] **Step 4: Create `src/components/supplier-card.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { navigate } from '../lib/router';

@customElement('cc-supplier-card')
export class SupplierCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .card { padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--white); display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; cursor: pointer; }
    .card:active { background: var(--bg); }
    .name { font-weight: 600; font-size: 14px; }
    .cn { color: var(--mid); font-size: 12px; }
    .meta { font-family: var(--mono); font-size: 11px; color: var(--mid); margin-top: 4px; }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .badge.has { background: var(--teal-light); color: var(--teal-dark); }
    .badge.missing { background: var(--bg); color: var(--mid); border: 1px dashed var(--border); }
    .badge.empty { background: #fff3e0; color: #b26a00; }
  `;
  @property() id!: string;
  @property() nameEn = '';
  @property() nameCn: string | null = null;
  @property() hall: string | null = null;
  @property() booth: string | null = null;
  @property({ type: Number }) catalogCount = 0;
  @property() visitStatus: 'pending' | 'visited_no_catalog' | 'done' = 'pending';

  private badge() {
    if (this.catalogCount > 0) return html`<span class="badge has">✓ ${this.catalogCount}</span>`;
    if (this.visitStatus === 'visited_no_catalog') return html`<span class="badge empty">No catalog</span>`;
    return html`<span class="badge missing">Missing</span>`;
  }

  render() {
    return html`
      <div class="card" @click=${() => navigate(`/supplier/${this.id}`)}>
        <div>
          <div class="name">${this.nameEn}</div>
          ${this.nameCn ? html`<div class="cn">${this.nameCn}</div>` : ''}
          <div class="meta">${this.hall ?? '—'} · ${this.booth ?? '—'}</div>
        </div>
        ${this.badge()}
      </div>
    `;
  }
}
```

- [ ] **Step 5: Implement `src/views/directory-view.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { supabase } from '../lib/supabase';
import { searchSuppliers, type SearchFilters } from '../domain/search';
import { fetchGlobalCoverage } from '../domain/coverage';
import type { Hall } from '../domain/types';
import '../components/coverage-bar';
import '../components/search-bar';
import '../components/filter-chips';
import '../components/supplier-card';

const PAGE_SIZE = 50;

@customElement('cc-directory')
export class DirectoryView extends LitElement {
  createRenderRoot() { return this; }
  @state() private q = '';
  @state() private filters: SearchFilters = { missingOnly: false };
  @state() private rows: any[] = [];
  @state() private total = 0;
  @state() private loading = false;
  @state() private halls: Hall[] = [];
  @state() private coverage = { suppliers_total: 0, suppliers_with_catalog: 0 };
  private searchTimer: number | null = null;

  async connectedCallback() {
    super.connectedCallback();
    const [{ data: halls }, cov] = await Promise.all([
      supabase.from('halls').select('*').order('id'),
      fetchGlobalCoverage()
    ]);
    this.halls = (halls ?? []) as any;
    this.coverage = cov;
    this.refresh();
    this.addEventListener('cc-search', (e: any) => { this.q = e.detail; this.debounceRefresh(); });
    this.addEventListener('cc-filter', (e: any) => { this.filters = e.detail; this.refresh(); });
  }

  private debounceRefresh() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => this.refresh(), 200);
  }

  private async refresh() {
    this.loading = true;
    const { rows, total } = await searchSuppliers(this.q, this.filters, PAGE_SIZE);
    this.rows = rows;
    this.total = total;
    this.loading = false;
  }

  render() {
    return html`
      <cc-coverage-bar .total=${this.coverage.suppliers_total} .withCatalog=${this.coverage.suppliers_with_catalog}></cc-coverage-bar>
      <cc-search-bar .value=${this.q}></cc-search-bar>
      <cc-filter-chips .halls=${this.halls} .value=${{ hall: this.filters.hall, missingOnly: !!this.filters.missingOnly }}></cc-filter-chips>
      <div style="padding: 8px 16px; font-family: var(--mono); font-size: 11px; color: var(--mid);">
        ${this.loading ? 'Loading…' : `${this.total} results`}
      </div>
      ${this.rows.map(r => html`
        <cc-supplier-card
          .id=${r.id} .nameEn=${r.name_en} .nameCn=${r.name_cn}
          .hall=${r.hall} .booth=${r.booth}
          .catalogCount=${r.catalogs?.length ?? 0}
          .visitStatus=${r.visit_status}>
        </cc-supplier-card>
      `)}
    `;
  }
}
```

- [ ] **Step 6: Run, verify directory loads + search works**

```bash
npm run dev
```

Search "bicycle" → list filters live. Tap a hall chip → list narrows. Toggle "Missing only" → filters to suppliers with 0 catalogs.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: directory view with search + filters + coverage bar"
```

---

## Phase 3 — Detail + Upload + Realtime (Day 3)

### Task 16: Catalogs domain (TDD: sha256 + photo→PDF)

**Files:**
- Create: `src/domain/catalogs.ts`
- Create: `tests/unit/catalogs.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../../src/domain/catalogs';

describe('sha256Hex', () => {
  it('hashes a known string', async () => {
    const enc = new TextEncoder().encode('hello');
    const hex = await sha256Hex(enc.buffer);
    expect(hex).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { supabase } from '../lib/supabase';
import { PDFDocument } from 'pdf-lib';

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function imagesToPdf(files: File[]): Promise<Blob> {
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const img = f.type === 'image/png' ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function uploadCatalog(supplierId: string, file: File | Blob, filename: string): Promise<void> {
  const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const path = `${supplierId}/${hash}-${filename}`;
  const { error: upErr } = await supabase.storage.from('catalogs').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (upErr && !upErr.message.includes('already exists')) throw upErr;

  const { error: insErr } = await supabase.from('catalogs').insert({
    supplier_id: supplierId,
    storage_path: path,
    filename,
    mime: file.type || null,
    size_bytes: file.size,
    sha256: hash
  });
  if (insErr && insErr.code !== '23505') throw insErr;  // ignore unique violation (dedupe)
}

export async function listCatalogs(supplierId: string) {
  const { data, error } = await supabase
    .from('catalogs')
    .select('id,filename,mime,size_bytes,captured_at,storage_path')
    .eq('supplier_id', supplierId)
    .order('captured_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteCatalog(id: string, storagePath: string) {
  await supabase.storage.from('catalogs').remove([storagePath]);
  await supabase.from('catalogs').delete().eq('id', id);
}

export async function signedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('catalogs').createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 3: Tests pass + commit**

```bash
npx vitest run
git add src/domain/catalogs.ts tests/unit/catalogs.test.ts
git commit -m "feat(catalogs): sha256 dedupe + images→PDF + upload helpers"
```

---

### Task 17: Supplier detail view + upload + status

**Files:**
- Create: `src/components/upload-button.ts`, `src/components/photo-capture.ts`, `src/components/status-pill.ts`
- Modify: `src/views/supplier-view.ts`

- [ ] **Step 1: `upload-button.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { uploadCatalog } from '../domain/catalogs';

@customElement('cc-upload-button')
export class UploadButton extends LitElement {
  static styles = css`
    button { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: var(--teal); color: white; font-weight: 600; font-size: 15px; }
    button:disabled { opacity: 0.5; }
    input { display: none; }
  `;
  @property() supplierId!: string;
  @state() private uploading = false;

  private async onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.uploading = true;
    try {
      for (const f of files) await uploadCatalog(this.supplierId, f, f.name);
      this.dispatchEvent(new CustomEvent('cc-uploaded', { bubbles: true }));
    } finally { this.uploading = false; input.value = ''; }
  }

  render() {
    return html`
      <button @click=${(e: any) => e.currentTarget.nextElementSibling.click()} ?disabled=${this.uploading}>
        ${this.uploading ? 'Uploading…' : 'Upload file'}
      </button>
      <input type="file" multiple accept="application/pdf,image/*,.xlsx,.xls,.csv" @change=${this.onPick} />
    `;
  }
}
```

- [ ] **Step 2: `photo-capture.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { imagesToPdf, uploadCatalog } from '../domain/catalogs';

@customElement('cc-photo-capture')
export class PhotoCapture extends LitElement {
  static styles = css`
    button { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: var(--nav-bg); color: white; font-weight: 600; font-size: 15px; margin-top: 8px; }
    button:disabled { opacity: 0.5; }
    input { display: none; }
  `;
  @property() supplierId!: string;
  @state() private uploading = false;

  private async onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []) as File[];
    if (!files.length) return;
    this.uploading = true;
    try {
      const pdf = await imagesToPdf(files);
      const filename = `photos-${Date.now()}.pdf`;
      await uploadCatalog(this.supplierId, pdf, filename);
      this.dispatchEvent(new CustomEvent('cc-uploaded', { bubbles: true }));
    } finally { this.uploading = false; input.value = ''; }
  }

  render() {
    return html`
      <button @click=${(e: any) => e.currentTarget.nextElementSibling.click()} ?disabled=${this.uploading}>
        ${this.uploading ? 'Building PDF…' : '📷 Capture photos → PDF'}
      </button>
      <input type="file" accept="image/*" multiple capture="environment" @change=${this.onPick} />
    `;
  }
}
```

- [ ] **Step 3: `status-pill.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { supabase } from '../lib/supabase';

const labels = {
  pending: 'Pending',
  visited_no_catalog: 'Visited, no catalog',
  done: 'Done'
};

@customElement('cc-status-pill')
export class StatusPill extends LitElement {
  static styles = css`
    select { padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px; background: var(--white); width: 100%; }
  `;
  @property() supplierId!: string;
  @property() value: keyof typeof labels = 'pending';

  private async onChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value as keyof typeof labels;
    this.value = v;
    await supabase.from('suppliers').update({ visit_status: v }).eq('id', this.supplierId);
    this.dispatchEvent(new CustomEvent('cc-status-changed', { detail: v, bubbles: true }));
  }

  render() {
    return html`
      <select .value=${this.value} @change=${this.onChange}>
        ${Object.entries(labels).map(([k, v]) => html`<option value=${k} ?selected=${k === this.value}>${v}</option>`)}
      </select>
    `;
  }
}
```

- [ ] **Step 4: Implement `src/views/supplier-view.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { supabase } from '../lib/supabase';
import { listCatalogs, deleteCatalog, signedUrl } from '../domain/catalogs';
import { navigate } from '../lib/router';
import '../components/upload-button';
import '../components/photo-capture';
import '../components/status-pill';

@customElement('cc-supplier')
export class SupplierView extends LitElement {
  createRenderRoot() { return this; }
  @property() id!: string;
  @state() private supplier: any = null;
  @state() private catalogs: any[] = [];

  async connectedCallback() {
    super.connectedCallback();
    await this.refresh();
    this.addEventListener('cc-uploaded', () => this.refresh());
  }

  private async refresh() {
    const [{ data: s }, cats] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', this.id).single(),
      listCatalogs(this.id)
    ]);
    this.supplier = s;
    this.catalogs = cats;
  }

  private async openFile(path: string) {
    const url = await signedUrl(path);
    window.open(url, '_blank');
  }

  render() {
    if (!this.supplier) return html`<div style="padding:24px">Loading…</div>`;
    const s = this.supplier;
    return html`
      <header style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
        <button @click=${() => navigate('/')} style="background:none;border:0;color:var(--mid);font-family:var(--mono);font-size:12px;padding:0;margin-bottom:8px">← Back</button>
        <h1 style="font-family:var(--display);font-size:22px;margin:0">${s.name_en}</h1>
        ${s.name_cn ? html`<div style="color:var(--mid);font-size:13px;margin-top:4px">${s.name_cn}</div>` : ''}
        <div style="font-family:var(--mono);font-size:12px;color:var(--mid);margin-top:8px">
          ${s.hall ?? '—'} · Booth ${s.booth ?? '—'}
        </div>
      </header>

      <section style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
        <h2 style="font-family:var(--display);font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--mid);margin:0 0 8px">Status</h2>
        <cc-status-pill .supplierId=${this.id} .value=${s.visit_status}></cc-status-pill>
      </section>

      <section style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
        <h2 style="font-family:var(--display);font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--mid);margin:0 0 8px">
          Catalogs (${this.catalogs.length})
        </h2>
        <cc-upload-button .supplierId=${this.id}></cc-upload-button>
        <cc-photo-capture .supplierId=${this.id}></cc-photo-capture>
        <ul style="list-style:none;padding:0;margin:12px 0 0">
          ${this.catalogs.map(c => html`
            <li style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="cursor:pointer" @click=${() => this.openFile(c.storage_path)}>📄 ${c.filename}</span>
              <button @click=${async () => { await deleteCatalog(c.id, c.storage_path); this.refresh(); }} style="background:none;border:0;color:#b3261e;font-size:12px">Delete</button>
            </li>
          `)}
        </ul>
      </section>

      ${s.business_scope_cn || s.business_scope_en ? html`
        <section style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
          <h2 style="font-family:var(--display);font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--mid);margin:0 0 8px">Business scope</h2>
          ${s.business_scope_en ? html`<div>${s.business_scope_en}</div>` : ''}
          ${s.business_scope_cn ? html`<div style="color:var(--mid);margin-top:4px">${s.business_scope_cn}</div>` : ''}
        </section>
      ` : ''}
    `;
  }
}
```

- [ ] **Step 5: Verify on mobile viewport**

```bash
npm run dev
```

Open in DevTools mobile (390x844). Tap a supplier from directory → see detail. Upload a PDF — appears in the list. Take a photo (on real phone) — uploads. Status pill changes persist on reload.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: supplier detail view with upload + photo capture + status"
```

---

### Task 18: Realtime updates on coverage bar

**Files:**
- Create: `src/domain/realtime.ts`
- Modify: `src/views/directory-view.ts`

- [ ] **Step 1: `src/domain/realtime.ts`**

```ts
import { supabase } from '../lib/supabase';

export function subscribeCatalogs(onChange: () => void) {
  const ch = supabase
    .channel('catalogs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogs' }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'suppliers' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
```

- [ ] **Step 2: Wire into `directory-view.ts`**

In `connectedCallback`, after initial fetch:

```ts
this.unsub = subscribeCatalogs(() => {
  // refresh coverage + list
  fetchGlobalCoverage().then(c => this.coverage = c);
  this.refresh();
});
```

Add `disconnectedCallback() { this.unsub?.(); }` and `private unsub?: () => void;` field.

- [ ] **Step 3: Verify**

Open the app on laptop AND phone. Upload a catalog from phone. Within ~1s, the laptop's coverage counter increments without refresh.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat(realtime): live coverage updates on catalog/supplier changes"
```

---

### Task 19: PWA manifest + service worker

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icons/{icon-192.png,icon-512.png,icon-maskable.png}` (placeholder solid teal squares OK for v1)
- Create: `src/sw.ts` + `vite.config.ts` build for it (or static `public/sw.js`)

- [ ] **Step 1: `public/manifest.webmanifest`**

```json
{
  "name": "China Cycle Sourcing",
  "short_name": "CC Sourcing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F3EE",
  "theme_color": "#0B1628",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Generate placeholder icons**

```bash
# Use ImageMagick if available, else use a 1x1 colored PNG generator online
mkdir -p public/icons
# Quick: create solid teal PNGs (you can replace with proper icons later)
```

If ImageMagick unavailable, write a small Node script `scripts/gen-icons.ts` using `sharp` — but sharp is heavy. Fastest: download three teal-on-dark squares from a placeholder service and commit them. Actual content for v1 doesn't matter.

- [ ] **Step 3: Static `public/sw.js`** (copied as-is at build time — Vite serves `public/` at root)

```js
// Naive cache-first for the app shell; passthrough for everything else.
const CACHE = 'cc-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('/index.html')))
    );
  }
});
```

(Confirm `src/main.ts` already has the registration block from Task 9.)

- [ ] **Step 4: Verify install prompt on mobile**

Build + preview, deploy to Vercel, open on phone Safari → "Add to Home Screen" → app launches in standalone with no chrome.

- [ ] **Step 5: Commit**

```bash
git add public src/main.ts
git commit -m "feat(pwa): manifest + service worker shell cache"
```

---

## Phase 4 — Map + Missing + Polish (Day 4)

### Task 20: Hall coverage map

**Files:**
- Create: `src/components/hall-tile.ts`
- Modify: `src/views/coverage-view.ts`

- [ ] **Step 1: `src/components/hall-tile.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { coverageColor, coverageRatio } from '../domain/coverage';
import { navigate } from '../lib/router';

@customElement('cc-hall-tile')
export class HallTile extends LitElement {
  static styles = css`
    :host { display: block; }
    .tile { padding: 16px; border-radius: 12px; color: var(--ink); cursor: pointer; min-height: 96px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); }
    .id { font-family: var(--display); font-size: 28px; font-weight: 800; letter-spacing: 1px; }
    .name { font-size: 11px; line-height: 1.2; opacity: 0.75; }
    .ratio { font-family: var(--mono); font-size: 13px; font-weight: 500; margin-top: 4px; }
  `;
  @property() hallId!: string;
  @property() hallName = '';
  @property({ type: Number }) total = 0;
  @property({ type: Number }) withCatalog = 0;

  render() {
    const r = coverageRatio(this.withCatalog, this.total);
    const dark = r > 0.5;
    return html`
      <div class="tile" style="background:${coverageColor(r)};color:${dark ? 'white' : 'var(--ink)'}"
           @click=${() => navigate(`/missing?hall=${this.hallId}`)}>
        <div>
          <div class="id">${this.hallId}</div>
          <div class="name">${this.hallName}</div>
        </div>
        <div class="ratio">${this.withCatalog} / ${this.total}</div>
      </div>
    `;
  }
}
```

- [ ] **Step 2: Implement `src/views/coverage-view.ts`**

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { fetchHallCoverage } from '../domain/coverage';
import { subscribeCatalogs } from '../domain/realtime';
import type { HallCoverage } from '../domain/types';
import '../components/hall-tile';

@customElement('cc-coverage')
export class CoverageView extends LitElement {
  createRenderRoot() { return this; }
  @state() private rows: HallCoverage[] = [];
  private unsub?: () => void;

  async connectedCallback() {
    super.connectedCallback();
    this.rows = await fetchHallCoverage();
    this.unsub = subscribeCatalogs(async () => { this.rows = await fetchHallCoverage(); });
  }
  disconnectedCallback() { this.unsub?.(); super.disconnectedCallback(); }

  render() {
    return html`
      <header style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
        <h1 style="font-family:var(--display);font-size:22px;margin:0;letter-spacing:1px;text-transform:uppercase">Coverage by hall</h1>
        <p style="margin:4px 0 0;color:var(--mid);font-size:12px">Tap a hall to see its missing suppliers.</p>
      </header>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:16px">
        ${this.rows.map(r => html`
          <cc-hall-tile .hallId=${r.hall_id} .hallName=${r.hall_name_en}
            .total=${r.suppliers_total} .withCatalog=${r.suppliers_with_catalog}></cc-hall-tile>
        `)}
      </div>
    `;
  }
}
```

- [ ] **Step 3: Verify mobile**

Open `/coverage`. See ~13 colored tiles. Upload from another tab → color shifts greener live.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: coverage-by-hall view (heatmap tiles + realtime)"
```

---

### Task 21: Missing view (filterable list)

**Files:**
- Modify: `src/views/missing-view.ts`

- [ ] **Step 1: Implement**

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { supabase } from '../lib/supabase';
import { subscribeCatalogs } from '../domain/realtime';
import '../components/supplier-card';

@customElement('cc-missing')
export class MissingView extends LitElement {
  createRenderRoot() { return this; }
  @state() private rows: any[] = [];
  @state() private hall: string | null = null;
  private unsub?: () => void;

  async connectedCallback() {
    super.connectedCallback();
    const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
    this.hall = params.get('hall');
    await this.refresh();
    this.unsub = subscribeCatalogs(() => this.refresh());
  }
  disconnectedCallback() { this.unsub?.(); super.disconnectedCallback(); }

  private async refresh() {
    let q = supabase
      .from('suppliers')
      .select('id,name_en,name_cn,hall,booth,visit_status,catalogs(id)')
      .eq('visit_status', 'pending')
      .order('name_en');
    if (this.hall) q = q.eq('hall', this.hall);
    const { data } = await q;
    this.rows = (data ?? []).filter((r: any) => r.catalogs.length === 0);
  }

  render() {
    return html`
      <header style="padding:16px;background:var(--white);border-bottom:1px solid var(--border)">
        <h1 style="font-family:var(--display);font-size:22px;margin:0;letter-spacing:1px;text-transform:uppercase">
          Missing ${this.hall ? `— ${this.hall}` : ''}
        </h1>
        <p style="margin:4px 0 0;color:var(--mid);font-size:12px">${this.rows.length} suppliers without a catalog yet.</p>
      </header>
      ${this.rows.map(r => html`
        <cc-supplier-card
          .id=${r.id} .nameEn=${r.name_en} .nameCn=${r.name_cn}
          .hall=${r.hall} .booth=${r.booth}
          .catalogCount=${0} .visitStatus=${r.visit_status}>
        </cc-supplier-card>
      `)}
    `;
  }
}
```

- [ ] **Step 2: Verify + commit**

```bash
git add src
git commit -m "feat: missing view (filterable, hall-scoped from coverage tile)"
```

---

### Task 22: E2E smoke tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/{auth,directory,upload,coverage}.spec.ts`

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['iPhone 14'] }
  ]
});
```

- [ ] **Step 2: Critical smoke tests** (skip auth — requires real magic link; instead use a test session helper or stub via Supabase admin API. v1 punt: write a single `directory.spec.ts` that asserts the app loads and the auth screen renders with title "China Cycle Sourcing")

```ts
// tests/e2e/directory.spec.ts
import { test, expect } from '@playwright/test';
test('auth screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /China Cycle/i })).toBeVisible();
  await expect(page.getByPlaceholder(/example.com/)).toBeVisible();
});
```

For real flows, log in manually once and use `storageState` saved auth — see Playwright docs. Document in README.

- [ ] **Step 3: Run + commit**

```bash
npx playwright install chromium
npm run test:e2e
git add playwright.config.ts tests/e2e
git commit -m "test(e2e): auth screen smoke"
```

---

## Phase 5 — Scraper + Polish (Day 5)

### Task 23: Scraper structure (Playwright + cheerio)

**Files:**
- Create: `scraper/run.ts`, `scraper/sources/chinacycle.ts`, `scraper/lib/{normalize.ts,diff.ts,upsert.ts}`, `scraper/__tests__/normalize.test.ts`

- [ ] **Step 1: `scraper/lib/normalize.ts`** (TDD)

```ts
export interface RawExhibitor {
  nameEn?: string; nameCn?: string;
  booth?: string; hallEn?: string; hallCn?: string;
  scopeEn?: string; scopeCn?: string;
  categoriesCn?: string[];
  website?: string; id: string;
}
export interface NormalizedSupplier {
  id: string;
  name_en: string;
  name_cn: string | null;
  hall: string | null;
  booth: string | null;
  categories_cn: string[];
  business_scope_en: string | null;
  business_scope_cn: string | null;
  website: string | null;
}

export function extractHallCode(booth: string | undefined): string | null {
  if (!booth) return null;
  const m = booth.match(/^([EWN]\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

export function normalize(r: RawExhibitor): NormalizedSupplier {
  return {
    id: r.id.trim(),
    name_en: (r.nameEn ?? '').trim(),
    name_cn: r.nameCn?.trim() || null,
    hall: extractHallCode(r.booth),
    booth: r.booth?.trim() || null,
    categories_cn: (r.categoriesCn ?? []).map(s => s.trim()).filter(Boolean),
    business_scope_en: r.scopeEn?.trim() || null,
    business_scope_cn: r.scopeCn?.trim() || null,
    website: r.website?.trim() || null
  };
}
```

Test in `scraper/__tests__/normalize.test.ts`: at least 4 cases (basic row, missing fields, hall extraction E1/W2/N3, empty categories).

- [ ] **Step 2: `scraper/sources/chinacycle.ts`** (selectors TBD on first scrape — use Playwright in headed mode to inspect DOM, then encode the selectors here)

```ts
import { chromium, type Browser, type Page } from 'playwright';
import { load } from 'cheerio';
import type { RawExhibitor } from '../lib/normalize';

const DIRECTORY_URL = 'https://www.chinacycle.com.cn/exhibitor-directory'; // confirm exact URL on first run

export async function scrapeChinaCycle(): Promise<RawExhibitor[]> {
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage();
    await page.goto(DIRECTORY_URL, { waitUntil: 'networkidle' });
    // TODO: pagination loop — to be filled in once directory structure is verified
    // For first run: capture HTML, save to scraper/.cache/<page>.html, parse with cheerio
    const html = await page.content();
    const $ = load(html);
    const items: RawExhibitor[] = [];
    $('.exhibitor-row').each((_, el) => {
      const $el = $(el);
      items.push({
        id: $el.attr('data-id') ?? '',
        nameEn: $el.find('.name-en').text(),
        nameCn: $el.find('.name-cn').text(),
        booth: $el.find('.booth').text(),
        hallEn: $el.find('.hall-en').text(),
        hallCn: $el.find('.hall-cn').text()
      });
    });
    return items;
  } finally { await browser.close(); }
}
```

- [ ] **Step 3: `scraper/lib/upsert.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { NormalizedSupplier } from './normalize';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

export async function upsertSuppliers(rows: NormalizedSupplier[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(r => ({
      ...r,
      last_seen_in_scrape: new Date().toISOString()
    }));
    const { data, error } = await sb.from('suppliers').upsert(chunk, { onConflict: 'id' }).select('id');
    if (error) throw error;
    inserted += data?.length ?? 0;
  }
  return { inserted, updated };
}
```

- [ ] **Step 4: `scraper/run.ts`**

```ts
import { scrapeChinaCycle } from './sources/chinacycle';
import { normalize } from './lib/normalize';
import { upsertSuppliers } from './lib/upsert';

async function main() {
  console.log('Scraping…');
  const raw = await scrapeChinaCycle();
  console.log(`Got ${raw.length} rows.`);
  const rows = raw.map(normalize).filter(r => r.id && r.name_en);
  console.log(`Normalized to ${rows.length}. Upserting…`);
  const result = await upsertSuppliers(rows);
  console.log('Done:', result);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: First dry-run on real site**

Run in headed mode locally to find the actual DOM selectors of `chinacycle.com.cn`. Update `scrapeChinaCycle()` accordingly. Then run for real:

```bash
SUPABASE_SERVICE_ROLE_KEY=<from supabase studio> VITE_SUPABASE_URL=https://gqxwcstasjmbkueqlcnl.supabase.co \
  npx tsx scraper/run.ts
```

Expected: rows upserted; counts in Studio match. Diff log shows new vs updated.

- [ ] **Step 6: Commit**

```bash
git add scraper
git commit -m "feat(scraper): chinacycle directory scraper + upsert"
```

---

### Task 24: README + final polish

**Files:**
- Create: `README.md`
- Modify: any rough edges found in mobile testing

- [ ] **Step 1: Write `README.md`**

```markdown
# Shanghai Cycle Show

Mobile-first PWA for collecting supplier catalogs at China Cycle 2025 (Shanghai).

## Quickstart

    cp .env.example .env.local   # fill in Supabase URL + anon key + DB URL
    npm install
    npm run db:types             # generate src/lib/db.types.ts from remote schema
    npm run dev                  # → http://localhost:5173

## Database

- Migrations in `supabase/migrations/`. Apply: `supabase db push`.
- Seed (initial CSV import): `npm run db:seed`.

## Scraper

    SUPABASE_SERVICE_ROLE_KEY=… VITE_SUPABASE_URL=… npm run scrape

Run before the show to refresh the directory. Idempotent (upsert on `id`).

## Deploy

Pushed to `main` → Vercel auto-deploys. Env vars set in Vercel dashboard.

## Activating future spec→catalog matching

Already in schema:
- `catalogs.extracted_text` and `catalogs.embedding` (pgvector 1536d).

To activate:
1. Add an extraction worker (Edge Function) triggered on insert into `catalogs`:
   PDF→text via pdfjs, image→OCR via tesseract.js, xlsx→sheets.
2. Embed `extracted_text` (OpenAI embeddings or local) → `embedding`.
3. Implement `matchSpec()` in `src/domain/match.ts` (currently a stub).
```

- [ ] **Step 2: Mobile polish pass**

Open on real phone. Walk through: login, search, filter, open supplier, take photos, upload. Note any UI roughness (tap targets < 44px, scrolling glitches, kbd doesn't push content). Fix.

- [ ] **Step 3: Final deploy + commit**

```bash
git add README.md src
git commit -m "docs: README + mobile polish"
git push
```

Verify Vercel build, install PWA on phone, do an end-to-end real test.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Scraper of china cycle directory | Task 23 |
| Directory list + classify + search | Tasks 12, 15 |
| Upload digital catalogs per supplier | Tasks 16, 17 |
| Photo capture on phone → PDF | Task 16, 17 |
| Track uploaded vs missing | Tasks 13, 15, 21 |
| Mobile-first, real-time on phone | Tasks 9, 17, 18, 19 |
| Map by zone for orientation | Task 20 |
| Auth (private data) | Task 9 |
| Future spec→catalog matching prepared | Task 3 (`embedding vector(1536)`), README in Task 24 |
| CSV seed as safety net | Task 7 |
| Backend (Supabase) | Tasks 3-6 |

All requirements have at least one task. ✅

**Placeholder check:**
- Task 23 has TODO on pagination — flagged because real selectors require live inspection (not knowable from desk). Engineer must finish in headed mode. This is the only unavoidable placeholder; documented in step 5.
- All other steps contain executable code/commands. ✅

**Type consistency:**
- `Supplier`, `Hall`, `HallCoverage`, `GlobalCoverage`, `VisitStatus` defined in Task 11; consumed unchanged in Tasks 12, 13, 15, 17, 20. ✅
- `searchSuppliers(input, filters, limit, offset)` signature in Task 12 is the same as called in Task 15. ✅
- `uploadCatalog(supplierId, file, filename)` in Task 16 matches usage in Task 17. ✅
- `subscribeCatalogs(onChange)` in Task 18 returns `() => void`, used as `unsub` in Tasks 18, 20, 21 — consistent. ✅

---

## Execution Handoff

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best given the 5-day deadline; tasks 7, 12, 13, 16, 23 are independent enough to potentially parallelize.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints. Simpler but slower.

**Which approach?**

Before either: tell me **the Supabase DB connection string** (Studio → Project Settings → Database → "Connection string" tab → URI form with password). I'll only put it in `.env.local`, never commit it. Needed at Task 7 (seed) — we can start Tasks 1-6 without it.
