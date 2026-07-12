-- ToGW — Schéma Supabase
-- Exécutez dans Supabase → SQL Editor (ou via psql)

create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  slug text unique not null,
  date_evenement date not null,
  heure_debut time not null default '09:00',
  lieu text not null,
  prix_nouveau integer not null default 10000,
  prix_ancien integer not null default 8000,
  prix_top1 integer,
  places_max integer not null default 48,
  inscrits_count integer not null default 0,
  image_url text,
  badge text default 'MATCHRANKING #2',
  statut text not null default 'ouvert' check (statut in ('brouillon', 'ouvert', 'complet', 'termine')),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  nom text not null,
  prenom text not null,
  pseudo text,
  adresse text not null,
  telephone text not null,
  email text,
  ancien_participant boolean not null default false,
  code_inscription text unique not null,
  paye boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evenement_id, telephone)
);

create index if not exists idx_inscriptions_evenement on public.inscriptions(evenement_id);

create or replace function public.sync_evenement_inscrits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  total integer;
  max_places integer;
  current_statut text;
begin
  target_id := coalesce(new.evenement_id, old.evenement_id);

  select count(*)::integer into total
  from public.inscriptions
  where evenement_id = target_id;

  select places_max, statut into max_places, current_statut
  from public.evenements
  where id = target_id;

  update public.evenements
  set
    inscrits_count = total,
    statut = case
      when current_statut in ('termine', 'brouillon') then current_statut
      when total >= max_places then 'complet'
      else 'ouvert'
    end
  where id = target_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_evenement_inscrits on public.inscriptions;
create trigger trg_sync_evenement_inscrits
after insert or delete on public.inscriptions
for each row execute function public.sync_evenement_inscrits();

alter table public.evenements enable row level security;
alter table public.inscriptions enable row level security;

drop policy if exists "Lecture publique des événements" on public.evenements;
drop policy if exists "Insertion publique des inscriptions" on public.inscriptions;

create policy "Lecture publique des événements"
  on public.evenements for select
  using (actif = true);

create policy "Insertion publique des inscriptions"
  on public.inscriptions for insert
  with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.evenements to anon, authenticated;
grant insert on public.inscriptions to anon, authenticated;

insert into public.evenements (
  titre, slug, date_evenement, heure_debut, lieu,
  prix_nouveau, prix_ancien, prix_top1, places_max,
  image_url, badge, statut, actif
) values (
  'Matchranking #2 — 25 Juillet 2026',
  'matchranking-2-25-juillet-2026',
  '2026-07-25',
  '09:00',
  'Salle Polyvalente Toliara',
  10000,
  8000,
  100000,
  48,
  'assets/matchranking-2-affiche.png',
  'MATCHRANKING #2',
  'ouvert',
  true
) on conflict (slug) do update set
  titre = excluded.titre,
  date_evenement = excluded.date_evenement,
  heure_debut = excluded.heure_debut,
  lieu = excluded.lieu,
  prix_nouveau = excluded.prix_nouveau,
  prix_ancien = excluded.prix_ancien,
  prix_top1 = excluded.prix_top1,
  places_max = excluded.places_max,
  image_url = excluded.image_url,
  badge = excluded.badge,
  statut = excluded.statut,
  actif = excluded.actif;
