-- Demandes de catalogue (formulaire « Request catalogue »).
-- Idempotent : npm run db:migrate peut être rejoué sans risque.
create table if not exists catalogue_requests (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  email            text not null,
  company          text not null,
  name             text,
  message          text,
  supplier_id      text not null,
  supplier_name    text not null,
  hall             text,
  booth            text,
  files            jsonb not null default '[]',   -- [{ filename, category_folder }]
  session_context  jsonb not null default '{}',   -- { categories: [...], suppliers: [{ id, name }] }
  consent_text     text not null,                 -- libellé exact accepté par le demandeur
  status           text not null default 'new',
  processed_at     timestamptz,                   -- « traité le », à remplir à la main
  ip_hash          text                           -- limitation de débit (IP hachée, jamais en clair)
);
create index if not exists catalogue_requests_created_idx on catalogue_requests (created_at desc);
create index if not exists catalogue_requests_status_idx  on catalogue_requests (status, created_at desc);
create index if not exists catalogue_requests_ip_idx      on catalogue_requests (ip_hash, created_at desc);
create index if not exists catalogue_requests_email_idx   on catalogue_requests (email, created_at desc);
