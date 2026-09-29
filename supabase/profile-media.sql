-- Foto de perfil e foto de capa dos leitores.
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema.
--
-- O app já reduz as imagens antes de enviar (perfil 256×256, capa 1500×500, WebP/JPEG):
-- ficam com ~20–150 KB. O limite de 2 MB aqui é só uma trava de segurança.
-- Cada pessoa usa a própria pasta: profile-media/<id da conta>/avatar e /cover.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

-- Leitura: o bucket é público (as imagens abrem pelo endereço, como qualquer foto de perfil).
drop policy if exists "ver fotos de perfil" on storage.objects;
create policy "ver fotos de perfil" on storage.objects
  for select using (bucket_id = 'profile-media');

-- Enviar, trocar e apagar: só dentro da própria pasta.
drop policy if exists "enviar foto de perfil" on storage.objects;
create policy "enviar foto de perfil" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "trocar foto de perfil" on storage.objects;
create policy "trocar foto de perfil" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "apagar foto de perfil" on storage.objects;
create policy "apagar foto de perfil" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Confere: deve aparecer uma linha com profile-media.
select id, public, file_size_limit from storage.buckets where id = 'profile-media';
