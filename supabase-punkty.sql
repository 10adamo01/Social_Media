-- =====================================================================
-- PUNKTY WIDZÓW + PROFIL
-- Punkty przyznaje wyłącznie baza (funkcje poniżej) – nikt nie może
-- dopisać ich sobie ze strony. Wklej całość: SQL Editor → New query → Run
-- (wymaga wcześniej uruchomionych: supabase-minigierki.sql i supabase-glosowanie.sql)
-- =====================================================================

-- ---------- historia punktów ----------
create table if not exists public.points_log (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users on delete cascade,
    amount      int  not null check (amount > 0 and amount <= 100),
    reason      text not null check (reason in ('daily', 'watch_stream', 'watch_video', 'game', 'game_best', 'vote')),
    ref         text,
    created_at  timestamptz not null default now()
);
create index if not exists points_log_user on public.points_log (user_id, created_at desc);
create index if not exists points_log_reason on public.points_log (user_id, reason, created_at desc);
alter table public.points_log enable row level security;

-- każdy widzi tylko SWOJĄ historię; zapisywać mogą wyłącznie funkcje bazy
drop policy if exists "Widzę swoje punkty" on public.points_log;
create policy "Widzę swoje punkty" on public.points_log
    for select to authenticated using (user_id = auth.uid());

-- początek dzisiejszego dnia (czas polski)
create or replace function public.pts_day_start()
returns timestamptz
language sql
stable
as $$
    select date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw';
$$;

create or replace function public.pts_total(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(sum(amount), 0) from points_log where user_id = p_user;
$$;
revoke all on function public.pts_total(uuid) from public, anon, authenticated;

-- ---------- codzienna wizyta: +10 raz dziennie ----------
create or replace function public.claim_daily()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then raise exception 'not_logged_in'; end if;
    perform pg_advisory_xact_lock(hashtext('pts' || uid::text));
    if exists (select 1 from points_log where user_id = uid and reason = 'daily' and created_at >= pts_day_start()) then
        return 0;
    end if;
    insert into points_log (user_id, amount, reason) values (uid, 10, 'daily');
    return 10;
end;
$$;
revoke all on function public.claim_daily() from public, anon;
grant execute on function public.claim_daily() to authenticated;

-- ---------- oglądanie na stronie: +1 pkt za minutę ----------
-- stream: max 120 pkt dziennie; filmy: max 40 dziennie i 15 na jeden film
-- między punktami musi minąć min. 55 s (kilka kart naraz nic nie da)
create or replace function public.watch_tick(p_kind text, p_ref text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    uid      uuid := auth.uid();
    v_reason text;
    v_cap    int;
    v_ref    text := left(coalesce(p_ref, ''), 40);
    v_last   timestamptz;
    v_today  int;
    v_reftd  int;
    v_give   int := 1;
begin
    if uid is null then raise exception 'not_logged_in'; end if;
    if p_kind = 'stream' then v_reason := 'watch_stream'; v_cap := 120;
    elsif p_kind = 'video' then v_reason := 'watch_video'; v_cap := 40;
    else raise exception 'bad_kind';
    end if;

    perform pg_advisory_xact_lock(hashtext('pts' || uid::text));

    select max(created_at) into v_last from points_log
     where user_id = uid and reason in ('watch_stream', 'watch_video');
    if v_last is not null and now() - v_last < interval '55 seconds' then v_give := 0; end if;

    if v_give > 0 then
        select coalesce(sum(amount), 0) into v_today from points_log
         where user_id = uid and reason = v_reason and created_at >= pts_day_start();
        if v_today >= v_cap then v_give := 0; end if;
    end if;

    if v_give > 0 and p_kind = 'video' then
        select coalesce(sum(amount), 0) into v_reftd from points_log
         where user_id = uid and reason = 'watch_video' and ref = v_ref and created_at >= pts_day_start();
        if v_reftd >= 15 then v_give := 0; end if;
    end if;

    if v_give > 0 then
        insert into points_log (user_id, amount, reason, ref) values (uid, v_give, v_reason, v_ref);
    end if;

    return json_build_object('awarded', v_give, 'total', pts_total(uid),
                             'capped', v_give = 0 and v_today is not null and v_today >= v_cap);
end;
$$;
revoke all on function public.watch_tick(text, text) from public, anon;
grant execute on function public.watch_tick(text, text) to authenticated;

-- ---------- minigierki: +3 za grę (max 10 gier dziennie), +10 za nowy rekord (max 3 dziennie) ----------
create or replace function public.pts_on_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cnt  int;
    v_prev int;
    v_best int;
begin
    select count(*) into v_cnt from points_log
     where user_id = new.user_id and reason = 'game' and created_at >= pts_day_start();
    if v_cnt < 10 then
        insert into points_log (user_id, amount, reason, ref) values (new.user_id, 3, 'game', new.game);
    end if;

    if new.game = 'reflex' then
        select min(score) into v_prev from scores where user_id = new.user_id and game = new.game and id <> new.id;
    else
        select max(score) into v_prev from scores where user_id = new.user_id and game = new.game and id <> new.id;
    end if;

    if v_prev is null
       or (new.game = 'reflex' and new.score < v_prev)
       or (new.game <> 'reflex' and new.score > v_prev) then
        select count(*) into v_best from points_log
         where user_id = new.user_id and reason = 'game_best' and created_at >= pts_day_start();
        if v_best < 3 then
            insert into points_log (user_id, amount, reason, ref) values (new.user_id, 10, 'game_best', new.game);
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists pts_on_score on public.scores;
create trigger pts_on_score after insert on public.scores
    for each row execute function public.pts_on_score();

-- ---------- ankiety: +5 za pierwszy głos w każdej ankiecie ----------
create or replace function public.pts_on_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (select 1 from points_log where user_id = new.user_id and reason = 'vote' and ref = new.poll_id::text) then
        insert into points_log (user_id, amount, reason, ref) values (new.user_id, 5, 'vote', new.poll_id::text);
    end if;
    return new;
end;
$$;
drop trigger if exists pts_on_vote on public.poll_votes;
create trigger pts_on_vote after insert on public.poll_votes
    for each row execute function public.pts_on_vote();

-- ---------- ranking widzów (publiczny: nick, avatar, punkty) ----------
create or replace function public.points_top(p_limit int default 10)
returns table (name text, avatar_url text, points bigint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(u.raw_user_meta_data->'custom_claims'->>'global_name',
                    u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name', 'Gracz')::text,
           (u.raw_user_meta_data->>'avatar_url')::text,
           t.points,
           coalesce(t.user_id = auth.uid(), false)
      from (select user_id, sum(amount) as points, max(created_at) as last_at
              from points_log group by user_id
             order by points desc, last_at asc
             limit least(greatest(coalesce(p_limit, 10), 1), 50)) t
      join auth.users u on u.id = t.user_id
     order by t.points desc, t.last_at asc;
$$;
grant execute on function public.points_top(int) to anon, authenticated;

-- ---------- mój profil ----------
create or replace function public.my_profile()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    uid   uuid := auth.uid();
    v_pts bigint;
begin
    if uid is null then raise exception 'not_logged_in'; end if;
    v_pts := pts_total(uid);
    return json_build_object(
        'points',     v_pts,
        'today',      (select coalesce(sum(amount), 0) from points_log where user_id = uid and created_at >= pts_day_start()),
        'rank',       case when v_pts = 0 then null else
                        (select count(*) + 1 from (select sum(amount) s from points_log group by user_id) t where t.s > v_pts) end,
        'players',    (select count(distinct user_id) from points_log),
        'stream_min', (select coalesce(sum(amount), 0) from points_log where user_id = uid and reason = 'watch_stream'),
        'video_min',  (select coalesce(sum(amount), 0) from points_log where user_id = uid and reason = 'watch_video'),
        'games',      (select count(*) from scores where user_id = uid),
        'records',    (select count(*) from points_log where user_id = uid and reason = 'game_best'),
        'votes',      (select count(*) from points_log where user_id = uid and reason = 'vote'),
        'by_reason',  (select coalesce(json_object_agg(reason, s), '{}'::json)
                         from (select reason, sum(amount) s from points_log where user_id = uid group by reason) x),
        'days',       (select coalesce(json_agg(d order by d desc), '[]'::json)
                         from (select distinct (created_at at time zone 'Europe/Warsaw')::date as d
                                 from points_log where user_id = uid
                                order by 1 desc limit 120) y),
        'joined',     (select created_at from auth.users where id = uid)
    );
end;
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
