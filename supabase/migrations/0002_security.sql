-- UZMARKET · миграция 0002: безопасность (RLS, роли, защита полей)
--
-- Принципы:
--  * Все таблицы закрыты RLS. Политик «разрешить всем всё» нет.
--  * Роль admin назначается ТОЛЬКО вручную через SQL/service_role. Пользователь не может
--    сделать себя администратором (триггер profiles_guard_privileged).
--  * Заказы, платежи, выплаты и журналы изменяются только серверными функциями (0003)
--    или service_role. Прямых INSERT/UPDATE/DELETE-политик для клиентов на них нет.
--  * Цена, статус и роль никогда не принимаются от клиента как есть.

-- ───────────── вспомогательные функции ─────────────
-- security definer + фиксированный search_path: читают profiles в обход RLS (без рекурсии политик).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.blocked
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and not p.blocked
  );
$$;

create or replace function public.is_order_participant(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ) and public.is_active_user();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.is_order_participant(uuid) from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.is_order_participant(uuid) to authenticated, service_role;

-- ───────────── создание профиля при регистрации ─────────────
-- Роль всегда 'user'. Имя берётся из метаданных, иначе генерируется.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 10));
  if char_length(v_name) < 3 or char_length(v_name) > 24 or v_name !~ '^[[:alnum:]_.-]+$' then
    v_name := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  insert into public.profiles (id, username, role) values (new.id, v_name, 'user');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── защита привилегированных полей профиля ─────────────
-- Клиент (роль authenticated) получает право UPDATE только на колонки username и about
-- (см. grant ниже). Поля role, blocked, verified, is_seller, rating_avg, reviews_count,
-- sales_count изменяются только серверными функциями (0003) и service_role.
-- Смена роли пишется в журнал аудита, откуда бы она ни пришла.
create or replace function public.profiles_audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
    values (auth.uid(), 'profile.role_changed', 'profiles', new.id::text,
            jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end;
$$;

create trigger profiles_audit_role after update of role on public.profiles
  for each row execute function public.profiles_audit_role_change();

-- Заказ: цена, комиссия, стороны и объявление не меняются никогда.
create or replace function public.orders_guard_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.price_uzs is distinct from old.price_uzs
     or new.fee_uzs is distinct from old.fee_uzs
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.listing_id is distinct from old.listing_id
     or new.number is distinct from old.number then
    raise exception 'Цена, комиссия и стороны заказа неизменяемы' using errcode = '42501';
  end if;

  -- допустимые переходы статусов (дублируют доменные правила приложения)
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending_payment' and new.status in ('paid', 'cancelled'))
      or (old.status = 'paid' and new.status in ('in_progress', 'delivered', 'disputed', 'cancelled', 'refunded'))
      or (old.status = 'in_progress' and new.status in ('delivered', 'disputed', 'refunded'))
      or (old.status = 'delivered' and new.status in ('completed', 'disputed', 'refunded'))
      or (old.status = 'disputed' and new.status in ('completed', 'refunded'))
    ) then
      raise exception 'Недопустимый переход статуса заказа: % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_guard before update on public.orders
  for each row execute function public.orders_guard_immutable();

-- Журнал аудита и платёжные события нельзя изменять и удалять.
create or replace function public.forbid_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Запись неизменяема' using errcode = '42501';
end;
$$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.forbid_modification();
-- у order_events допускается только обнуление actor_id (FK on delete set null при удалении профиля)
create trigger order_events_immutable before update of order_id, status, note, created_at or delete on public.order_events
  for each row execute function public.forbid_modification();

-- Отзыв: автор — покупатель завершённого заказа; поля привязки не подменяются.
create or replace function public.reviews_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  if tg_op = 'INSERT' then
    select * into o from public.orders where id = new.order_id;
    if not found or o.buyer_id <> new.author_id or o.status <> 'completed' then
      raise exception 'Отзыв может оставить покупатель после завершённого заказа' using errcode = '42501';
    end if;
    -- listing/seller берём из заказа, а не из клиента
    new.listing_id := o.listing_id;
    new.seller_id := o.seller_id;
    new.hidden := false;
  end if;
  return new;
end;
$$;

create trigger reviews_guard_insert before insert on public.reviews
  for each row execute function public.reviews_guard();

-- Пересчёт рейтинга продавца после изменений отзывов.
create or replace function public.recalc_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid := coalesce(new.seller_id, old.seller_id);
begin
  update public.profiles p
     set reviews_count = coalesce(s.cnt, 0),
         rating_avg = coalesce(round(s.avg_rating::numeric, 1), 0)
    from (
      select count(*) as cnt, avg(rating) as avg_rating
      from public.reviews where seller_id = v_seller and not hidden
    ) s
   where p.id = v_seller;
  return null;
end;
$$;

create trigger reviews_recalc after insert or update of rating, hidden or delete on public.reviews
  for each row execute function public.recalc_seller_rating();

-- Продавцом считается тот, кто создал объявление.
create or replace function public.mark_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set is_seller = true where id = new.seller_id and not is_seller;
  return new;
end;
$$;

create trigger listings_mark_seller after insert on public.listings
  for each row execute function public.mark_seller();

-- Продавец не может разблокировать заблокированное объявление и выставить 'blocked' сам.
create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'blocked' or new.seller_id <> auth.uid() then
      raise exception 'Недопустимые значения объявления' using errcode = '42501';
    end if;
    new.views := 0;
  else
    if old.status = 'blocked' then
      raise exception 'Объявление заблокировано модератором' using errcode = '42501';
    end if;
    if new.status = 'blocked' or new.seller_id is distinct from old.seller_id or new.views is distinct from old.views then
      raise exception 'Недопустимое изменение объявления' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_guard_trg before insert or update on public.listings
  for each row execute function public.listings_guard();

-- ───────────── включаем RLS на всех таблицах ─────────────
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_images  enable row level security;
alter table public.orders          enable row level security;
alter table public.order_events    enable row level security;
alter table public.order_messages  enable row level security;
alter table public.payments        enable row level security;
alter table public.payment_events  enable row level security;
alter table public.fulfillments    enable row level security;
alter table public.disputes        enable row level security;
alter table public.reviews         enable row level security;
alter table public.favorites       enable row level security;
alter table public.notifications   enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_replies  enable row level security;
alter table public.payouts         enable row level security;
alter table public.payout_items    enable row level security;
alter table public.audit_logs      enable row level security;

-- Сначала забираем все права, затем выдаём только нужные (принцип наименьших привилегий).
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ───────────── profiles ─────────────
grant select on public.profiles to anon, authenticated;
-- ТОЛЬКО эти две колонки: сделать себя администратором через API невозможно.
grant update (username, about) on public.profiles to authenticated;

create policy profiles_select_public on public.profiles
  for select to anon, authenticated
  using (not blocked or id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and not blocked)
  with check (id = auth.uid());

-- ───────────── categories ─────────────
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create policy categories_select on public.categories
  for select to anon, authenticated
  using (is_enabled or public.is_admin());

create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────── listings ─────────────
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

create policy listings_select on public.listings
  for select to anon, authenticated
  using (
    (status = 'active'
      and exists (select 1 from public.profiles p where p.id = seller_id and not p.blocked)
      and exists (select 1 from public.categories c where c.id = category_id and c.is_enabled))
    or seller_id = auth.uid()
    or public.is_admin()
  );

create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (seller_id = auth.uid() and status in ('active', 'paused') and public.is_active_user());

create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = auth.uid() and status <> 'blocked' and public.is_active_user())
  with check (seller_id = auth.uid() and status in ('active', 'paused'));

create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = auth.uid() and public.is_active_user()); -- заказы блокируют удаление через FK (on delete restrict)

create policy listings_admin_all on public.listings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────── listing_images ─────────────
grant select on public.listing_images to anon, authenticated;
grant insert, update, delete on public.listing_images to authenticated;

create policy listing_images_select on public.listing_images
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id)); -- наследует видимость объявления через RLS listings

create policy listing_images_write_own on public.listing_images
  for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- ───────────── orders (только чтение; запись — через функции из 0003) ─────────────
grant select on public.orders to authenticated;

create policy orders_select_participants on public.orders
  for select to authenticated
  using ((buyer_id = auth.uid() or seller_id = auth.uid()) and public.is_active_user());

create policy orders_select_admin on public.orders
  for select to authenticated
  using (public.is_admin());

-- ───────────── order_events / order_messages ─────────────
grant select on public.order_events to authenticated;
grant select, insert on public.order_messages to authenticated;

create policy order_events_select on public.order_events
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy order_messages_select on public.order_messages
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy order_messages_insert on public.order_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (public.is_order_participant(order_id)
        and exists (select 1 from public.orders o where o.id = order_id
                    and o.status not in ('completed', 'cancelled', 'refunded')))
      or public.is_admin()
    )
  );

-- ───────────── payments / payment_events / payouts (клиенты только читают своё) ─────────────
grant select on public.payments to authenticated;
grant select on public.payouts to authenticated;
grant select on public.payout_items to authenticated;

create policy payments_select on public.payments
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

-- payment_events: клиентам доступа нет вообще (только service_role и админ-чтение)
grant select on public.payment_events to authenticated;
create policy payment_events_admin_select on public.payment_events
  for select to authenticated
  using (public.is_admin());

create policy payouts_select on public.payouts
  for select to authenticated
  using (seller_id = auth.uid() or public.is_admin());

create policy payout_items_select on public.payout_items
  for select to authenticated
  using (exists (select 1 from public.payouts p where p.id = payout_id and (p.seller_id = auth.uid() or public.is_admin())));

-- ───────────── fulfillments ─────────────
grant select, insert on public.fulfillments to authenticated;
grant update (note, delivered_at) on public.fulfillments to authenticated;

create policy fulfillments_select on public.fulfillments
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy fulfillments_insert_seller on public.fulfillments
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()
                and o.status in ('paid', 'in_progress'))
  );

create policy fulfillments_update_seller on public.fulfillments
  for update to authenticated
  using (
    seller_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()
                and o.status in ('paid', 'in_progress'))
  )
  with check (seller_id = auth.uid());

-- ───────────── disputes (создаются функцией open_dispute; статусы меняет админ) ─────────────
grant select on public.disputes to authenticated;
grant update (status, resolution, resolved_by) on public.disputes to authenticated; -- только админ (политика ниже)

create policy disputes_select on public.disputes
  for select to authenticated
  using (public.is_order_participant(order_id) or public.is_admin());

create policy disputes_update_admin on public.disputes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────── reviews ─────────────
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant update (hidden) on public.reviews to authenticated; -- скрытие отзыва: только админ (политика ниже)

create policy reviews_select on public.reviews
  for select to anon, authenticated
  using (not hidden or author_id = auth.uid() or public.is_admin());

create policy reviews_insert_buyer on public.reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user()
    and exists (select 1 from public.orders o
                where o.id = order_id and o.buyer_id = auth.uid() and o.status = 'completed')
  );

create policy reviews_update_admin on public.reviews
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ───────────── favorites ─────────────
grant select, insert, delete on public.favorites to authenticated;

create policy favorites_own on public.favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active_user());

-- ───────────── notifications ─────────────
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ───────────── support_tickets / ticket_replies ─────────────
grant select, insert on public.support_tickets to authenticated;
grant update (status) on public.support_tickets to authenticated; -- только админ (политика ниже)
grant select, insert on public.ticket_replies to authenticated;

create policy tickets_select on public.support_tickets
  for select to authenticated
  using (author_id = auth.uid() or public.is_admin());

create policy tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'open'
    and public.is_active_user()
    and (order_id is null or public.is_order_participant(order_id))
  );

create policy tickets_update_admin on public.support_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ticket_replies_select on public.ticket_replies
  for select to authenticated
  using (exists (select 1 from public.support_tickets t
                 where t.id = ticket_id and (t.author_id = auth.uid() or public.is_admin())));

create policy ticket_replies_insert on public.ticket_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (not is_staff and exists (select 1 from public.support_tickets t
                                where t.id = ticket_id and t.author_id = auth.uid()
                                  and t.status in ('open', 'in_review')))
      or (is_staff and public.is_admin())
    )
  );

-- ───────────── audit_logs (читает только админ; пишут функции и service_role) ─────────────
grant select on public.audit_logs to authenticated;

create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

-- service_role обходит RLS, но права на таблицы ему нужны явно
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on all sequences in schema public to authenticated;
