-- =====================================================================
-- GŁOSOWANIE – ankiety tworzy tylko administrator (konto Zawlox)
-- Wklej całość w Supabase: SQL Editor → New query → Run
-- =====================================================================

-- ---------- administratorzy ----------
-- Tabela bez żadnych reguł dostępu = nikt nie może jej czytać ani zmieniać ze strony.
-- Dopisać / usunąć administratora można tylko tutaj, w panelu Supabase.
create table if not exists public.admins (
    user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;

-- konto "zawlox" (Discord)
insert into public.admins (user_id)
values ('c6dbacf4-572e-4c7b-84f2-5d722ec20064')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- ankiety ----------
create table if not exists public.polls (
    id          bigint generated always as identity primary key,
    question    text not null check (char_length(question) between 3 and 140),
    options     jsonb not null check (
                    jsonb_typeof(options) = 'array'
                    and jsonb_array_length(options) between 2 and 6
                ),
    is_open     boolean not null default true,
    closes_at   timestamptz,
    created_by  uuid not null default auth.uid() references auth.users on delete cascade,
    created_at  timestamptz not null default now()
);
alter table public.polls enable row level security;

drop policy if exists "Ankiety widzi każdy" on public.polls;
create policy "Ankiety widzi każdy" on public.polls
    for select using (true);

drop policy if exists "Tylko admin dodaje ankiety" on public.polls;
create policy "Tylko admin dodaje ankiety" on public.polls
    for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Tylko admin zmienia ankiety" on public.polls;
create policy "Tylko admin zmienia ankiety" on public.polls
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Tylko admin usuwa ankiety" on public.polls;
create policy "Tylko admin usuwa ankiety" on public.polls
    for delete to authenticated using (public.is_admin());

-- ---------- głosy ----------
create table if not exists public.poll_votes (
    poll_id     bigint not null references public.polls on delete cascade,
    user_id     uuid not null default auth.uid() references auth.users on delete cascade,
    option_idx  int not null check (option_idx >= 0),
    created_at  timestamptz not null default now(),
    primary key (poll_id, user_id)          -- jeden głos na osobę w ankiecie
);
alter table public.poll_votes enable row level security;

-- czy ankieta przyjmuje głosy i czy wybrana odpowiedź istnieje
create or replace function public.poll_accepts(p_poll bigint, p_option int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from polls
         where id = p_poll
           and is_open
           and (closes_at is null or closes_at > now())
           and p_option < jsonb_array_length(options)
    );
$$;
grant execute on function public.poll_accepts(bigint, int) to authenticated;

-- każdy widzi tylko SWÓJ głos (głosowanie jest anonimowe)
drop policy if exists "Widzę swój głos" on public.poll_votes;
create policy "Widzę swój głos" on public.poll_votes
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "Głosuję za siebie" on public.poll_votes;
create policy "Głosuję za siebie" on public.poll_votes
    for insert to authenticated
    with check (user_id = auth.uid() and public.poll_accepts(poll_id, option_idx));

drop policy if exists "Zmieniam swój głos" on public.poll_votes;
create policy "Zmieniam swój głos" on public.poll_votes
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid() and public.poll_accepts(poll_id, option_idx));

drop policy if exists "Cofam swój głos" on public.poll_votes;
create policy "Cofam swój głos" on public.poll_votes
    for delete to authenticated
    using (user_id = auth.uid() and public.poll_accepts(poll_id, 0));

-- ---------- wyniki (sumy głosów, bez informacji kto jak głosował) ----------
create or replace function public.poll_results(p_poll bigint)
returns table (option_idx int, votes bigint)
language sql
stable
security definer
set search_path = public
as $$
    select option_idx, count(*) from poll_votes where poll_id = p_poll group by option_idx;
$$;
grant execute on function public.poll_results(bigint) to anon, authenticated;
