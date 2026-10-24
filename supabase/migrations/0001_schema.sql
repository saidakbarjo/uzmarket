-- UZMARKET · миграция 0001: схема данных
-- Денежные значения — целые суммы в UZS (bigint), без float.
-- Секретов в миграциях нет. Права доступа (RLS) — в 0002_security.sql.
-- gen_random_uuid() встроена в PostgreSQL 13+, расширения не требуются.

-- ───────────── служебное: updated_at ─────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────── profiles ─────────────
-- Профиль публичный (e-mail хранится только в auth.users и сюда не копируется).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null,
  role          text not null default 'user',
  is_seller     boolean not null default false,
  verified      boolean not null default false,
  blocked       boolean not null default false,
  about         text not null default '',
  rating_avg    numeric(2,1) not null default 0,
  reviews_count integer not null default 0,
  sales_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 24),
  constraint profiles_username_chars check (username ~ '^[[:alnum:]_.-]+$'),
  constraint profiles_role_valid check (role in ('user', 'admin')),
  constraint profiles_about_len check (char_length(about) <= 300),
  constraint profiles_rating_range check (rating_avg between 0 and 5),
  constraint profiles_counts_nonneg check (reviews_count >= 0 and sales_count >= 0)
);
create unique index profiles_username_lower_uidx on public.profiles (lower(username));
create index profiles_role_idx on public.profiles (role) where role <> 'user';
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ───────────── categories ─────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  name_uz     text not null,
  description text not null default '',
  icon        text not null default 'Package',
  sort_order  integer not null default 0,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ───────────── listings ─────────────
create table public.listings (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references public.profiles (id) on delete restrict,
  category_id       uuid not null references public.categories (id) on delete restrict,
  title             text not null,
  description       text not null,
  price_uzs         bigint not null,
  status            text not null default 'active',
  delivery_method   text not null,
  delivery_days     integer not null default 0,
  refund_terms      text not null,
  fulfillment_terms text not null,
  image_hue         smallint,
  views             integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint listings_title_len check (char_length(title) between 5 and 120),
  constraint listings_description_len check (char_length(description) between 20 and 3000),
  constraint listings_price_range check (price_uzs between 1000 and 500000000),
  constraint listings_status_valid check (status in ('active', 'paused', 'blocked')),
  constraint listings_delivery_valid check (delivery_method in ('chat', 'key', 'manual', 'file')),
  constraint listings_days_range check (delivery_days between 0 and 60),
  constraint listings_refund_len check (char_length(refund_terms) between 10 and 1000),
  constraint listings_fulfillment_len check (char_length(fulfillment_terms) between 10 and 1000),
  constraint listings_hue_range check (image_hue is null or image_hue between 0 and 359),
  constraint listings_views_nonneg check (views >= 0)
);
create index listings_catalog_idx on public.listings (category_id, status, created_at desc);
create index listings_seller_idx on public.listings (seller_id);
create index listings_price_idx on public.listings (price_uzs) where status = 'active';
create index listings_created_idx on public.listings (created_at desc) where status = 'active';
create index listings_search_idx on public.listings
  using gin (to_tsvector('russian', title || ' ' || description));
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create table public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  alt          text not null default '',
  position     smallint not null default 0,
  created_at   timestamptz not null default now(),
  constraint listing_images_position_range check (position between 0 and 9),
  constraint listing_images_path_len check (char_length(storage_path) between 1 and 300),
  unique (listing_id, position)
);
create index listing_images_listing_idx on public.listing_images (listing_id);

-- ───────────── orders ─────────────
create sequence public.order_number_seq start with 100300;

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  number        bigint not null unique default nextval('public.order_number_seq'),
  listing_id    uuid not null references public.listings (id) on delete restrict,
  listing_title text not null,                        -- снимок названия на момент заказа
  buyer_id      uuid not null references public.profiles (id) on delete restrict,
  seller_id     uuid not null references public.profiles (id) on delete restrict,
  price_uzs     bigint not null,                      -- снимок цены; после создания не меняется
  fee_uzs       bigint not null,                      -- комиссия площадки
  status        text not null default 'pending_payment',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint orders_price_positive check (price_uzs > 0),
  constraint orders_fee_range check (fee_uzs >= 0 and fee_uzs <= price_uzs),
  constraint orders_parties_differ check (buyer_id <> seller_id),
  constraint orders_status_valid check (status in (
    'pending_payment', 'paid', 'in_progress', 'delivered',
    'completed', 'disputed', 'cancelled', 'refunded'))
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_listing_idx on public.orders (listing_id);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     text not null,
  actor_id   uuid references public.profiles (id) on delete set null, -- null = система
  note       text not null default '',
  created_at timestamptz not null default now(),
  constraint order_events_status_valid check (status in (
    'pending_payment', 'paid', 'in_progress', 'delivered',
    'completed', 'disputed', 'cancelled', 'refunded'))
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.order_messages (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null, -- null = система
  body       text not null,
  created_at timestamptz not null default now(),
  constraint order_messages_len check (char_length(body) between 1 and 1000)
);
create index order_messages_order_idx on public.order_messages (order_id, created_at);

-- ───────────── payments ─────────────
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete restrict,
  provider        text not null,                      -- 'demo' сейчас; реальный провайдер — позже
  provider_ref    text not null,                      -- идентификатор операции у провайдера
  idempotency_key text not null unique,               -- защита от повторного создания платежа
  amount_uzs      bigint not null,
  fee_uzs         bigint not null default 0,
  status          text not null default 'created',
  is_demo         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_amount_positive check (amount_uzs > 0),
  constraint payments_fee_range check (fee_uzs >= 0 and fee_uzs <= amount_uzs),
  constraint payments_status_valid check (status in ('created', 'succeeded', 'failed', 'cancelled', 'refunded')),
  unique (provider, provider_ref)
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Журнал событий провайдера. (provider, event_id) уникален → повторное событие не применяется дважды.
create table public.payment_events (
  id              uuid primary key default gen_random_uuid(),
  payment_id      uuid references public.payments (id) on delete restrict,
  provider        text not null,
  event_id        text not null,
  type            text not null,
  payload         jsonb not null default '{}'::jsonb,
  signature_valid boolean not null,
  applied         boolean not null default false,
  received_at     timestamptz not null default now(),
  constraint payment_events_type_valid check (type in (
    'payment.succeeded', 'payment.failed', 'payment.cancelled', 'payment.refunded')),
  unique (provider, event_id)
);
create index payment_events_payment_idx on public.payment_events (payment_id);

-- ───────────── fulfillments ─────────────
create table public.fulfillments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null unique references public.orders (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id) on delete restrict,
  note         text not null,
  delivered_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint fulfillments_note_len check (char_length(note) between 3 and 2000)
);
create trigger fulfillments_set_updated_at before update on public.fulfillments
  for each row execute function public.set_updated_at();

-- ───────────── disputes ─────────────
create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete restrict,
  opened_by   uuid not null references public.profiles (id) on delete restrict,
  reason      text not null,
  description text not null,
  evidence    text not null default '',
  status      text not null default 'open',
  resolution  text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint disputes_reason_len check (char_length(reason) between 3 and 120),
  constraint disputes_description_len check (char_length(description) between 20 and 3000),
  constraint disputes_evidence_len check (char_length(evidence) <= 2000),
  constraint disputes_status_valid check (status in ('open', 'in_review', 'resolved', 'rejected'))
);
-- не более одного незакрытого спора по заказу
create unique index disputes_one_open_per_order_idx on public.disputes (order_id)
  where status in ('open', 'in_review');
create index disputes_status_idx on public.disputes (status, created_at desc);
create trigger disputes_set_updated_at before update on public.disputes
  for each row execute function public.set_updated_at();

-- ───────────── reviews ─────────────
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null unique references public.orders (id) on delete cascade, -- один отзыв на заказ
  listing_id uuid not null references public.listings (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  rating     smallint not null,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_len check (char_length(body) between 10 and 1000)
);
create index reviews_listing_idx on public.reviews (listing_id, created_at desc);
create index reviews_seller_idx on public.reviews (seller_id);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ───────────── favorites ─────────────
create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

-- ───────────── notifications ─────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  href       text,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_body_len check (char_length(body) between 1 and 500),
  constraint notifications_href_internal check (href is null or href ~ '^/[^/\\]')
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ───────────── support_tickets ─────────────
create sequence public.ticket_number_seq start with 5100;

create table public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  number      bigint not null unique default nextval('public.ticket_number_seq'),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'support',
  order_id    uuid references public.orders (id) on delete set null,
  listing_id  uuid references public.listings (id) on delete set null,
  subject     text not null,
  reason      text not null,
  description text not null,
  evidence    text not null default '',
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tickets_kind_valid check (kind in ('support', 'complaint')),
  constraint tickets_subject_len check (char_length(subject) between 5 and 120),
  constraint tickets_reason_len check (char_length(reason) between 3 and 120),
  constraint tickets_description_len check (char_length(description) between 20 and 3000),
  constraint tickets_evidence_len check (char_length(evidence) <= 2000),
  constraint tickets_status_valid check (status in ('open', 'in_review', 'resolved', 'rejected'))
);
create index tickets_author_idx on public.support_tickets (author_id, created_at desc);
create index tickets_status_idx on public.support_tickets (status, created_at desc);
create trigger tickets_set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.ticket_replies (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  is_staff   boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint ticket_replies_len check (char_length(body) between 1 and 1000)
);
create index ticket_replies_ticket_idx on public.ticket_replies (ticket_id, created_at);

-- ───────────── payouts ─────────────
-- Учёт выплат продавцам. Реальные выплаты появятся только после согласования законной модели.
create table public.payouts (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles (id) on delete restrict,
  amount_uzs   bigint not null,
  status       text not null default 'pending',
  provider     text,
  provider_ref text,
  is_demo      boolean not null default true,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint payouts_amount_positive check (amount_uzs > 0),
  constraint payouts_status_valid check (status in ('pending', 'approved', 'paid', 'failed', 'cancelled')),
  constraint payouts_paid_consistency check ((status = 'paid') = (paid_at is not null))
);
create index payouts_seller_idx on public.payouts (seller_id, created_at desc);
create trigger payouts_set_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

create table public.payout_items (
  payout_id uuid not null references public.payouts (id) on delete cascade,
  order_id  uuid not null unique references public.orders (id) on delete restrict, -- заказ входит только в одну выплату
  amount_uzs bigint not null,
  primary key (payout_id, order_id),
  constraint payout_items_amount_positive check (amount_uzs > 0)
);

-- ───────────── audit_logs ─────────────
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
