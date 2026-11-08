-- =====================================================================
-- OGŁOSZENIA NA DISCORDZIE (webhook) – nowa ankieta i wyniki ankiety
-- Wklej całość: SQL Editor → New query → Run
-- (wymaga wcześniej: supabase-glosowanie.sql i supabase-ustawienia.sql)
-- Adres webhooka wpisujesz potem na stronie: Ustawienia → Ogłoszenia na Discordzie.
-- =====================================================================

-- wysyłanie zapytań HTTP prosto z bazy (wbudowane w Supabase)
create extension if not exists pg_net;

-- ---------- ustawienia (widzi i zmienia TYLKO właściciel) ----------
create table if not exists public.discord_settings (
    id                     int primary key default 1 check (id = 1),
    webhook_url            text check (webhook_url is null or webhook_url ~ '^https://(ptb\.|canary\.)?discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'),
    mention                text not null default '' check (mention in ('', '@everyone', '@here')),
    announce_new_poll      boolean not null default true,
    announce_poll_results  boolean not null default true,
    updated_at             timestamptz not null default now()
);
alter table public.discord_settings enable row level security;
insert into public.discord_settings (id) values (1) on conflict do nothing;

drop policy if exists "Discord widzi właściciel" on public.discord_settings;
create policy "Discord widzi właściciel" on public.discord_settings
    for select to authenticated using (public.is_owner());
drop policy if exists "Discord zmienia właściciel" on public.discord_settings;
create policy "Discord zmienia właściciel" on public.discord_settings
    for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------- wysyłka (błąd Discorda nigdy nie blokuje zapisu ankiety) ----------
create or replace function public.discord_send(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_url text;
    v_id  bigint;
begin
    select webhook_url into v_url from discord_settings where id = 1;
    if v_url is null then return null; end if;
    select net.http_post(
        url     := v_url,
        body    := jsonb_strip_nulls(p_payload),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) into v_id;
    return v_id;
exception when others then
    raise warning 'discord_send: %', sqlerrm;
    return null;
end;
$$;
revoke all on function public.discord_send(jsonb) from public, anon, authenticated;

-- ---------- treść ogłoszeń ----------
create or replace function public.discord_on_poll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    s        discord_settings;
    v_site   text := 'https://zawlox.pl/#glosowanie';
    v_lines  text;
    v_total  int;
    v_max    int;
begin
    select * into s from discord_settings where id = 1;
    if s.webhook_url is null then return new; end if;

    -- nowa ankieta
    if tg_op = 'INSERT' and s.announce_new_poll and new.is_open then
        select string_agg('▫️ ' || (o.value #>> '{}'), E'\n' order by o.ord)
          into v_lines
          from jsonb_array_elements(new.options) with ordinality as o(value, ord);
        perform discord_send(jsonb_build_object(
            'content', nullif(s.mention, ''),
            'allowed_mentions', jsonb_build_object('parse', jsonb_build_array('everyone')),
            'embeds', jsonb_build_array(jsonb_build_object(
                'title', '📊 Nowa ankieta: ' || left(new.question, 200),
                'url', v_site,
                'color', 9520895,
                'description', v_lines || E'\n\n**[➜ Zagłosuj na stronie](' || v_site || E')**\nZa głos dostajesz **+5 pkt**!',
                'footer', jsonb_build_object('text',
                    case when new.closes_at is null then 'Ankieta bez limitu czasu'
                         else 'Głosowanie do ' || to_char(new.closes_at at time zone 'Europe/Warsaw', 'DD.MM, HH24:MI') end)
            ))
        ));

    -- ankieta zakończona → wyniki
    elsif tg_op = 'UPDATE' and s.announce_poll_results and old.is_open and not new.is_open then
        select count(*) into v_total from poll_votes where poll_id = new.id;
        select max(c) into v_max from (select count(*) c from poll_votes where poll_id = new.id group by option_idx) m;
        select string_agg(
                   case when v_total > 0 and coalesce(r.c, 0) = v_max then '🏆 **' else '▫️ ' end
                   || (o.value #>> '{}')
                   || case when v_total > 0 and coalesce(r.c, 0) = v_max then '**' else '' end
                   || E'\n`' || repeat('█', round(coalesce(r.c, 0) * 10.0 / greatest(v_total, 1))::int)
                   || repeat('░', 10 - round(coalesce(r.c, 0) * 10.0 / greatest(v_total, 1))::int)
                   || '` ' || round(coalesce(r.c, 0) * 100.0 / greatest(v_total, 1))::int || '% (' || coalesce(r.c, 0) || ')',
                   E'\n' order by o.ord)
          into v_lines
          from jsonb_array_elements(new.options) with ordinality as o(value, ord)
          left join (select option_idx, count(*) c from poll_votes where poll_id = new.id group by option_idx) r
                 on r.option_idx = o.ord - 1;
        perform discord_send(jsonb_build_object(
            'embeds', jsonb_build_array(jsonb_build_object(
                'title', '✅ Wyniki ankiety: ' || left(new.question, 200),
                'url', v_site,
                'color', 3066993,
                'description', v_lines,
                'footer', jsonb_build_object('text', 'Oddane głosy: ' || v_total)
            ))
        ));
    end if;
    return new;
end;
$$;

drop trigger if exists discord_on_poll on public.polls;
create trigger discord_on_poll after insert or update of is_open on public.polls
    for each row execute function public.discord_on_poll();

-- ---------- wiadomość testowa z panelu Ustawień ----------
create or replace function public.discord_test()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_owner() then raise exception 'Brak uprawnień'; end if;
    return discord_send(jsonb_build_object(
        'embeds', jsonb_build_array(jsonb_build_object(
            'title', '👋 Test ogłoszeń',
            'description', 'Działa! Tutaj będą pojawiać się ogłoszenia o nowych ankietach i ich wynikach ze strony Zawloxa.',
            'url', 'https://zawlox.pl/',
            'color', 9520895
        ))
    )) is not null;
end;
$$;
revoke all on function public.discord_test() from public, anon;
grant execute on function public.discord_test() to authenticated;

-- ---------- ankiety z limitem czasu: zamykanie co 5 minut (żeby wyniki poszły same) ----------
-- Jeśli ten krok pokaże błąd, włącz "pg_cron" w Database → Extensions i uruchom tylko tę część jeszcze raz.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'zamykanie-ankiet';
select cron.schedule('zamykanie-ankiet', '*/5 * * * *',
    $$update public.polls set is_open = false where is_open and closes_at is not null and closes_at < now()$$);
