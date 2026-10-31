-- ZEKRA IA Forms Portal — çok kiracılı şema (Postgres 15+ / Supabase)
create extension if not exists pgcrypto;

create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name          text not null,
  ref_prefix    text not null check (ref_prefix ~ '^[A-Z]{2,6}$'),
  brand         jsonb not null default '{}'::jsonb,
  controller    jsonb not null default '{}'::jsonb,   -- veri sorumlusu bilgileri, aydınlatma metni, saklama süresi
  notify_emails text[] not null default '{}',
  sender_email  text,                                 -- doğrulanmış gönderici; boşsa e-posta yalnızca loglanır
  privacy_ready boolean not null default false,       -- gerçek veri toplamadan önce true olmalı
  demo_days     int not null default 30,
  license_status text not null default 'pending' check (license_status in ('pending','active','expired','paid','suspended')),
  activated_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table forms (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  form_key    text not null,
  version     text not null,
  definition  jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, form_key, version)
);

create table users (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  email          text not null,
  name           text not null,
  role           text not null check (role in ('admin','sales','viewer')),
  password_hash  text not null,
  active         boolean not null default true,
  failed_logins  int not null default 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  unique (tenant_id, email)
);

-- Genel paylaşım bağlantıları (WhatsApp / e-posta / QR). Token yalnızca hash olarak saklanır.
create table share_links (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  token_hash   text not null unique,
  token_hint   text not null,            -- son 4 karakter, listede tanımak için
  label        text not null,
  sales_rep_id uuid references users(id) on delete set null,
  created_by   uuid references users(id) on delete set null,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  uses         int not null default 0,
  created_at   timestamptz not null default now()
);

create table ref_counters (
  tenant_id uuid not null references tenants(id) on delete cascade,
  year      int not null,
  last_no   int not null default 0,
  primary key (tenant_id, year)
);

create table applications (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  form_id          uuid not null references forms(id),
  ref_no           text unique,                       -- gönderimde atanır: VET-2026-0001
  status           text not null default 'draft'
                   check (status in ('draft','submitted','needs_info','in_review','approved','rejected','completed')),
  share_link_id    uuid references share_links(id) on delete set null,
  sales_rep_id     uuid references users(id) on delete set null,
  company_name     text,
  country          text,
  contact_email    text,
  data             jsonb not null default '{}'::jsonb,  -- müşteri beyanı (hassas alanlar hariç)
  sensitive_enc    text,                                -- AES-256-GCM: IBAN, T.C. kimlik no
  internal         jsonb not null default '{}'::jsonb,  -- bölüm 8 + iç kullanım; müşteriye asla dönmez
  consent          jsonb not null default '{}'::jsonb,
  edit_token_hash  text unique,
  edit_token_expires_at timestamptz,
  editable         boolean not null default true,
  info_request     text,
  is_test          boolean not null default false,
  created_ip       inet,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  decided_at       timestamptz,
  anonymized_at    timestamptz
);
create index applications_tenant_status on applications (tenant_id, status, created_at desc);
create index applications_tenant_company on applications (tenant_id, lower(company_name));

create table application_events (
  id             bigserial primary key,
  tenant_id      uuid not null references tenants(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  at             timestamptz not null default now(),
  actor_type     text not null check (actor_type in ('customer','user','system')),
  actor_id       uuid,
  actor_label    text,
  action         text not null,
  details        jsonb not null default '{}'::jsonb,
  ip             inet
);
create index application_events_app on application_events (application_id, at);
create index application_events_tenant on application_events (tenant_id, action, at);

-- Supabase: tablolar yalnızca sunucu (service role) üzerinden erişilir. anon/authenticated rollerine erişim kapalı.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
  end if;
end $$;
alter table tenants enable row level security;
alter table forms enable row level security;
alter table users enable row level security;
alter table share_links enable row level security;
alter table ref_counters enable row level security;
alter table applications enable row level security;
alter table application_events enable row level security;
