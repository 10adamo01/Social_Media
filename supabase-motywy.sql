-- =====================================================================
-- MOTYWY STRONY – zapamiętuje motyw wybrany przez właściciela
-- Wklej całość: SQL Editor → New query → Run
-- (wymaga wcześniej: supabase-ustawienia.sql)
-- Zmieniać motyw może tylko właściciel – pilnuje tego istniejąca reguła
-- "Ustawienia zmienia właściciel"; odczyt jest publiczny jak kolor.
-- =====================================================================
alter table public.site_settings
    add column if not exists theme text not null default 'domyslny';
alter table public.site_settings drop constraint if exists site_settings_theme_check;
alter table public.site_settings
    add constraint site_settings_theme_check check (theme ~ '^[a-z0-9-]{1,40}$');
