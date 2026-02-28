-- ══════════════════════════════════════════════════════════════
-- CbX0 St0r3 — Schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- ══════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- CATÉGORIES
-- ─────────────────────────────────────────
create table if not exists categories (
  id          text primary key,
  name        text not null,
  emoji       text default '🌿',
  color       text default '#7C3AED',
  created_at  timestamptz default now()
);

insert into categories (id, name, emoji, color) values
  ('fleur',  'Fleurs',  '🌸', '#7C3AED'),
  ('resine',  'Résines', '🍫', '#4F46E5')
on conflict (id) do nothing;

-- ─────────────────────────────────────────
-- PRODUITS
-- ─────────────────────────────────────────
create table if not exists products (
  id          bigint primary key,
  emoji       text default '🌿',
  name        text not null,
  cat_id      text references categories(id),
  taux        text default '10% CBD',
  thc         text default '< 0,3%',
  origine     text default '',
  mode        text default '',
  desc        text default '',
  stock       integer default 0,
  badge       text default '',
  tiers       jsonb default '[]',
  images      jsonb default '[]',
  lab_pdf_url text,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────
-- UTILISATEURS
-- ─────────────────────────────────────────
create table if not exists users (
  id            bigint primary key generated always as identity,
  name          text not null,
  email         text unique not null,
  password_hash text not null,
  role          text default 'user' check (role in ('user','admin')),
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- COMMANDES
-- ─────────────────────────────────────────
create table if not exists orders (
  id          bigint primary key,
  user_email  text not null,
  user_id     bigint references users(id) on delete set null,
  items       jsonb not null default '[]',
  total       numeric(10,2) not null,
  promo       text,
  method      text default 'livraison',
  date        text,
  created_at  timestamptz default now()
);

create index if not exists orders_user_email_idx on orders(user_email);

-- ─────────────────────────────────────────
-- CODES PROMO
-- ─────────────────────────────────────────
create table if not exists promos (
  code       text primary key,
  discount   integer not null check (discount between 1 and 100),
  uses       integer default 0,
  max_uses   integer default 0,
  active     boolean default true,
  created_at timestamptz default now()
);

insert into promos (code, discount, uses, max_uses, active) values
  ('BIENVENUE10', 10, 0, 0, true),
  ('CBD15',       15, 0, 50, true)
on conflict (code) do nothing;

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
create table if not exists notifications (
  id            bigint primary key,
  to_type       text default 'all' check (to_type in ('all','selected')),
  to_ids        jsonb,
  subject       text not null,
  message       text not null,
  read_by       jsonb default '[]',
  created_date  text,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- PARAMÈTRES (clé/valeur)
-- ─────────────────────────────────────────
create table if not exists settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- Valeur CC par défaut
insert into settings (key, value) values (
  'cc',
  '{
    "enabled": false,
    "address": "",
    "hours": {
      "lun": {"open":"10:00","close":"19:00","active":true},
      "mar": {"open":"10:00","close":"19:00","active":true},
      "mer": {"open":"10:00","close":"20:00","active":true},
      "jeu": {"open":"10:00","close":"19:00","active":true},
      "ven": {"open":"10:00","close":"20:00","active":true},
      "sam": {"open":"10:00","close":"18:00","active":true},
      "dim": {"open":"10:00","close":"12:00","active":false}
    }
  }'::jsonb
) on conflict (key) do nothing;

-- ─────────────────────────────────────────
-- FONCTIONS RPC (appelées depuis /api/orders)
-- ─────────────────────────────────────────

-- Décrémenter le stock d'un produit (min 0)
create or replace function decrement_stock(product_id bigint, quantity integer)
returns void as $$
begin
  update products
  set stock = greatest(0, stock - quantity)
  where id = product_id;
end;
$$ language plpgsql security definer;

-- Incrémenter le compteur d'utilisations d'un promo
create or replace function increment_promo_uses(promo_code text)
returns void as $$
begin
  update promos set uses = uses + 1 where code = promo_code;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────
-- On utilise la SERVICE_ROLE_KEY côté API → bypass RLS automatique.
-- On active RLS sur les tables sensibles pour bloquer les accès directs.

alter table users      enable row level security;
alter table orders     enable row level security;
alter table settings   enable row level security;

-- Tout accès public bloqué (seul le service role passe)
create policy "deny_public" on users     for all to anon using (false);
create policy "deny_public" on orders    for all to anon using (false);
create policy "deny_public" on settings  for all to anon using (false);

-- Produits, catégories, promos, notifs : lecture publique OK
alter table products       enable row level security;
alter table categories     enable row level security;
alter table promos         enable row level security;
alter table notifications  enable row level security;

create policy "public_read" on products      for select to anon using (true);
create policy "public_read" on categories    for select to anon using (true);
create policy "public_read" on promos        for select to anon using (true);
create policy "public_read" on notifications for select to anon using (true);

create policy "deny_write"  on products      for all to anon using (false);
create policy "deny_write"  on categories    for all to anon using (false);
create policy "deny_write"  on promos        for all to anon using (false);
create policy "deny_write"  on notifications for all to anon using (false);

-- ══════════════════════════════════════════════════════════════
-- FIN DU SCHÉMA
-- ══════════════════════════════════════════════════════════════
