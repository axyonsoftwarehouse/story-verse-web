-- Acervo da comunidade: leitores sugerem livros (domínio público, obra própria ou licença livre),
-- o admin aprova e eles aparecem para todos na estante "Da comunidade".
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema (tudo usa "if not exists" / "or replace").
-- A conta de admin precisa já existir (ter feito cadastro) antes de rodar.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

drop policy if exists "admin vê a si mesmo" on public.admins;
create policy "admin vê a si mesmo" on public.admins
  for select using (auth.uid() = user_id);

-- O Gmail ignora pontos no endereço; o Supabase não. Aceita as duas grafias.
insert into public.admins (user_id)
select id from auth.users
where lower(replace(split_part(email, '@', 1), '.', '')) = 'businesscodeplus'
  and lower(split_part(email, '@', 2)) = 'gmail.com'
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envios
-- ---------------------------------------------------------------------------
create table if not exists public.book_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  submitter_name text check (char_length(submitter_name) <= 60),
  title text not null check (char_length(title) between 1 and 120),
  author text check (char_length(author) <= 120),
  language text not null default 'pt' check (language in ('pt', 'en')),
  rights text not null check (rights in ('public_domain', 'own_work', 'free_license')),
  rights_note text check (char_length(rights_note) <= 500),
  characters text check (char_length(characters) <= 600),
  text_path text not null,
  char_count integer,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists book_submissions_status_idx on public.book_submissions (status, reviewed_at desc);

alter table public.book_submissions enable row level security;

-- Projetos novos do Supabase não liberam tabelas novas para a API: sem isto dá "permission
-- denied". As regras (policies) abaixo continuam decidindo o que cada um vê e muda.
grant select on public.book_submissions to anon, authenticated;
grant insert, update, delete on public.book_submissions to authenticated;
grant select on public.admins to authenticated;

-- Qualquer pessoa vê os aprovados; quem enviou vê os seus; o admin vê todos.
drop policy if exists "ver envios" on public.book_submissions;
create policy "ver envios" on public.book_submissions
  for select using (status = 'approved' or auth.uid() = user_id or public.is_admin());

-- Logado envia só em nome próprio, sempre como "em análise".
drop policy if exists "enviar livro" on public.book_submissions;
create policy "enviar livro" on public.book_submissions
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and reviewed_at is null and review_note is null);

-- Só o admin aprova, recusa ou edita.
drop policy if exists "admin revisa" on public.book_submissions;
create policy "admin revisa" on public.book_submissions
  for update using (public.is_admin()) with check (public.is_admin());

-- Admin remove qualquer um; quem enviou pode desistir enquanto está em análise.
drop policy if exists "remover envio" on public.book_submissions;
create policy "remover envio" on public.book_submissions
  for delete using (public.is_admin() or (auth.uid() = user_id and status = 'pending'));

-- ---------------------------------------------------------------------------
-- Arquivos (texto do livro, em .txt) — bucket privado, acesso pelas regras abaixo
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-books', 'community-books', false, 10485760, array['text/plain'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['text/plain'];

-- Envia só dentro da própria pasta (<id do usuário>/arquivo.txt).
drop policy if exists "enviar texto do livro" on storage.objects;
create policy "enviar texto do livro" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-books' and (storage.foldername(name))[1] = auth.uid()::text);

-- Lê: o dono, o admin, ou qualquer pessoa se o livro foi aprovado.
drop policy if exists "ler texto do livro" on storage.objects;
create policy "ler texto do livro" on storage.objects
  for select using (
    bucket_id = 'community-books'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.book_submissions s
        where s.text_path = storage.objects.name and s.status = 'approved'
      )
    )
  );

-- Apaga: o admin, ou o dono enquanto o envio não foi aprovado.
drop policy if exists "apagar texto do livro" on storage.objects;
create policy "apagar texto do livro" on storage.objects
  for delete using (
    bucket_id = 'community-books'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and not exists (
          select 1 from public.book_submissions s
          where s.text_path = storage.objects.name and s.status = 'approved'
        )
      )
    )
  );

-- Confere: deve aparecer o e-mail do admin.
select u.email as admin from public.admins a join auth.users u on u.id = a.user_id;
