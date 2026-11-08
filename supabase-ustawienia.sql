-- =====================================================================
-- USTAWIENIA – właściciel (Zawlox) nadaje uprawnienia do ankiet
-- i zmienia kolor strony. Wklej całość: SQL Editor → New query → Run
-- (wymaga wcześniej uruchomionego supabase-glosowanie.sql)
-- =====================================================================

-- ---------- role: owner = właściciel, admin = może tworzyć ankiety ----------
alter table public.admins add column if not exists role text not null default 'admin';
alter table public.admins add column if not exists added_at timestamptz not null default now();
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'admin'));

insert into public.admins (user_id, role)
values ('c6dbacf4-572e-4c7b-84f2-5d722ec20064', 'owner')
on conflict (user_id) do update set role = 'owner';

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from admins where user_id = auth.uid() and role = 'owner');
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- ---------- ankiety: administrator zarządza swoimi, właściciel wszystkimi ----------
drop policy if exists "Tylko admin zmienia ankiety" on public.polls;
create policy "Tylko admin zmienia ankiety" on public.polls
    for update to authenticated
    using (public.is_owner() or (public.is_admin() and created_by = auth.uid()))
    with check (public.is_owner() or (public.is_admin() and created_by = auth.uid()));

drop policy if exists "Tylko admin usuwa ankiety" on public.polls;
create policy "Tylko admin usuwa ankiety" on public.polls
    for delete to authenticated
    using (public.is_owner() or (public.is_admin() and created_by = auth.uid()));

-- ---------- lista osób, które logowały się na stronie (tylko dla właściciela) ----------
create or replace function public.list_users()
returns table (user_id uuid, name text, avatar_url text, role text, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_owner() then
        raise exception 'Brak uprawnień';
    end if;
    return query
        select u.id,
               coalesce(u.raw_user_meta_data->'custom_claims'->>'global_name',
                        u.raw_user_meta_data->>'full_name',
                        u.raw_user_meta_data->>'name', 'Gracz')::text,
               (u.raw_user_meta_data->>'avatar_url')::text,
               a.role,
               u.last_sign_in_at
          from auth.users u
          left join admins a on a.user_id = u.id
         order by (a.role is null), u.last_sign_in_at desc nulls last;
end;
$$;
revoke all on function public.list_users() from public, anon;
grant execute on function public.list_users() to authenticated;

-- nadanie / odebranie prawa do tworzenia ankiet (właściciela nie da się ruszyć)
create or replace function public.set_poll_admin(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_owner() then
        raise exception 'Brak uprawnień';
    end if;
    if exists (select 1 from admins where user_id = p_user and role = 'owner') then
        raise exception 'Nie można zmienić uprawnień właściciela';
    end if;
    if p_on then
        insert into admins (user_id, role) values (p_user, 'admin') on conflict (user_id) do nothing;
    else
        delete from admins where user_id = p_user and role = 'admin';
    end if;
end;
$$;
revoke all on function public.set_poll_admin(uuid, boolean) from public, anon;
grant execute on function public.set_poll_admin(uuid, boolean) to authenticated;

-- ---------- ustawienia strony (kolor) ----------
create table if not exists public.site_settings (
    id          int primary key default 1 check (id = 1),
    accent      text not null default '#9147ff' check (accent ~ '^#[0-9a-fA-F]{6}$'),
    updated_at  timestamptz not null default now()
);
alter table public.site_settings enable row level security;
insert into public.site_settings (id) values (1) on conflict do nothing;

drop policy if exists "Ustawienia widzi każdy" on public.site_settings;
create policy "Ustawienia widzi każdy" on public.site_settings
    for select using (true);

drop policy if exists "Ustawienia zmienia właściciel" on public.site_settings;
create policy "Ustawienia zmienia właściciel" on public.site_settings
    for update to authenticated
    using (public.is_owner()) with check (public.is_owner());
