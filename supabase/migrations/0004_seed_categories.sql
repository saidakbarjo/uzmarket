-- UZMARKET · миграция 0004: справочник категорий
insert into public.categories (slug, name, name_uz, description, icon, sort_order) values
  ('game-items',    'Игровые товары',            'O‘yin buyumlari',               'Предметы, наборы, скины и бонусы',          'Gamepad2', 10),
  ('game-currency', 'Игровая валюта',            'O‘yin valyutasi',               'Кристаллы, монеты, донат-валюта',            'Coins',    20),
  ('game-services', 'Игровые услуги',            'O‘yin xizmatlari',              'Буст, обучение, прохождение',                'Swords',   30),
  ('keys',          'Цифровые ключи',            'Raqamli kalitlar',              'Ключи активации игр и программ',             'KeyRound', 40),
  ('software',      'Программное обеспечение',   'Dasturiy ta’minot',             'Лицензии, утилиты, шаблоны',                 'AppWindow',50),
  ('subscriptions', 'Подписки',                  'Obunalar',                      'Музыка, видео, сервисы',                     'Repeat',   60),
  ('accounts',      'Цифровые аккаунты',         'Raqamli akkauntlar',            'Только если это разрешено правилами сервиса','UserRound',70),
  ('design',        'Дизайн и цифровые услуги',  'Dizayn va raqamli xizmatlar',   'Логотипы, сайты, боты, монтаж',              'Palette',  80),
  ('other',         'Прочие цифровые товары',    'Boshqa raqamli tovarlar',       'Курсы, шаблоны, файлы',                      'Package',  90)
on conflict (slug) do nothing;

-- Назначение администратора выполняется ТОЛЬКО вручную владельцем проекта (SQL Editor / service_role):
--   update public.profiles set role = 'admin' where id = '<uuid основателя из auth.users>';
-- Через API клиента (anon/authenticated) изменить роль невозможно: на колонку role нет права UPDATE.
