-- Livros importados de cada conta (texto, capa e ilustrações, comprimidos), para o livro
-- importado na Web aparecer no app instalado e vice-versa. Ver src/lib/bookSync.ts.
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema.
--
-- Privado: ninguém lê pelo endereço; cada pessoa só lê, envia e apaga a própria pasta
-- (user-books/<id da conta>/<livro>.json.gz). O limite de 50 MB é o máximo por arquivo do
-- plano gratuito do Supabase; um livro comum comprimido fica bem abaixo de 1 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-books', 'user-books', false, 52428800, array['application/gzip'])
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = array['application/gzip'];

drop policy if exists "ler os proprios livros" on storage.objects;
create policy "ler os proprios livros" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "enviar os proprios livros" on storage.objects;
create policy "enviar os proprios livros" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-books' and (storage.foldername(name))[1] = auth.uid()::text);

-- Enviar de novo o mesmo livro (x-upsert) é uma atualização.
drop policy if exists "trocar os proprios livros" on storage.objects;
create policy "trocar os proprios livros" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'user-books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "apagar os proprios livros" on storage.objects;
create policy "apagar os proprios livros" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = auth.uid()::text);

-- Confere: deve aparecer uma linha com user-books (public = false).
select id, public, file_size_limit from storage.buckets where id = 'user-books';
