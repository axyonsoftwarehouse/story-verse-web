-- Dados de leitura de cada conta na nuvem (progresso, marcações, conversas, sequência, minutos
-- lidos, terminados e preferências), para não perder nada ao trocar de aparelho ou reinstalar.
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema.

create table if not exists public.reading_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reading_state enable row level security;

-- Cada pessoa só vê e grava os próprios dados.
drop policy if exists "ler os proprios dados" on public.reading_state;
create policy "ler os proprios dados" on public.reading_state
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "criar os proprios dados" on public.reading_state;
create policy "criar os proprios dados" on public.reading_state
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "atualizar os proprios dados" on public.reading_state;
create policy "atualizar os proprios dados" on public.reading_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Projetos novos do Supabase não liberam tabelas novas para a API; as regras acima continuam valendo.
grant select, insert, update on public.reading_state to authenticated;

-- Confere: deve aparecer a tabela (ainda vazia).
select count(*) as contas_sincronizadas from public.reading_state;
