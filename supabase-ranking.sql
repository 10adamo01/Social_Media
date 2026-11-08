-- =====================================================================
-- RANKING NAJAKTYWNIEJSZYCH WIDZÓW + ranga "Twórca" dla właściciela
-- Wklej całość: SQL Editor → New query → Run
-- (wymaga wcześniej: supabase-ustawienia.sql i supabase-punkty.sql)
-- Właściciel (Twórca) nie zajmuje miejsc w rankingu widzów.
-- =====================================================================

-- ---------- pełny ranking: okres (week / month / all) i kategoria (all / watch / games) ----------
create or replace function public.points_ranking(p_period text default 'all', p_category text default 'all', p_limit int default 50)
returns table (pos bigint, name text, avatar_url text, points bigint, minutes bigint, games bigint, active_days bigint, is_me boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_since   timestamptz;
    v_reasons text[];
    v_limit   int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
    v_since := case p_period
        when 'week'  then date_trunc('week',  now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
        when 'month' then date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
        else '-infinity'::timestamptz end;
    v_reasons := case p_category
        when 'watch' then array['watch_stream', 'watch_video']
        when 'games' then array['game', 'game_best']
        else null end;

    return query
    with agg as (
        select l.user_id,
               sum(l.amount)::bigint                                                         as pts,
               coalesce(sum(l.amount) filter (where l.reason like 'watch%'), 0)::bigint       as mins,
               count(*) filter (where l.reason = 'game')::bigint                              as gms,
               count(distinct (l.created_at at time zone 'Europe/Warsaw')::date)::bigint      as days,
               max(l.created_at)                                                              as last_at
          from points_log l
         where l.created_at >= v_since
           and (v_reasons is null or l.reason = any (v_reasons))
           and not exists (select 1 from admins a where a.user_id = l.user_id and a.role = 'owner')
         group by l.user_id
    ), ranked as (
        select agg.*, row_number() over (order by agg.pts desc, agg.last_at asc) as rn from agg
    )
    select r.rn,
           coalesce(u.raw_user_meta_data->'custom_claims'->>'global_name',
                    u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name', 'Gracz')::text,
           (u.raw_user_meta_data->>'avatar_url')::text,
           r.pts, r.mins, r.gms, r.days,
           coalesce(r.user_id = auth.uid(), false)
      from ranked r
      join auth.users u on u.id = r.user_id
     where r.rn <= v_limit or r.user_id = auth.uid()     -- zalogowany zawsze widzi swoje miejsce
     order by r.rn;
end;
$$;
grant execute on function public.points_ranking(text, text, int) to anon, authenticated;

-- ---------- top na stronie głównej – też bez Twórcy ----------
create or replace function public.points_top(p_limit int default 10)
returns table (name text, avatar_url text, points bigint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
    select r.name, r.avatar_url, r.points, r.is_me
      from public.points_ranking('all', 'all', p_limit) r
     where r.pos <= least(greatest(coalesce(p_limit, 10), 1), 50)
     order by r.pos;
$$;
grant execute on function public.points_top(int) to anon, authenticated;

-- ---------- profil: ranga konta + miejsce liczone bez Twórcy ----------
create or replace function public.my_profile()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    uid    uuid := auth.uid();
    v_pts  bigint;
    v_role text;
begin
    if uid is null then raise exception 'not_logged_in'; end if;
    v_pts  := pts_total(uid);
    select role into v_role from admins where user_id = uid;
    return json_build_object(
        'points',     v_pts,
        'role',       v_role,                -- 'owner' = Twórca, 'admin' = administrator ankiet
        'today',      (select coalesce(sum(amount), 0) from points_log where user_id = uid and created_at >= pts_day_start()),
        'rank',       case when v_pts = 0 or v_role = 'owner' then null else
                        (select count(*) + 1 from (
                            select sum(l.amount) s from points_log l
                             where not exists (select 1 from admins a where a.user_id = l.user_id and a.role = 'owner')
                             group by l.user_id) t
                          where t.s > v_pts) end,
        'players',    (select count(distinct l.user_id) from points_log l
                        where not exists (select 1 from admins a where a.user_id = l.user_id and a.role = 'owner')),
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
