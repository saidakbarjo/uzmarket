-- UZMARKET · миграция 0006: поля профиля, уведомления, Storage для изображений.
-- Ничего не дублирует: расширяет существующие таблицы.

-- ───────────── profiles: отображаемое имя, язык, аватар ─────────────
alter table public.profiles
  add column display_name       text,
  add column preferred_language text not null default 'ru',
  add column avatar_path        text;

alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 1 and 40),
  add constraint profiles_language_valid  check (preferred_language in ('ru', 'uz', 'en')),
  add constraint profiles_avatar_path_len check (avatar_path is null or char_length(avatar_path) <= 300);

-- Клиент меняет только безопасные поля. role / blocked / verified / счётчики — нет.
grant update (display_name, preferred_language, avatar_path) on public.profiles to authenticated;

-- ───────────── notifications: заголовок и тип ─────────────
alter table public.notifications
  add column title text,
  add column kind  text not null default 'system';
alter table public.notifications
  add constraint notifications_kind_valid check (kind in ('system', 'order', 'listing', 'review', 'dispute', 'moderation')),
  add constraint notifications_title_len  check (title is null or char_length(title) <= 120);

-- ───────────── Storage ─────────────
-- Бакеты: listing-images (публичное чтение, запись только в папку своего user id)
--         avatars        (то же).
-- Путь файла: <auth.uid()>/<имя файла>. Ограничения размера/типа задаются в самом бакете.
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Схема storage не найдена — политики Storage пропущены (применяйте в проекте Supabase).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('listing-images', 'listing-images', true, 2097152, array['image/jpeg','image/png','image/webp']),
    ('avatars',        'avatars',        true, 1048576, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "uz_images_read"   on storage.objects;
  drop policy if exists "uz_images_insert" on storage.objects;
  drop policy if exists "uz_images_update" on storage.objects;
  drop policy if exists "uz_images_delete" on storage.objects;

  -- Чтение: публичные бакеты читаются всеми (изображения объявлений и аватары — публичный контент).
  create policy "uz_images_read" on storage.objects for select
    using (bucket_id in ('listing-images', 'avatars'));

  -- Запись/изменение/удаление: только в собственную папку <uid>/..., только авторизованный не заблокированный пользователь.
  create policy "uz_images_insert" on storage.objects for insert to authenticated
    with check (
      bucket_id in ('listing-images', 'avatars')
      and (storage.foldername(name))[1] = auth.uid()::text
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.blocked)
    );
  create policy "uz_images_update" on storage.objects for update to authenticated
    using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "uz_images_delete" on storage.objects for delete to authenticated
    using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
end
$$;
