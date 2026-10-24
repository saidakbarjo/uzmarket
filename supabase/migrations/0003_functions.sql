-- UZMARKET · миграция 0003: серверные функции (RPC)
--
-- Через эти функции — и только через них — клиент создаёт заказ, меняет его статус,
-- открывает спор и инициирует тестовый платёж. Цена, комиссия, участники и допустимость
-- перехода определяются на сервере; значения из браузера им не передаются.
--
-- Функции помечены security definer и работают с фиксированным search_path.
-- Права выдаются явно в конце файла.

create or replace function public.fee_percent()
returns integer
language sql
immutable
as $$ select 5 $$; -- демонстрационная комиссия, %

-- Запись в журнал аудита (вызывается только из других функций и service_role).
create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (p_actor, p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;

-- ───────────── создание заказа ─────────────
create or replace function public.create_order(p_listing_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  l public.listings;
  o public.orders;
begin
  if v_uid is null then
    raise exception 'Требуется вход в аккаунт' using errcode = '28000';
  end if;
  if not public.is_active_user() then
    raise exception 'Аккаунт недоступен' using errcode = '42501';
  end if;

  select * into l from public.listings where id = p_listing_id and status = 'active' for share;
  if not found then
    raise exception 'Объявление недоступно' using errcode = 'P0002';
  end if;
  if l.seller_id = v_uid then
    raise exception 'Нельзя купить собственный товар' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = l.seller_id and p.blocked) then
    raise exception 'Продавец недоступен' using errcode = 'P0002';
  end if;

  -- цена и комиссия берутся из БД на момент создания и фиксируются в заказе
  insert into public.orders (listing_id, listing_title, buyer_id, seller_id, price_uzs, fee_uzs)
  values (l.id, l.title, v_uid, l.seller_id, l.price_uzs,
          ceil(l.price_uzs::numeric * public.fee_percent() / 100)::bigint)
  returning * into o;

  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, 'pending_payment', v_uid, 'Заказ создан. Ожидает оплаты.');

  insert into public.notifications (user_id, body, href)
  values (l.seller_id, 'Новый заказ UZM-' || o.number || ' ожидает оплаты.', '/orders/' || o.id);

  perform public.write_audit(v_uid, 'order.created', 'orders', o.id::text,
                             jsonb_build_object('listing_id', l.id, 'price_uzs', o.price_uzs));
  return o;
end;
$$;

-- ───────────── действия над заказом ─────────────
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
    v_to := 'delivered'; v_note := 'Продавец отметил заказ как выданный.';

  elsif p_action = 'confirm' then
    if not v_buyer then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status <> 'delivered' then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'completed'; v_note := 'Покупатель подтвердил получение. Заказ завершён.';

  elsif p_action = 'refund' then
    if not v_admin then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status not in ('paid', 'in_progress', 'delivered', 'disputed') then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'refunded'; v_note := 'Возврат оформлен администратором.';

  elsif p_action = 'resolve_dispute_complete' then
    if not v_admin then raise exception 'Нет прав' using errcode = '42501'; end if;
    if o.status <> 'disputed' then raise exception 'Недопустимый статус заказа' using errcode = '23514'; end if;
    v_to := 'completed'; v_note := 'Спор решён в пользу выполнения заказа.';

  else
    raise exception 'Неизвестное действие' using errcode = '22023';
  end if;

  update public.orders set status = v_to where id = o.id returning * into o; -- триггер orders_guard проверит переход

  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, v_to, v_uid, trim(v_note || ' ' || coalesce(p_note, '')));

  if v_to = 'completed' then
    update public.profiles set sales_count = sales_count + 1 where id = o.seller_id;
  end if;
  if v_to = 'refunded' then
    update public.payments set status = 'refunded' where order_id = o.id and status = 'succeeded';
  end if;
  if v_to in ('completed', 'refunded') then
    update public.disputes
       set status = 'resolved', resolved_by = v_uid, resolution = v_note
     where order_id = o.id and status in ('open', 'in_review');
  end if;

  insert into public.notifications (user_id, body, href)
  select u, 'Заказ UZM-' || o.number || ': ' || v_note, '/orders/' || o.id
    from unnest(array[o.buyer_id, o.seller_id]) as u
   where u <> v_uid;

  perform public.write_audit(v_uid, 'order.' || p_action, 'orders', o.id::text,
                             jsonb_build_object('to', v_to));
  return o;
end;
$$;

-- ───────────── спор ─────────────
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
  returning * into d; -- ограничения длины и «один открытый спор на заказ» проверяет БД

  update public.orders set status = 'disputed' where id = o.id;
  insert into public.order_events (order_id, status, actor_id, note)
  values (o.id, 'disputed', v_uid, 'Покупатель открыл спор. Причина: ' || p_reason);

  insert into public.notifications (user_id, body, href)
  values (o.seller_id, 'По заказу UZM-' || o.number || ' открыт спор.', '/orders/' || o.id);

  perform public.write_audit(v_uid, 'dispute.opened', 'disputes', d.id::text, jsonb_build_object('order_id', o.id));
  return d;
end;
$$;

-- ───────────── платежи ─────────────
-- Создание платежа: сумма берётся из заказа, а не от клиента. Повтор с тем же ключом
-- возвращает уже созданный платёж (идемпотентность).
-- ВАЖНО: для реального провайдера эта функция должна вызываться только серверным кодом (service_role).
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
          o.price_uzs, o.fee_uzs, true)
  returning * into p;
  return p;
end;
$$;

-- Применение события провайдера. Вызывается ТОЛЬКО серверным кодом (service_role):
-- webhook-обработчик сначала проверяет подпись и передаёт результат в p_signature_valid.
-- Повторное событие (тот же provider + event_id) не применяется второй раз.
create or replace function public.apply_payment_event(
  p_provider text,
  p_event_id text,
  p_payment_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_signature_valid boolean default false
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
    return 'duplicate'; -- событие уже обработано
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
      insert into public.notifications (user_id, body, href)
      values (o.seller_id, 'Заказ UZM-' || o.number || ' оплачен. Приступайте к выполнению.', '/orders/' || o.id);
    end if;
  elsif p_type = 'payment.failed' and pay.status = 'created' then
    update public.payments set status = 'failed' where id = pay.id;
  elsif p_type = 'payment.cancelled' and pay.status = 'created' then
    update public.payments set status = 'cancelled' where id = pay.id;
  elsif p_type = 'payment.refunded' and pay.status = 'succeeded' then
    update public.payments set status = 'refunded' where id = pay.id;
  else
    return 'ignored'; -- событие не подходит текущему состоянию платежа
  end if;

  update public.payment_events set applied = true where id = v_event;
  perform public.write_audit(null, 'payment.' || split_part(p_type, '.', 2), 'payments', pay.id::text,
                             jsonb_build_object('event_id', p_event_id));
  return 'applied';
end;
$$;

-- ДЕМО: покупатель сам «оплачивает» свой тестовый платёж. Только для платежей с is_demo = true.
-- Удалить эту функцию перед подключением реального провайдера.
create or replace function public.demo_apply_payment(p_payment_id uuid, p_outcome text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  pay public.payments;
  v_type text;
begin
  select p.* into pay from public.payments p
   join public.orders o on o.id = p.order_id
   where p.id = p_payment_id and p.is_demo and o.buyer_id = v_uid;
  if not found then
    raise exception 'Платёж не найден' using errcode = 'P0002';
  end if;
  v_type := case p_outcome
              when 'success' then 'payment.succeeded'
              when 'fail' then 'payment.failed'
              when 'cancel' then 'payment.cancelled'
              else null end;
  if v_type is null then
    raise exception 'Неизвестный исход' using errcode = '22023';
  end if;
  return public.apply_payment_event('demo', 'evt_' || replace(gen_random_uuid()::text, '-', ''),
                                    pay.id, v_type, '{}'::jsonb, true);
end;
$$;

-- ───────────── административные действия ─────────────
create or replace function public.admin_set_user_blocked(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Нельзя заблокировать себя' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Нельзя заблокировать администратора' using errcode = '42501';
  end if;
  update public.profiles set blocked = p_blocked where id = p_user_id;
  perform public.write_audit(auth.uid(), case when p_blocked then 'user.blocked' else 'user.unblocked' end,
                             'profiles', p_user_id::text);
end;
$$;

create or replace function public.admin_set_seller_verified(p_user_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Нужны права администратора' using errcode = '42501';
  end if;
  update public.profiles set verified = p_verified where id = p_user_id;
  perform public.write_audit(auth.uid(), 'seller.verified_changed', 'profiles', p_user_id::text,
                             jsonb_build_object('verified', p_verified));
end;
$$;

-- ───────────── права на выполнение ─────────────
revoke all on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_order(uuid) from public, anon;
revoke all on function public.apply_order_action(uuid, text, text) from public, anon;
revoke all on function public.open_dispute(uuid, text, text, text) from public, anon;
revoke all on function public.create_payment_intent(uuid, text) from public, anon;
revoke all on function public.apply_payment_event(text, text, uuid, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.demo_apply_payment(uuid, text) from public, anon;
revoke all on function public.admin_set_user_blocked(uuid, boolean) from public, anon;
revoke all on function public.admin_set_seller_verified(uuid, boolean) from public, anon;

grant execute on function public.create_order(uuid) to authenticated;
grant execute on function public.apply_order_action(uuid, text, text) to authenticated;
grant execute on function public.open_dispute(uuid, text, text, text) to authenticated;
grant execute on function public.create_payment_intent(uuid, text) to authenticated;
grant execute on function public.demo_apply_payment(uuid, text) to authenticated;
grant execute on function public.admin_set_user_blocked(uuid, boolean) to authenticated;
grant execute on function public.admin_set_seller_verified(uuid, boolean) to authenticated;

-- только серверный код с service_role
grant execute on function public.apply_payment_event(text, text, uuid, text, jsonb, boolean) to service_role;
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;
