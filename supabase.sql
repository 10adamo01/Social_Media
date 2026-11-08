-- =====================================================================
-- Ranking minigry Zawlox – wklej całość w Supabase: SQL Editor → New query → Run
-- =====================================================================
-- Jak to chroni ranking:
--  * nikt nie może dopisać wyniku bezpośrednio do tabeli – tylko przez funkcję submit_score
--  * każda gra musi zacząć się od start_game (serwer zapisuje godzinę startu)
--  * wynik jest odrzucany, jeśli gra trwała krócej niż 30 s albo dłużej niż 3 min,
--    jeśli sesję użyto drugi raz albo jeśli liczby są niemożliwe do osiągnięcia
--  * nazwa i avatar gracza są brane z konta Discord po stronie serwera, nie z przeglądarki
-- Gry w przeglądarce nie da się w 100% zabezpieczyć przed oszustami,
-- ale te reguły blokują proste podrabianie wyników.

-- ---------- tabele ----------
create table if not exists public.game_sessions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users on delete cascade,
    started_at  timestamptz not null default now(),
    used        boolean not null default false
);

create table if not exists public.scores (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references auth.users on delete cascade,
    player_name  text not null,
    avatar_url   text,
    score        integer not null check (score >= 0),
    hits         integer not null check (hits >= 0),
    shots        integer not null check (shots >= 0),
    created_at   timestamptz not null default now()
);
create index if not exists scores_user_best on public.scores (user_id, score desc);

-- ---------- reguły dostępu (RLS) ----------
alter table public.game_sessions enable row level security;
alter table public.scores enable row level security;

-- Wyniki może czytać każdy (ranking jest publiczny).
-- Brak reguł INSERT/UPDATE/DELETE = nikt nie zapisze nic bezpośrednio.
drop policy if exists "Ranking jest publiczny" on public.scores;
create policy "Ranking jest publiczny" on public.scores for select using (true);

-- ---------- start gry ----------
create or replace function public.start_game()
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
    -- sprzątanie starych / zużytych sesji tego gracza
    delete from game_sessions
     where user_id = auth.uid()
       and (used or started_at < now() - interval '10 minutes');
    insert into game_sessions (user_id) values (auth.uid()) returning id into sid;
    return sid;
end;
$$;

-- ---------- zapis wyniku ----------
create or replace function public.submit_score(p_session uuid, p_score int, p_hits int, p_shots int)
returns int   -- zwraca rekord gracza
language plpgsql
security definer
set search_path = public
as $$
declare
    s        game_sessions;
    meta     jsonb;
    elapsed  interval;
    best     int;
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

    elapsed := now() - s.started_at;
    -- gra trwa 3 s odliczania + 30 s; zostawiamy zapas na wolne łącze
    if elapsed < interval '30 seconds' or elapsed > interval '3 minutes' then
        raise exception 'invalid_time';
    end if;

    -- maks. 100 pkt za trafienie; więcej niż 150 trafień w 30 s jest niewykonalne
    if p_hits < 0 or p_shots < p_hits or p_hits > 150 or p_shots > 400
       or p_score < 0 or p_score > p_hits * 100 then
        raise exception 'invalid_stats';
    end if;

    select raw_user_meta_data into meta from auth.users where id = auth.uid();

    insert into scores (user_id, player_name, avatar_url, score, hits, shots)
    values (
        auth.uid(),
        left(coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name', meta ->> 'name', 'Gracz'), 32),
        meta ->> 'avatar_url',
        p_score, p_hits, p_shots
    );

    select max(score) into best from scores where user_id = auth.uid();
    return best;
end;
$$;

revoke all on function public.start_game() from public, anon;
revoke all on function public.submit_score(uuid, int, int, int) from public, anon;
grant execute on function public.start_game() to authenticated;
grant execute on function public.submit_score(uuid, int, int, int) to authenticated;

-- ---------- ranking: najlepszy wynik każdego gracza ----------
create or replace view public.leaderboard
with (security_invoker = true) as
select distinct on (user_id)
       user_id, player_name, avatar_url, score, hits, shots, created_at
  from public.scores
 order by user_id, score desc, created_at asc;

grant select on public.leaderboard to anon, authenticated;
