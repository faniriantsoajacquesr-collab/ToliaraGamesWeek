-- RLS pour players et tournament_participants (inscription ToGW)

alter table public.players enable row level security;
alter table public.tournament_participants enable row level security;

drop policy if exists "Lecture publique players" on public.players;
drop policy if exists "Insertion publique players" on public.players;
drop policy if exists "Lecture publique tournament_participants" on public.tournament_participants;
drop policy if exists "Insertion publique tournament_participants" on public.tournament_participants;

create policy "Lecture publique players"
  on public.players for select
  using (true);

create policy "Insertion publique players"
  on public.players for insert
  with check (true);

create policy "Lecture publique tournament_participants"
  on public.tournament_participants for select
  using (true);

create policy "Insertion publique tournament_participants"
  on public.tournament_participants for insert
  with check (true);

grant select, insert on public.players to anon, authenticated;
grant select, insert on public.tournament_participants to anon, authenticated;
