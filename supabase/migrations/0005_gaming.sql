-- UZMARKET GAMING · миграция 0005: игры, продавцы, комиссия, леджер, выплаты, споры
--
-- Идея: категории верхнего уровня — ИГРЫ (список ведёт администратор); «тип товара» — поле объявления.
-- Деньги: целые суммы UZS (bigint), без float. Комиссия считается ТОЛЬКО в БД (compute_commission)
-- и фиксируется в заказе: изменение тарифа не меняет старые заказы.
--
-- ДЕМО-РЕЖИМ: леджер и заявки на вывод — это учёт внутри приложения, а НЕ реальные деньги и НЕ эскроу.
-- Реальное удержание и выплата средств требуют платёжного партнёра и законной схемы (см. README).
-- Секретных ключей в миграции нет. Администратор назначается только функцией bootstrap_first_admin
-- (service_role) или вручную через SQL.

-- ═════════════ 1. Игры (бывшие категории) ═════════════
alter table public.categories rename to games;
alter table public.listings rename column category_id to game_id;
alter table public.games rename column is_enabled to enabled;
alter table public.games add column if not exists name_en text;
alter table public.games add column if not exists abbr text not null default '';
alter table public.games add column if not exists hue smallint not null default 250;
update public.games set name_en = name where name_en is null;
alter table public.games alter column name_en set not null;
alter table public.games add constraint games_hue_range check (hue between 0 and 359);
alter table public.games add constraint games_name_len check (char_length(name) between 2 and 40);

-- Разрешены только игры из списка. Прежние несвязанные категории убираем (если на них нет объявлений).
delete from public.games g
 where g.slug not in ('cs2', 'pubg-mobile', 'pubg', 'roblox', 'minecraft', 'fortnite', 'brawl-stars', 'standoff2', 'valorant')
   and not exists (select 1 from public.listings l where l.game_id = g.id);

insert into public.games (slug, name, name_uz, name_en, description, abbr, hue, icon, sort_order) values
  ('cs2',         'CS2',                 'CS2',                 'CS2',                 'Скины и другие разрешённые игровые предметы',                'CS2', 10,  'Gamepad2', 10),
  ('pubg-mobile', 'PUBG Mobile',         'PUBG Mobile',         'PUBG Mobile',         'Игровые предметы и услуги, разрешённые правилами игры',      'PM',  50,  'Gamepad2', 20),
  ('pubg',        'PUBG: Battlegrounds', 'PUBG: Battlegrounds', 'PUBG: Battlegrounds', 'Предметы, коды и услуги для ПК-версии',                      'PB',  90,  'Gamepad2', 30),
  ('roblox',      'Roblox',              'Roblox',              'Roblox',              'Разрешённые предметы и игровые товары',                      'RB',  130, 'Gamepad2', 40),
  ('minecraft',   'Minecraft',           'Minecraft',           'Minecraft',           'Внутриигровые товары и услуги',                              'MC',  170, 'Gamepad2', 50),
  ('fortnite',    'Fortnite',            'Fortnite',            'Fortnite',            'Валюта, наборы и услуги',                                    'FN',  210, 'Gamepad2', 60),
  ('brawl-stars', 'Brawl Stars',         'Brawl Stars',         'Brawl Stars',         'Гемы, пропуск, услуги',                                      'BS',  250, 'Gamepad2', 70),
  ('standoff2',   'Standoff 2',          'Standoff 2',          'Standoff 2',          'Голда, скины и услуги',                                      'S2',  290, 'Gamepad2', 80),
  ('valorant',    'Valorant',            'Valorant',            'Valorant',            'Валюта, коды и услуги тренеров',                             'VL',  330, 'Gamepad2', 90)
on conflict (slug) do update
  set name = excluded.name, name_uz = excluded.name_uz, name_en = excluded.name_en,
      description = excluded.description, abbr = excluded.abbr, hue = excluded.hue, sort_order = excluded.sort_order;

-- ═════════════ 2. Профиль продавца ═════════════
create table public.seller_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  shop_name         text not null,
  about             text not null,
  payout_method     text not null default 'card_demo',
  accepted_rules_at timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint seller_profiles_shop_len check (char_length(shop_name) between 3 and 40),
  constraint seller_profiles_about_len check (char_length(about) between 10 and 500),
  constraint seller_profiles_method_valid check (payout_method in ('card_demo', 'bank_demo', 'wallet_future'))
);
create trigger seller_profiles_set_updated_at before update on public.seller_profiles
  for each row execute function public.set_updated_at();

-- Продавцом становятся осознанно (профиль + принятие правил), а не созданием первого объявления.
drop trigger if exists listings_mark_seller on public.listings;
drop function if exists public.mark_seller();

create or replace function public.become_seller(p_shop_name text, p_about text, p_payout_method text, p_accept_rules boolean)
returns public.seller_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  sp public.seller_profiles;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  if p_accept_rules is not true then
    raise exception 'Нужно принять правила продавца' using errcode = '23514';
  end if;
  insert into public.seller_profiles (user_id, shop_name, about, payout_method, accepted_rules_at)
  values (v_uid, trim(p_shop_name), trim(p_about), coalesce(p_payout_method, 'card_demo'), now())
  on conflict (user_id) do update
    set shop_name = excluded.shop_name, about = excluded.about, payout_method = excluded.payout_method
  returning * into sp;
  update public.profiles set is_seller = true where id = v_uid and not is_seller;
  perform public.write_audit(v_uid, 'seller.activated', 'profiles', v_uid::text, jsonb_build_object('shop', sp.shop_name));
  return sp;
end;
$$;

-- ═════════════ 3. Объявления: тип, остаток, наличие, модерация ═════════════
alter table public.listings
  add column product_type text not null default 'item',
  add column stock integer,
  add column available boolean not null default true,
  add column moderation_note text;
alter table public.listings add constraint listings_product_type_valid check (product_type in ('item', 'currency', 'service', 'key', 'other'));
alter table public.listings add constraint listings_stock_range check (stock is null or stock between 0 and 100000);
alter table public.listings add constraint listings_note_len check (moderation_note is null or char_length(moderation_note) <= 300);
alter table public.listings drop constraint listings_status_valid;
alter table public.listings add constraint listings_status_valid check (status in ('active', 'paused', 'blocked', 'pending', 'rejected'));

-- Настройки площадки (одна строка). Модерация включается только администратором.
create table public.site_settings (
  id                 boolean primary key default true check (id),
  moderation_enabled boolean not null default false,
  updated_at         timestamptz not null default now()
);
insert into public.site_settings (id) values (true);

-- Объявление: правила модерации и защита полей.
create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moderation boolean;
  v_admin boolean := auth.uid() is null or public.is_admin();
  v_content_changed boolean;
begin
  if v_admin then
    return new;
  end if;
  select moderation_enabled into v_moderation from public.site_settings;
  if tg_op = 'INSERT' then
    if new.seller_id <> auth.uid() or new.status not in ('active', 'paused', 'pending') then
      raise exception 'Недопустимые значения объявления' using errcode = '42501';
    end if;
    if not exists (select 1 from public.seller_profiles sp where sp.user_id = auth.uid()) then
      raise exception 'Сначала заполните профиль продавца' using errcode = '42501';
    end if;
    new.views := 0;
    new.moderation_note := null;
    if v_moderation then new.status := 'pending'; end if;
  else
    if old.status = 'blocked' then
      raise exception 'Объявление заблокировано модератором' using errcode = '42501';
    end if;
    if new.status = 'blocked' or new.seller_id is distinct from old.seller_id or new.views is distinct from old.views
       or new.moderation_note is distinct from old.moderation_note then
      raise exception 'Недопустимое изменение объявления' using errcode = '42501';
    end if;
    -- самостоятельно одобрить себя нельзя: из pending/rejected наружу выводит только администратор
    if old.status in ('pending', 'rejected') and new.status not in ('pending') and new.status is distinct from old.status then
      raise exception 'Статус модерации меняет администратор' using errcode = '42501';
    end if;
    v_content_changed := new.title is distinct from old.title or new.description is distinct from old.description
      or new.price_uzs is distinct from old.price_uzs or new.game_id is distinct from old.game_id
      or new.product_type is distinct from old.product_type;
    if v_moderation and v_content_changed and old.status <> 'paused' then
      new.status := 'pending';
    elsif old.status = 'rejected' and v_content_changed then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

drop policy listings_insert_own on public.listings;
drop policy listings_update_own on public.listings;
create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (seller_id = auth.uid() and status in ('active', 'paused', 'pending') and public.is_active_user());
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = auth.uid() and status <> 'blocked' and public.is_active_user())
  with check (seller_id = auth.uid() and status in ('active', 'paused', 'pending', 'rejected'));

drop policy listings_select on public.listings;
create policy listings_select on public.listings
  for select to anon, authenticated
  using (
    (status = 'active'
      and exists (select 1 from public.profiles p where p.id = seller_id and not p.blocked)
      and exists (select 1 from public.games g where g.id = game_id and g.enabled))
    or seller_id = auth.uid()
    or public.is_admin()
  );

create or replace function public.admin_moderate_listing(p_listing_id uuid, p_decision text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.listings;
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Неизвестное решение' using errcode = '22023';
  end if;
  if p_decision = 'reject' and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Укажите причину отказа' using errcode = '23514';
  end if;
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Объявление не найдено' using errcode = 'P0002';
  end if;
  update public.listings
     set status = case when p_decision = 'approve' then 'active' else 'rejected' end,
         moderation_note = case when p_decision = 'reject' then trim(p_note) else null end
   where id = l.id;
  insert into public.notifications (user_id, body, href)
  values (l.seller_id,
          case when p_decision = 'approve' then 'Объявление «' || left(l.title, 60) || '» одобрено.'
               else 'Объявление «' || left(l.title, 60) || '» отклонено: ' || trim(p_note) end,
          '/seller');
  perform public.write_audit(auth.uid(), 'listing.' || p_decision, 'listings', l.id::text, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.admin_set_moderation(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  update public.site_settings set moderation_enabled = p_enabled, updated_at = now();
  perform public.write_audit(auth.uid(), 'settings.moderation', 'site_settings', 'moderation', jsonb_build_object('enabled', p_enabled));
end;
$$;

-- ═════════════ 4. Комиссия ═════════════
create table public.commission_settings (
  id              boolean primary key default true check (id),
  default_bp      integer not null default 500,        -- 5,00 % (сотые доли процента)
  min_fee_enabled boolean not null default false,
  min_fee_uzs     bigint  not null default 1000,
  payer           text    not null default 'seller',
  min_order_uzs   bigint  not null default 1000,
  max_order_uzs   bigint  not null default 50000000,
  updated_at      timestamptz not null default now(),
  constraint commission_default_bp_range check (default_bp between 0 and 5000),
  constraint commission_min_fee_range check (min_fee_uzs between 0 and 1000000),
  constraint commission_payer_valid check (payer in ('seller', 'buyer', 'split')),
  constraint commission_limits check (min_order_uzs >= 1000 and min_order_uzs < max_order_uzs and max_order_uzs <= 500000000)
);
insert into public.commission_settings (id) values (true);

create table public.commission_rules (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null,
  game_id    uuid references public.games (id) on delete cascade,
  seller_id  uuid references public.profiles (id) on delete cascade,
  bp         integer not null,
  created_at timestamptz not null default now(),
  constraint commission_rules_scope_valid check (scope in ('game', 'seller')),
  constraint commission_rules_ref check ((scope = 'game' and game_id is not null and seller_id is null)
                                      or (scope = 'seller' and seller_id is not null and game_id is null)),
  constraint commission_rules_bp_range check (bp between 0 and 5000)
);
create unique index commission_rules_game_uidx on public.commission_rules (game_id) where scope = 'game';
create unique index commission_rules_seller_uidx on public.commission_rules (seller_id) where scope = 'seller';

-- Расчёт комиссии. Приоритет: ставка продавца → ставка игры → общая. Целочисленно, округление комиссии вверх.
create or replace function public.compute_commission(p_subtotal bigint, p_game_id uuid, p_seller_id uuid)
returns table (
  percent_bp integer, source text, payer text,
  fee_uzs bigint, buyer_fee_uzs bigint, seller_fee_uzs bigint,
  total_uzs bigint, seller_net_uzs bigint, min_fee_applied boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.commission_settings;
  v_bp integer;
  v_src text := 'default';
  v_fee bigint;
  v_min boolean := false;
  v_buyer bigint := 0;
begin
  if p_subtotal is null or p_subtotal <= 0 then
    raise exception 'Некорректная сумма заказа' using errcode = '22023';
  end if;
  select * into s from public.commission_settings;
  v_bp := s.default_bp;
  select r.bp into v_bp from public.commission_rules r where r.scope = 'seller' and r.seller_id = p_seller_id;
  if found then
    v_src := 'seller';
  else
    select r.bp into v_bp from public.commission_rules r where r.scope = 'game' and r.game_id = p_game_id;
    if found then v_src := 'game'; else v_bp := s.default_bp; end if;
  end if;

  v_fee := ceil(p_subtotal::numeric * v_bp / 10000)::bigint;
  if s.min_fee_enabled and v_fee < s.min_fee_uzs then
    v_fee := s.min_fee_uzs;
    v_min := true;
  end if;
  v_fee := least(v_fee, p_subtotal); -- комиссия никогда не больше стоимости товара

  if s.payer = 'buyer' then v_buyer := v_fee;
  elsif s.payer = 'split' then v_buyer := v_fee / 2;
  end if;

  return query select v_bp, v_src, s.payer, v_fee, v_buyer, v_fee - v_buyer, p_subtotal + v_buyer, p_subtotal - (v_fee - v_buyer), v_min;
end;
$$;

create or replace function public.admin_set_commission_settings(
  p_default_bp integer, p_min_fee_enabled boolean, p_min_fee_uzs bigint, p_payer text, p_min_order bigint, p_max_order bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.commission_settings;
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  select * into o from public.commission_settings;
  update public.commission_settings
     set default_bp = p_default_bp, min_fee_enabled = p_min_fee_enabled, min_fee_uzs = p_min_fee_uzs,
         payer = p_payer, min_order_uzs = p_min_order, max_order_uzs = p_max_order, updated_at = now();
  perform public.write_audit(auth.uid(), 'commission.updated', 'commission_settings', 'main',
    jsonb_build_object('old', to_jsonb(o), 'note', 'Старые заказы не меняются'));
end;
$$;

-- p_bp = null — убрать особую ставку
create or replace function public.admin_set_commission_rule(p_scope text, p_ref uuid, p_bp integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  if p_scope not in ('game', 'seller') then
    raise exception 'Неизвестная область' using errcode = '22023';
  end if;
  if p_scope = 'game' then
    delete from public.commission_rules where scope = 'game' and game_id = p_ref;
    if p_bp is not null then insert into public.commission_rules (scope, game_id, bp) values ('game', p_ref, p_bp); end if;
  else
    delete from public.commission_rules where scope = 'seller' and seller_id = p_ref;
    if p_bp is not null then insert into public.commission_rules (scope, seller_id, bp) values ('seller', p_ref, p_bp); end if;
  end if;
  perform public.write_audit(auth.uid(), 'commission.rule', 'commission_rules', p_ref::text, jsonb_build_object('scope', p_scope, 'bp', p_bp));
end;
$$;

-- ═════════════ 5. Заказы: количество, снимок комиссии, новые статусы ═════════════
alter table public.orders
  add column unit_price_uzs  bigint,
  add column quantity        integer not null default 1,
  add column game_id         uuid references public.games (id) on delete restrict,
  add column commission_bp   integer,
  add column commission_source text,
  add column fee_payer       text,
  add column buyer_fee_uzs   bigint,
  add column seller_fee_uzs  bigint,
  add column total_uzs       bigint,
  add column seller_net_uzs  bigint,
  add column min_fee_applied boolean not null default false;

update public.orders set
  unit_price_uzs = price_uzs, game_id = (select game_id from public.listings l where l.id = orders.listing_id),
  commission_bp = case when price_uzs > 0 then (fee_uzs * 10000 / price_uzs)::int else 0 end,
  commission_source = 'default', fee_payer = 'seller', buyer_fee_uzs = 0, seller_fee_uzs = fee_uzs,
  total_uzs = price_uzs, seller_net_uzs = price_uzs - fee_uzs
 where unit_price_uzs is null;

alter table public.orders
  alter column unit_price_uzs set not null, alter column game_id set not null, alter column commission_bp set not null,
  alter column commission_source set not null, alter column fee_payer set not null, alter column buyer_fee_uzs set not null,
  alter column seller_fee_uzs set not null, alter column total_uzs set not null, alter column seller_net_uzs set not null;

alter table public.orders add constraint orders_quantity_range check (quantity between 1 and 99);
alter table public.orders add constraint orders_money_consistent check (
  price_uzs = unit_price_uzs * quantity
  and fee_uzs = buyer_fee_uzs + seller_fee_uzs
  and total_uzs = price_uzs + buyer_fee_uzs
  and seller_net_uzs = price_uzs - seller_fee_uzs
  and seller_net_uzs >= 0);
alter table public.orders add constraint orders_payer_valid check (fee_payer in ('seller', 'buyer', 'split'));
alter table public.orders add constraint orders_source_valid check (commission_source in ('seller', 'game', 'default'));

alter table public.orders drop constraint orders_status_valid;
alter table public.orders add constraint orders_status_valid check (status in (
  'pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'disputed', 'refund_review', 'cancelled', 'refunded'));
alter table public.order_events drop constraint order_events_status_valid;
alter table public.order_events add constraint order_events_status_valid check (status in (
  'pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'disputed', 'refund_review', 'cancelled', 'refunded'));

create or replace function public.orders_guard_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.price_uzs is distinct from old.price_uzs or new.fee_uzs is distinct from old.fee_uzs
     or new.unit_price_uzs is distinct from old.unit_price_uzs or new.quantity is distinct from old.quantity
     or new.commission_bp is distinct from old.commission_bp or new.commission_source is distinct from old.commission_source
     or new.fee_payer is distinct from old.fee_payer or new.buyer_fee_uzs is distinct from old.buyer_fee_uzs
     or new.seller_fee_uzs is distinct from old.seller_fee_uzs or new.total_uzs is distinct from old.total_uzs
     or new.seller_net_uzs is distinct from old.seller_net_uzs or new.min_fee_applied is distinct from old.min_fee_applied
     or new.game_id is distinct from old.game_id
     or new.buyer_id is distinct from old.buyer_id or new.seller_id is distinct from old.seller_id
     or new.listing_id is distinct from old.listing_id or new.number is distinct from old.number then
    raise exception 'Цена, комиссия и стороны заказа неизменяемы' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending_payment' and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid' and new.status in ('in_progress', 'delivered', 'disputed', 'cancelled', 'refunded'))
      or (old.status = 'in_progress' and new.status in ('delivered', 'disputed', 'refunded'))
      or (old.status = 'delivered' and new.status in ('completed', 'disputed', 'refunded'))
      or (old.status = 'disputed' and new.status in ('completed', 'refunded', 'refund_review'))
      or (old.status = 'refund_review' and new.status in ('completed', 'refunded'))
    ) then
      raise exception 'Недопустимый переход статуса заказа: % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ═════════════ 6. Леджер продавца (учёт, DEMO) ═════════════
create table public.ledger_entries (
  id           bigint generated always as identity primary key,
  seller_id    uuid not null references public.profiles (id) on delete restrict,
  order_id     uuid references public.orders (id) on delete restrict,
  payout_id    uuid,
  kind         text not null,
  pending      bigint not null default 0,
  available    bigint not null default 0,
  in_payout    bigint not null default 0,
  paid         bigint not null default 0,
  platform_fee bigint not null default 0,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  constraint ledger_kind_valid check (kind in ('order_paid', 'order_released', 'order_reversed', 'payout_requested', 'payout_paid', 'payout_rejected')),
  constraint ledger_ref check ((kind like 'order_%' and order_id is not null) or (kind like 'payout_%' and payout_id is not null))
);
-- Идемпотентность: каждый вид записи по заказу / заявке — только один раз (нет двойной комиссии и двойной выплаты).
create unique index ledger_order_kind_uidx on public.ledger_entries (order_id, kind) where order_id is not null;
create unique index ledger_payout_kind_uidx on public.ledger_entries (payout_id, kind) where payout_id is not null;
create index ledger_seller_idx on public.ledger_entries (seller_id, created_at desc);

create trigger ledger_immutable before update or delete on public.ledger_entries
  for each row execute function public.forbid_modification();

-- Баланс не может стать отрицательным даже при параллельных запросами: блокировка по продавцу + проверка суммы.
create or replace function public.ledger_guard_balance()
returns trigger
language plpgsql
as $$
declare
  b record;
begin
  perform pg_advisory_xact_lock(hashtextextended('ledger:' || new.seller_id::text, 0));
  select coalesce(sum(pending), 0) + new.pending as pending,
         coalesce(sum(available), 0) + new.available as available,
         coalesce(sum(in_payout), 0) + new.in_payout as in_payout,
         coalesce(sum(paid), 0) + new.paid as paid
    into b
    from public.ledger_entries where seller_id = new.seller_id;
  if b.pending < 0 or b.available < 0 or b.in_payout < 0 or b.paid < 0 then
    raise exception 'Недостаточно средств: баланс не может быть отрицательным' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger ledger_balance_guard before insert on public.ledger_entries
  for each row execute function public.ledger_guard_balance();

create view public.seller_balances with (security_invoker = true) as
  select seller_id,
         coalesce(sum(pending), 0)::bigint      as pending_uzs,
         coalesce(sum(available), 0)::bigint    as available_uzs,
         coalesce(sum(in_payout), 0)::bigint    as in_payout_uzs,
         coalesce(sum(paid), 0)::bigint         as paid_uzs,
         coalesce(sum(platform_fee), 0)::bigint as platform_fee_uzs
    from public.ledger_entries group by seller_id;

create or replace function public.ledger_post(
  p_seller uuid, p_order uuid, p_payout uuid, p_kind text,
  p_pending bigint, p_available bigint, p_in_payout bigint, p_paid bigint, p_fee bigint, p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if p_order is not null then
    insert into public.ledger_entries (seller_id, order_id, kind, pending, available, in_payout, paid, platform_fee, note)
    values (p_seller, p_order, p_kind, p_pending, p_available, p_in_payout, p_paid, p_fee, p_note)
    on conflict (order_id, kind) where order_id is not null do nothing returning id into v_id;
  else
    insert into public.ledger_entries (seller_id, payout_id, kind, pending, available, in_payout, paid, platform_fee, note)
    values (p_seller, p_payout, p_kind, p_pending, p_available, p_in_payout, p_paid, p_fee, p_note)
    on conflict (payout_id, kind) where payout_id is not null do nothing returning id into v_id;
  end if;
  return v_id is not null; -- false = запись уже была (повторная обработка проигнорирована)
end;
$$;

-- ═════════════ 7. Заявки на вывод (DEMO) ═════════════
create sequence public.payout_number_seq start with 7100;

create table public.payout_requests (
  id            uuid primary key default gen_random_uuid(),
  number        bigint not null unique default nextval('public.payout_number_seq'),
  seller_id     uuid not null references public.profiles (id) on delete restrict,
  amount_uzs    bigint not null,
  method        text not null,
  details       text not null,
  status        text not null default 'created',
  admin_comment text not null default '',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint payout_requests_amount check (amount_uzs >= 50000),
  constraint payout_requests_method_valid check (method in ('card_demo', 'bank_demo', 'wallet_future')),
  constraint payout_requests_details_len check (char_length(details) between 3 and 100),
  -- реквизиты в демо не должны быть похожи на реальные номера карт/счетов
  constraint payout_requests_details_demo check (regexp_replace(details, '[\s-]', '', 'g') !~ '[0-9]{12,}'),
  constraint payout_requests_status_valid check (status in ('created', 'in_review', 'approved', 'paid', 'rejected'))
);
create index payout_requests_seller_idx on public.payout_requests (seller_id, created_at desc);
create index payout_requests_status_idx on public.payout_requests (status);
create trigger payout_requests_set_updated_at before update on public.payout_requests
  for each row execute function public.set_updated_at();

alter table public.ledger_entries add constraint ledger_payout_fk foreign key (payout_id) references public.payout_requests (id) on delete restrict;

create or replace function public.request_payout(p_amount bigint, p_method text, p_details text)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  p public.payout_requests;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and is_seller) then
    raise exception 'Сначала активируйте режим продавца' using errcode = '42501';
  end if;
  -- сумма и реквизиты проверяются ограничениями таблицы; достаточность средств — триггером леджера
  insert into public.payout_requests (seller_id, amount_uzs, method, details)
  values (v_uid, p_amount, p_method, trim(p_details))
  returning * into p;
  perform public.ledger_post(v_uid, null, p.id, 'payout_requested', 0, -p.amount_uzs, p.amount_uzs, 0, 0,
                             'Заявка ' || p.number || ' на вывод (тест).');
  insert into public.notifications (user_id, body, href)
  select pr.id, 'Новая заявка на вывод PAY-' || p.number, '/admin/payouts' from public.profiles pr where pr.role = 'admin' and not pr.blocked;
  perform public.write_audit(v_uid, 'payout.requested', 'payout_requests', p.id::text, jsonb_build_object('amount_uzs', p.amount_uzs));
  return p;
end;
$$;

-- Продавец статус заявки менять не может. Это делает только администратор.
create or replace function public.admin_payout_action(p_payout_id uuid, p_action text, p_comment text default '')
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payout_requests;
  v_to text;
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  select * into p from public.payout_requests where id = p_payout_id for update;
  if not found then
    raise exception 'Заявка не найдена' using errcode = 'P0002';
  end if;

  if p_action = 'review' and p.status = 'created' then v_to := 'in_review';
  elsif p_action = 'approve' and p.status in ('created', 'in_review') then v_to := 'approved';
  elsif p_action = 'mark_paid' and p.status = 'approved' then v_to := 'paid';
  elsif p_action = 'reject' and p.status in ('created', 'in_review', 'approved') then
    if char_length(trim(coalesce(p_comment, ''))) < 3 then
      raise exception 'Укажите причину отклонения' using errcode = '23514';
    end if;
    v_to := 'rejected';
  else
    raise exception 'Действие недоступно в текущем статусе заявки' using errcode = '23514';
  end if;

  update public.payout_requests
     set status = v_to, admin_comment = coalesce(nullif(trim(p_comment), ''), admin_comment), reviewed_by = auth.uid()
   where id = p.id returning * into p;

  if v_to = 'paid' then
    perform public.ledger_post(p.seller_id, null, p.id, 'payout_paid', 0, 0, -p.amount_uzs, p.amount_uzs, 0,
                               'Заявка ' || p.number || ': тестовая выплата отмечена (реальный перевод не выполнялся).');
  elsif v_to = 'rejected' then
    perform public.ledger_post(p.seller_id, null, p.id, 'payout_rejected', 0, p.amount_uzs, -p.amount_uzs, 0, 0,
                               'Заявка ' || p.number || ' отклонена: сумма возвращена в «Доступно».');
  end if;
  insert into public.notifications (user_id, body, href)
  values (p.seller_id, 'Заявка PAY-' || p.number || ': статус изменён.', '/seller/finance');
  perform public.write_audit(auth.uid(), 'payout.' || v_to, 'payout_requests', p.id::text, jsonb_build_object('comment', p_comment));
  return p;
end;
$$;

-- ═════════════ 8. Заказы: создание, действия, платежи (с комиссией и леджером) ═════════════
drop function public.create_order(uuid);

create or replace function public.create_order(p_listing_id uuid, p_quantity integer default 1)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  l public.listings;
  c record;
  s public.commission_settings;
  v_subtotal bigint;
  o public.orders;
begin
  if v_uid is null then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  if not public.is_active_user() then
    raise exception 'Аккаунт недоступен' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'Количество — от 1 до 99' using errcode = '22023';
  end if;

  -- блокировка строки объявления: два покупателя не смогут забрать последний товар одновременно
  select * into l from public.listings where id = p_listing_id and status = 'active' for update;
  if not found then
    raise exception 'Объявление недоступно' using errcode = 'P0002';
  end if;
  if l.seller_id = v_uid then
    raise exception 'Нельзя купить собственный товар' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = l.seller_id and p.blocked) then
    raise exception 'Продавец недоступен' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.games g where g.id = l.game_id and g.enabled) then
    raise exception 'Игра временно отключена' using errcode = 'P0002';
  end if;
  if not l.available or (l.stock is not null and l.stock < 1) then
    raise exception 'Товара нет в наличии' using errcode = '23514';
  end if;
  if l.stock is not null and p_quantity > l.stock then
    raise exception 'В наличии только % шт.', l.stock using errcode = '23514';
  end if;

  v_subtotal := l.price_uzs * p_quantity;
  select * into s from public.commission_settings;
  if v_subtotal < s.min_order_uzs or v_subtotal > s.max_order_uzs then
    raise exception 'Сумма заказа вне допустимых пределов (% – % сум)', s.min_order_uzs, s.max_order_uzs using errcode = '23514';
  end if;

  -- цена и комиссия берутся из БД на момент создания и фиксируются в заказе
  select * into c from public.compute_commission(v_subtotal, l.game_id, l.seller_id);

  insert into public.orders (
    listing_id, listing_title, buyer_id, seller_id, game_id, unit_price_uzs, quantity, price_uzs, fee_uzs,
    commission_bp, commission_source, fee_payer, buyer_fee_uzs, seller_fee_uzs, total_uzs, seller_net_uzs, min_fee_applied)
  values (
    l.id, l.title, v_uid, l.seller_id, l.game_id, l.price_uzs, p_quantity, v_subtotal, c.fee_uzs,
    c.percent_bp, c.source, c.payer, c.buyer_fee_uzs, c.seller_fee_uzs, c.total_uzs, c.seller_net_uzs, c.min_fee_applied)
  returning * into o;

  if l.stock is not null then
    update public.listings set stock = stock - p_quantity where id = l.id; -- резерв остатка
  end if;

  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, 'pending_payment', v_uid, 'Заказ создан. Ожидает оплаты.');
  insert into public.notifications (user_id, body, href)
  values (l.seller_id, 'Новый заказ UZM-' || o.number || ' ожидает оплаты.', '/orders?id=' || o.id);
  perform public.write_audit(v_uid, 'order.created', 'orders', o.id::text,
    jsonb_build_object('listing_id', l.id, 'quantity', p_quantity, 'price_uzs', o.price_uzs, 'fee_uzs', o.fee_uzs,
                       'commission_bp', o.commission_bp, 'source', o.commission_source, 'payer', o.fee_payer));
  return o;
end;
$$;

create or replace function public.apply_order_action(p_order_id uuid, p_action text, p_note text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  o public.orders;
  v_found boolean;
  v_admin boolean;
  v_buyer boolean;
  v_seller boolean;
  v_from text;
  v_to text;
  v_note text;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;

  select * into o from public.orders where id = p_order_id for update; -- блокировка от гонок и двойного завершения
  v_found := found;
  v_admin := public.is_admin();
  v_buyer := v_found and o.buyer_id = v_uid;
  v_seller := v_found and o.seller_id = v_uid;
  if not v_found or not (v_admin or v_buyer or v_seller) then
    raise exception 'Заказ не найден' using errcode = 'P0002'; -- не раскрываем существование чужого заказа
  end if;
  v_from := o.status;

  if p_action = 'cancel' then
    if not (v_buyer or v_seller or v_admin) then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status not in ('pending_payment', 'paid') then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'cancelled'; v_note := 'Заказ отменён.';
  elsif p_action = 'start' then
    if not v_seller then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status <> 'paid' then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'in_progress'; v_note := 'Продавец приступил к выполнению.';
  elsif p_action = 'deliver' then
    if not v_seller then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status not in ('paid', 'in_progress') then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    if not exists (select 1 from public.fulfillments f where f.order_id = o.id) then
      raise exception 'Сначала заполните информацию о выполнении' using errcode = '23514';
    end if;
    update public.fulfillments set delivered_at = now() where order_id = o.id;
    v_to := 'delivered'; v_note := 'Товар передан. Ожидает подтверждения покупателя.';
  elsif p_action = 'confirm' then
    if not v_buyer then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status <> 'delivered' then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'completed'; v_note := 'Покупатель подтвердил получение. Заказ завершён.';
  elsif p_action = 'review_refund' then
    if not v_admin then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status <> 'disputed' then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'refund_review'; v_note := 'Администратор рассматривает возврат.';
  elsif p_action = 'refund' then
    if not v_admin then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status not in ('paid', 'in_progress', 'delivered', 'disputed', 'refund_review') then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'refunded'; v_note := 'Возврат оформлен администратором (тест).';
  elsif p_action = 'resolve_dispute_complete' then
    if not v_admin then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status not in ('disputed', 'refund_review') then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'completed'; v_note := 'Спор решён в пользу выполнения заказа.';
  else
    raise exception 'Неизвестное действие' using errcode = '22023';
  end if;

  update public.orders set status = v_to where id = o.id returning * into o; -- триггер orders_guard проверит переход

  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, v_to, v_uid, trim(v_note || ' ' || coalesce(p_note, '')));

  if v_to = 'completed' then
    update public.profiles set sales_count = sales_count + 1 where id = o.seller_id;
    -- доход продавца становится доступным; комиссия платформы признаётся ровно один раз (уникальный индекс леджера)
    perform public.ledger_post(o.seller_id, o.id, null, 'order_released',
      -o.seller_net_uzs, o.seller_net_uzs, 0, 0, o.fee_uzs, 'Заказ ' || o.number || ' завершён.');
  end if;

  if v_to in ('cancelled', 'refunded') then
    -- отмена/возврат оплаченного заказа: ожидаемый доход снимается (только если заказ был оплачен и не завершён)
    if exists (select 1 from public.ledger_entries where order_id = o.id and kind = 'order_paid') then
      perform public.ledger_post(o.seller_id, o.id, null, 'order_reversed',
        -o.seller_net_uzs, 0, 0, 0, 0, 'Заказ ' || o.number || ': оплата возвращена (тест).');
    end if;
    update public.payments set status = 'refunded' where order_id = o.id and status = 'succeeded';
    update public.listings set stock = stock + o.quantity where id = o.listing_id and stock is not null; -- остаток возвращается
  end if;

  if v_to in ('completed', 'refunded') then
    update public.disputes
       set status = 'resolved', resolved_by = v_uid, resolution = coalesce(resolution, v_note)
     where order_id = o.id and status in ('open', 'in_review', 'need_info');
  end if;

  insert into public.notifications (user_id, body, href)
  select u, 'Заказ UZM-' || o.number || ': ' || v_note, '/orders?id=' || o.id
    from unnest(array[o.buyer_id, o.seller_id]) as u
   where u <> v_uid;

  perform public.write_audit(v_uid, 'order.' || p_action, 'orders', o.id::text,
                             jsonb_build_object('from', v_from, 'to', v_to));
  return o;
end;
$$;

create or replace function public.open_dispute(
  p_order_id uuid, p_reason text, p_description text, p_evidence text default ''
)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  o public.orders;
  d public.disputes;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  select * into o from public.orders where id = p_order_id and buyer_id = v_uid for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'P0002';
  end if;
  if o.status not in ('paid', 'in_progress', 'delivered') then
    raise exception 'По этому заказу нельзя открыть спор' using errcode = '23514';
  end if;

  insert into public.disputes (order_id, opened_by, reason, description, evidence)
  values (o.id, v_uid, p_reason, p_description, coalesce(p_evidence, ''))
  returning * into d;

  update public.orders set status = 'disputed' where id = o.id;
  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, 'disputed', v_uid, 'Покупатель открыл спор. Причина: ' || p_reason);

  insert into public.notifications (user_id, body, href)
  values (o.seller_id, 'По заказу UZM-' || o.number || ' открыт спор. Опишите свою позицию.', '/orders?id=' || o.id);
  insert into public.notifications (user_id, body, href)
  select pr.id, 'Открыт спор по заказу UZM-' || o.number, '/admin/disputes' from public.profiles pr where pr.role = 'admin' and not pr.blocked;

  perform public.write_audit(v_uid, 'dispute.opened', 'disputes', d.id::text, jsonb_build_object('order_id', o.id));
  return d;
end;
$$;

-- Платёж: сумма берётся из заказа (с учётом сбора покупателя).
create or replace function public.create_payment_intent(p_order_id uuid, p_idempotency_key text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  o public.orders;
  p public.payments;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 100 then
    raise exception 'Некорректный ключ идемпотентности' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id and buyer_id = v_uid;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'P0002';
  end if;
  select * into p from public.payments where idempotency_key = p_idempotency_key;
  if found then
    if p.order_id <> o.id then
      raise exception 'Ключ идемпотентности уже использован' using errcode = '23505';
    end if;
    return p;
  end if;
  if o.status <> 'pending_payment' then
    raise exception 'Заказ уже обработан' using errcode = '23514';
  end if;
  insert into public.payments (order_id, provider, provider_ref, idempotency_key, amount_uzs, fee_uzs, is_demo)
  values (o.id, 'demo', 'demo_' || replace(gen_random_uuid()::text, '-', ''), p_idempotency_key,
          o.total_uzs, o.fee_uzs, true)
  returning * into p;
  return p;
end;
$$;

create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_payment_id uuid, p_type text,
  p_payload jsonb default '{}'::jsonb, p_signature_valid boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  pay public.payments;
  o public.orders;
begin
  insert into public.payment_events (provider, event_id, type, payload, signature_valid)
  values (p_provider, p_event_id, p_type, coalesce(p_payload, '{}'::jsonb), p_signature_valid)
  on conflict (provider, event_id) do nothing
  returning id into v_event;

  if v_event is null then
    return 'duplicate';
  end if;
  if not p_signature_valid then
    perform public.write_audit(null, 'payment.event_rejected', 'payment_events', v_event::text, jsonb_build_object('reason', 'bad_signature'));
    return 'rejected_signature';
  end if;

  select * into pay from public.payments where id = p_payment_id and provider = p_provider for update;
  if not found then
    return 'unknown_payment';
  end if;
  update public.payment_events set payment_id = pay.id where id = v_event;
  select * into o from public.orders where id = pay.order_id for update;

  if p_type = 'payment.succeeded' and pay.status = 'created' then
    update public.payments set status = 'succeeded' where id = pay.id;
    if o.status = 'pending_payment' then
      update public.orders set status = 'paid' where id = o.id;
      insert into public.order_events (order_id, status, actor_id, note)
      values (o.id, 'paid', null, case when pay.is_demo
        then 'Тестовая оплата прошла (DEMO — реальные деньги не переводятся).'
        else 'Оплата подтверждена платёжным провайдером.' end);
      -- доход продавца (после комиссии) ожидает завершения заказа; повтор события не создаст вторую запись
      perform public.ledger_post(o.seller_id, o.id, null, 'order_paid', o.seller_net_uzs, 0, 0, 0, 0,
                                 'Заказ ' || o.number || ' оплачен (тест): доход ожидает завершения.');
      insert into public.notifications (user_id, body, href)
      values (o.seller_id, 'Заказ UZM-' || o.number || ' оплачен. Приступайте к выполнению.', '/orders?id=' || o.id);
    end if;
  elsif p_type = 'payment.failed' and pay.status = 'created' then
    update public.payments set status = 'failed' where id = pay.id;
  elsif p_type = 'payment.cancelled' and pay.status = 'created' then
    update public.payments set status = 'cancelled' where id = pay.id;
  elsif p_type = 'payment.refunded' and pay.status = 'succeeded' then
    update public.payments set status = 'refunded' where id = pay.id;
  else
    return 'ignored';
  end if;

  update public.payment_events set applied = true where id = v_event;
  perform public.write_audit(null, 'payment.' || split_part(p_type, '.', 2), 'payments', pay.id::text,
                             jsonb_build_object('event_id', p_event_id));
  return 'applied';
end;
$$;

-- ═════════════ 9. Споры: позиции обеих сторон, запрос сведений, решение ═════════════
alter table public.disputes drop constraint disputes_status_valid;
alter table public.disputes add constraint disputes_status_valid check (status in ('open', 'in_review', 'need_info', 'resolved', 'rejected'));
-- решение админа: refund_buyer | complete_seller
alter table public.disputes add column decision text;
alter table public.disputes add constraint disputes_decision_valid check (decision is null or decision in ('refund_buyer', 'complete_seller'));
drop index public.disputes_one_open_per_order_idx;
create unique index disputes_one_open_per_order_idx on public.disputes (order_id)
  where status in ('open', 'in_review', 'need_info');

create table public.dispute_messages (
  id         uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  is_staff   boolean not null default false,
  kind       text not null default 'message',
  body       text not null,
  evidence   text not null default '',
  created_at timestamptz not null default now(),
  constraint dispute_messages_kind_valid check (kind in ('message', 'info_request', 'decision')),
  constraint dispute_messages_body_len check (char_length(body) between 1 and 1000),
  constraint dispute_messages_evidence_len check (char_length(evidence) <= 1000)
);
create index dispute_messages_dispute_idx on public.dispute_messages (dispute_id, created_at);
create trigger dispute_messages_immutable before update or delete on public.dispute_messages
  for each row execute function public.forbid_modification();

create or replace function public.add_dispute_message(p_dispute_id uuid, p_body text, p_evidence text default '')
returns public.dispute_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d public.disputes;
  o public.orders;
  m public.dispute_messages;
  v_admin boolean := public.is_admin();
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then
    raise exception 'Спор не найден' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = d.order_id;
  if not (v_admin or o.buyer_id = v_uid or o.seller_id = v_uid) then
    raise exception 'Спор не найден' using errcode = 'P0002';
  end if;
  if d.status in ('resolved', 'rejected') and not v_admin then
    raise exception 'Спор закрыт' using errcode = '23514';
  end if;
  insert into public.dispute_messages (dispute_id, author_id, is_staff, body, evidence)
  values (d.id, v_uid, v_admin, p_body, coalesce(p_evidence, '')) returning * into m;
  if d.status = 'open' and v_admin then update public.disputes set status = 'in_review' where id = d.id;
  elsif d.status = 'need_info' and not v_admin then update public.disputes set status = 'in_review' where id = d.id;
  end if;
  insert into public.notifications (user_id, body, href)
  select u, 'Новое сообщение в споре по заказу UZM-' || o.number, '/orders?id=' || o.id
    from unnest(array[o.buyer_id, o.seller_id]) as u where u <> v_uid;
  return m;
end;
$$;

create or replace function public.admin_request_dispute_info(p_dispute_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.disputes;
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved', 'rejected') then
    raise exception 'Спор недоступен' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = d.order_id;
  insert into public.dispute_messages (dispute_id, author_id, is_staff, kind, body)
  values (d.id, auth.uid(), true, 'info_request', p_body);
  update public.disputes set status = 'need_info' where id = d.id;
  insert into public.notifications (user_id, body, href)
  select u, 'По спору по заказу UZM-' || o.number || ' запрошены дополнительные сведения.', '/orders?id=' || o.id
    from unnest(array[o.buyer_id, o.seller_id]) as u;
  perform public.write_audit(auth.uid(), 'dispute.info_requested', 'disputes', d.id::text, jsonb_build_object('body', left(p_body, 120)));
end;
$$;

create or replace function public.admin_resolve_dispute(p_dispute_id uuid, p_decision text, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.disputes;
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  if p_decision not in ('refund_buyer', 'complete_seller') then
    raise exception 'Неизвестное решение' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_comment, ''))) < 5 then
    raise exception 'Напишите решение (минимум 5 символов)' using errcode = '23514';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved', 'rejected') then
    raise exception 'Спор недоступен' using errcode = 'P0002';
  end if;
  update public.disputes set decision = p_decision, resolution = trim(p_comment) where id = d.id;
  perform public.apply_order_action(d.order_id,
    case when p_decision = 'refund_buyer' then 'refund' else 'resolve_dispute_complete' end,
    'Решение по спору.');
  update public.disputes
     set status = case when p_decision = 'refund_buyer' then 'resolved' else 'rejected' end,
         resolved_by = auth.uid()
   where id = d.id;
  insert into public.dispute_messages (dispute_id, author_id, is_staff, kind, body)
  values (d.id, auth.uid(), true, 'decision', trim(p_comment));
  select * into o from public.orders where id = d.order_id;
  perform public.write_audit(auth.uid(), 'dispute.resolved', 'disputes', d.id::text,
    jsonb_build_object('decision', p_decision, 'order', o.number));
end;
$$;

-- ═════════════ 10. Отзывы: ответ продавца ═════════════
alter table public.reviews add column seller_reply text, add column seller_reply_at timestamptz;
alter table public.reviews add constraint reviews_reply_len check (seller_reply is null or char_length(seller_reply) between 2 and 500);

create or replace function public.reply_to_review(p_review_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reviews;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  select * into r from public.reviews where id = p_review_id for update;
  if not found or r.seller_id <> auth.uid() then
    raise exception 'Нельзя отвечать на чужие отзывы' using errcode = '42501';
  end if;
  if r.seller_reply is not null then
    raise exception 'Вы уже ответили на этот отзыв' using errcode = '23514';
  end if;
  update public.reviews set seller_reply = trim(p_text), seller_reply_at = now() where id = r.id;
end;
$$;

-- ═════════════ 11. Администратор: безопасное создание первого администратора ═════════════
-- Публичного способа стать администратором нет. Функцию вызывает только владелец проекта
-- (service_role / SQL Editor) один раз; если администратор уже есть — отказ.
create or replace function public.bootstrap_first_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Администратор уже назначен' using errcode = '42501';
  end if;
  update public.profiles set role = 'admin' where id = p_user_id;
  if not found then
    raise exception 'Пользователь не найден' using errcode = 'P0002';
  end if;
  perform public.write_audit(null, 'admin.bootstrap', 'profiles', p_user_id::text);
end;
$$;

-- ═════════════ 12. RLS и права ═════════════
alter table public.seller_profiles      enable row level security;
alter table public.site_settings        enable row level security;
alter table public.commission_settings  enable row level security;
alter table public.commission_rules     enable row level security;
alter table public.ledger_entries       enable row level security;
alter table public.payout_requests      enable row level security;
alter table public.dispute_messages     enable row level security;

grant select on public.seller_profiles to anon, authenticated;
create policy seller_profiles_select on public.seller_profiles for select to anon, authenticated using (true);

grant select on public.site_settings to authenticated;
create policy site_settings_select on public.site_settings for select to authenticated using (true);

-- Настройки комиссии читают все авторизованные (показ ставок), правила — только админ; запись — только RPC.
grant select on public.commission_settings to authenticated;
create policy commission_settings_select on public.commission_settings for select to authenticated using (true);
grant select on public.commission_rules to authenticated;
create policy commission_rules_admin_select on public.commission_rules for select to authenticated using (public.is_admin());

-- Леджер: продавец видит только свои записи, админ — все. Записи создают только серверные функции.
grant select on public.ledger_entries to authenticated;
grant select on public.seller_balances to authenticated;
create policy ledger_select on public.ledger_entries for select to authenticated
  using ((seller_id = auth.uid() and public.is_active_user()) or public.is_admin());

grant select on public.payout_requests to authenticated;
create policy payout_requests_select on public.payout_requests for select to authenticated
  using ((seller_id = auth.uid() and public.is_active_user()) or public.is_admin());

grant select on public.dispute_messages to authenticated;
create policy dispute_messages_select on public.dispute_messages for select to authenticated
  using (public.is_admin() or exists (select 1 from public.disputes d where d.id = dispute_id and public.is_order_participant(d.order_id)));

-- старая таблица payouts (по заказам) остаётся для совместимости и не используется в приложении.

-- Права на функции
revoke all on function public.become_seller(text, text, text, boolean) from public, anon;
revoke all on function public.admin_moderate_listing(uuid, text, text) from public, anon;
revoke all on function public.admin_set_moderation(boolean) from public, anon;
revoke all on function public.compute_commission(bigint, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_commission_settings(integer, boolean, bigint, text, bigint, bigint) from public, anon;
revoke all on function public.admin_set_commission_rule(text, uuid, integer) from public, anon;
revoke all on function public.ledger_post(uuid, uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.request_payout(bigint, text, text) from public, anon;
revoke all on function public.admin_payout_action(uuid, text, text) from public, anon;
revoke all on function public.create_order(uuid, integer) from public, anon;
revoke all on function public.add_dispute_message(uuid, text, text) from public, anon;
revoke all on function public.admin_request_dispute_info(uuid, text) from public, anon;
revoke all on function public.admin_resolve_dispute(uuid, text, text) from public, anon;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
revoke all on function public.bootstrap_first_admin(uuid) from public, anon, authenticated;

grant execute on function public.become_seller(text, text, text, boolean) to authenticated;
grant execute on function public.admin_moderate_listing(uuid, text, text) to authenticated;
grant execute on function public.admin_set_moderation(boolean) to authenticated;
grant execute on function public.admin_set_commission_settings(integer, boolean, bigint, text, bigint, bigint) to authenticated;
grant execute on function public.admin_set_commission_rule(text, uuid, integer) to authenticated;
grant execute on function public.request_payout(bigint, text, text) to authenticated;
grant execute on function public.admin_payout_action(uuid, text, text) to authenticated;
grant execute on function public.create_order(uuid, integer) to authenticated;
grant execute on function public.add_dispute_message(uuid, text, text) to authenticated;
grant execute on function public.admin_request_dispute_info(uuid, text) to authenticated;
grant execute on function public.admin_resolve_dispute(uuid, text, text) to authenticated;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
-- внутренние функции — только service_role
grant execute on function public.compute_commission(bigint, uuid, uuid) to service_role;
grant execute on function public.ledger_post(uuid, uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, text) to service_role;
grant execute on function public.bootstrap_first_admin(uuid) to service_role;

grant all on public.seller_profiles, public.site_settings, public.commission_settings, public.commission_rules,
             public.ledger_entries, public.payout_requests, public.dispute_messages to service_role;
grant all on public.seller_balances to service_role;
grant usage on all sequences in schema public to authenticated, service_role;
