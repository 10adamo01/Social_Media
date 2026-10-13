-- =====================================================================
-- MINIGIERKI – aktualizacja bazy pod wiele gier
-- Wklej całość w Supabase: SQL Editor → New query → Run
-- Obecne wyniki z Aim Trainera zostają (dostaną oznaczenie gry 'aim').
-- =====================================================================

-- ---------- nowe kolumny ----------
alter table public.scores        add column if not exists game    text  not null default 'aim';
alter table public.scores        add column if not exists details jsonb;
alter table public.game_sessions add column if not exists game    text  not null default 'aim';
alter table public.scores alter column hits  drop not null;
alter table public.scores alter column shots drop not null;
create index if not exists scores_game_score on public.scores (game, score);

-- ---------- stare funkcje (tylko dla jednej gry) ----------
drop function if exists public.start_game();
drop function if exists public.submit_score(uuid, int, int, int);

-- ---------- start gry ----------
create or replace function public.start_game(p_game text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    sid uuid;
begin
    if auth.uid() is null then
        raise exception 'not_logged_in';
    end if;
    if p_game not in ('aim', 'reflex', 'memory', 'snake') then
        raise exception 'unknown_game';
    end if;
    delete from game_sessions
     where user_id = auth.uid()
       and (used or started_at < now() - interval '30 minutes');
    insert into game_sessions (user_id, game) values (auth.uid(), p_game) returning id into sid;
    return sid;
end;
$$;

-- ---------- zapis wyniku (każda gra ma własne reguły) ----------
create or replace function public.submit_score(p_session uuid, p_score int, p_details jsonb default '{}'::jsonb)
returns int   -- zwraca rekord gracza w tej grze
language plpgsql
security definer
set search_path = public
as $$
declare
    s      game_sessions;
    meta   jsonb;
    secs   numeric;
    v_hits int;
    v_shots int;
    v_ticks int;
    t_min  int;
    t_max  int;
    t_avg  numeric;
    best   int;
begin
    if auth.uid() is null then
        raise exception 'not_logged_in';
    end if;

    select * into s from game_sessions
     where id = p_session and user_id = auth.uid()
     for update;
    if not found or s.used then
        raise exception 'invalid_session';
    end if;
    update game_sessions set used = true where id = p_session;

    secs := extract(epoch from now() - s.started_at);
    if secs > 1800 or p_score is null or p_score < 0 then
        raise exception 'invalid_time';
    end if;
    p_details := coalesce(p_details, '{}'::jsonb);

    if s.game = 'aim' then
        -- 3 s odliczania + 30 s gry; maks. 100 pkt za trafienie
        v_hits  := (p_details ->> 'hits')::int;
        v_shots := (p_details ->> 'shots')::int;
        if secs < 30 or secs > 180 then raise exception 'invalid_time'; end if;
        if v_hits is null or v_shots is null or v_hits < 0 or v_shots < v_hits
           or v_hits > 150 or v_shots > 400 or p_score > v_hits * 100 then
            raise exception 'invalid_stats';
        end if;

    elsif s.game = 'reflex' then
        -- 5 prób, wynik = średni czas reakcji w ms (mniej = lepiej)
        if jsonb_typeof(p_details -> 'times') is distinct from 'array'
           or jsonb_array_length(p_details -> 'times') <> 5 then
            raise exception 'invalid_stats';
        end if;
        select min(v::int), max(v::int), avg(v::int)
          into t_min, t_max, t_avg
          from jsonb_array_elements_text(p_details -> 'times') as v;
        if t_min < 80 or t_max > 5000 or abs(round(t_avg) - p_score) > 1 then
            raise exception 'invalid_stats';
        end if;
        if secs < 7 then raise exception 'invalid_time'; end if;

    elsif s.game = 'memory' then
        -- wynik = długość najdłuższej powtórzonej sekwencji; samo pokazanie sekwencji zajmuje czas
        if p_score > 60 then raise exception 'invalid_stats'; end if;
        if secs < 0.5 * p_score * (p_score + 1) / 2.0 then raise exception 'invalid_time'; end if;

    elsif s.game = 'snake' then
        -- wynik = zebrane punkty; wąż porusza się nie szybciej niż co 60 ms
        v_ticks := (p_details ->> 'ticks')::int;
        if p_score > 397 or v_ticks is null or v_ticks < p_score then raise exception 'invalid_stats'; end if;
        if secs < v_ticks * 0.06 then raise exception 'invalid_time'; end if;

    else
        raise exception 'unknown_game';
    end if;

    select raw_user_meta_data into meta from auth.users where id = auth.uid();

    insert into scores (user_id, game, player_name, avatar_url, score, hits, shots, details)
    values (
        auth.uid(),
        s.game,
        left(coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name', meta ->> 'name', 'Gracz'), 32),
        meta ->> 'avatar_url',
        p_score,
        case when s.game = 'aim' then v_hits end,
        case when s.game = 'aim' then v_shots end,
        p_details
    );

    if s.game = 'reflex' then
        select min(score) into best from scores where user_id = auth.uid() and game = s.game;
    else
        select max(score) into best from scores where user_id = auth.uid() and game = s.game;
    end if;
    return best;
end;
$$;

revoke all on function public.start_game(text) from public, anon;
revoke all on function public.submit_score(uuid, int, jsonb) from public, anon;
grant execute on function public.start_game(text) to authenticated;
grant execute on function public.submit_score(uuid, int, jsonb) to authenticated;

-- ---------- ranking: najlepszy wynik każdego gracza w każdej grze ----------
-- (w Refleksie najlepszy = najniższy czas)
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = true) as
select distinct on (game, user_id)
       game, user_id, player_name, avatar_url, score, created_at
  from public.scores
 order by game, user_id,
          case when game = 'reflex' then score else -score end,
          created_at asc;

grant select on public.leaderboard to anon, authenticated;
