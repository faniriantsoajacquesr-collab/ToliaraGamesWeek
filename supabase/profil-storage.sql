-- Storage bucket "profil" — avatars joueurs (inscription publique)

insert into storage.buckets (id, name, public)
values ('profil', 'profil', true)
on conflict (id) do update set public = true;

drop policy if exists "Lecture publique profil" on storage.objects;
drop policy if exists "Upload inscription profil" on storage.objects;

create policy "Lecture publique profil"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profil');

create policy "Upload inscription profil"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'profil');
