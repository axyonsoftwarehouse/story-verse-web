-- Diamantes: carteira de cada conta, extrato de tudo o que entrou e saiu e o Salva-ofensiva
-- (gastar diamantes para manter a sequência num dia sem leitura). Ver src/lib/diamonds.ts.
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema. Rode ANTES de supabase/weekly-ranking.sql (o pódio paga em
-- diamantes por aqui); a recompensa por leitura usa a tabela reading_days de lá.
--
-- Ninguém mexe no saldo pela API: só as funções abaixo, que travam a carteira da pessoa
-- (select ... for update) antes de mudar o saldo — dois pedidos ao mesmo tempo não gastam nem
-- ganham em dobro. Cada lançamento tem um motivo e uma referência únicos (ex.: a recompensa de
-- um dia, o salva-ofensiva de um dia), então repetir o pedido não repete o lançamento.
--
-- Compras (motivo 'purchase') ainda não existem: quando houver loja, a validação do recibo
-- (Google Play / App Store) fica numa Edge Function com a chave de serviço, que chama
-- apply_diamonds com a referência da compra. Nada aqui deixa o app se dar diamantes.

create table if not exists public.diamond_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.diamond_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index if not exists diamond_ledger_user_recent on public.diamond_ledger (user_id, created_at desc);
-- Motivos aceitos (recriado a cada execução, para incluir motivos novos em bancos já criados).
alter table public.diamond_ledger drop constraint if exists diamond_ledger_reason_check;
alter table public.diamond_ledger add constraint diamond_ledger_reason_check
  check (reason in ('ranking', 'reading_goal', 'streak_freeze', 'daily_spin', 'purchase', 'adjustment'));

-- Dias salvos com diamantes (a sequência continua, mas o dia não conta como lido).
create table if not exists public.streak_freezes (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.diamond_wallets enable row level security;
alter table public.diamond_ledger enable row level security;
alter table public.streak_freezes enable row level security;
-- Sem regras nem grants: só as funções (security definer) mexem nas tabelas.
revoke all on public.diamond_wallets, public.diamond_ledger, public.streak_freezes from anon, authenticated;

-- Regras da economia, num lugar só (o app lê por my_wallet para mostrar na loja).
create or replace function public.diamond_rules()
returns table (freeze_price integer, freezes_per_week integer, goal_minutes integer, goal_reward integer)
language sql
immutable
as $$
  select 10, 2, 10, 2;
$$;

-- Lança diamantes na carteira (uso interno). Positivo ganha, negativo gasta. Devolve o saldo
-- novo, ou null se esse lançamento (motivo + referência) já tinha sido feito.
create or replace function public.apply_diamonds(p_user uuid, p_amount integer, p_reason text, p_ref text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Lançamento sem valor.';
  end if;
  insert into public.diamond_wallets (user_id) values (p_user) on conflict do nothing;
  -- Trava a carteira: pedidos da mesma pessoa esperam um ao outro.
  select w.balance into bal from public.diamond_wallets w where w.user_id = p_user for update;
  if exists (select 1 from public.diamond_ledger l where l.user_id = p_user and l.reason = p_reason and l.ref = p_ref) then
    return null;
  end if;
  if bal + p_amount < 0 then
    raise exception 'Diamantes insuficientes.';
  end if;
  bal := bal + p_amount;
  update public.diamond_wallets set balance = bal, updated_at = now() where user_id = p_user;
  insert into public.diamond_ledger (user_id, amount, balance_after, reason, ref)
  values (p_user, p_amount, bal, p_reason, p_ref);
  return bal;
end;
$$;

-- Saldo, salva-ofensivas usados na semana (segunda a domingo, horário de Brasília) e as regras.
create or replace function public.my_wallet()
returns table (balance integer, freezes_this_week integer, freeze_price integer, freezes_per_week integer, goal_minutes integer, goal_reward integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select w.balance from public.diamond_wallets w where w.user_id = auth.uid()), 0),
    (select count(*)::integer from public.streak_freezes f
      where f.user_id = auth.uid()
        and f.day >= (date_trunc('week', now() at time zone 'America/Sao_Paulo'))::date),
    r.freeze_price, r.freezes_per_week, r.goal_minutes, r.goal_reward
  from public.diamond_rules() r
  where auth.uid() is not null;
$$;

-- Extrato: os últimos lançamentos, do mais novo para o mais antigo.
create or replace function public.my_diamond_history(p_limit integer default 30)
returns table (amount integer, balance_after integer, reason text, ref text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.amount, l.balance_after, l.reason, l.ref, l.created_at
  from public.diamond_ledger l
  where l.user_id = auth.uid()
  order by l.created_at desc, l.id desc
  limit greatest(least(p_limit, 100), 1);
$$;

-- Dias salvos com diamantes nos últimos 400 dias (para os outros aparelhos da conta).
create or replace function public.my_streak_freezes()
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  select f.day from public.streak_freezes f
  where f.user_id = auth.uid() and f.day >= current_date - 400
  order by f.day;
$$;

-- Salva-ofensiva: gasta diamantes para salvar os dias sem leitura (até 3 dias atrás). Tudo ou
-- nada: se faltar saldo ou passar do limite da semana, nenhum dia é salvo. Dia já salvo não é
-- cobrado de novo. Devolve o saldo.
create or replace function public.use_streak_freeze(p_days date[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rules record;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  new_days date[];
  d date;
  bal integer;
begin
  if uid is null then
    raise exception 'Entre na sua conta para usar o salva-ofensiva.';
  end if;
  select * into rules from public.diamond_rules();
  if coalesce(cardinality(p_days), 0) = 0 or cardinality(p_days) > rules.freezes_per_week then
    raise exception 'Escolha de 1 a % dias para salvar.', rules.freezes_per_week;
  end if;
  -- Até hoje (quem está num fuso à frente de Brasília) e no máximo 3 dias para trás.
  if exists (select 1 from unnest(p_days) x where x is null or x > today or x < today - 3) then
    raise exception 'Esse dia não pode mais ser salvo.';
  end if;

  -- Dia com leitura registrada (ex.: lida em outro aparelho) não precisa ser salvo.
  if exists (select 1 from public.reading_days r where r.user_id = uid and r.day = any (p_days) and r.seconds >= 60) then
    raise exception 'Você leu nesse dia: a sequência não precisa ser salva.';
  end if;

  insert into public.diamond_wallets (user_id) values (uid) on conflict do nothing;
  select w.balance into bal from public.diamond_wallets w where w.user_id = uid for update;

  select coalesce(array_agg(distinct x order by x), '{}') into new_days
  from unnest(p_days) x
  where not exists (select 1 from public.streak_freezes f where f.user_id = uid and f.day = x);
  if cardinality(new_days) = 0 then
    return bal;
  end if;

  -- Limite por semana (de cada dia salvo), contando os que já foram salvos nela.
  if exists (
    select 1
    from (select x - (extract(isodow from x)::integer - 1) as wk, count(*) as n from unnest(new_days) x group by 1) w
    where w.n + (select count(*) from public.streak_freezes f
                 where f.user_id = uid and f.day >= w.wk and f.day < w.wk + 7) > rules.freezes_per_week
  ) then
    raise exception 'Você já usou os % salva-ofensivas desta semana.', rules.freezes_per_week;
  end if;

  foreach d in array new_days loop
    bal := coalesce(public.apply_diamonds(uid, -rules.freeze_price, 'streak_freeze', d::text), bal);
    insert into public.streak_freezes (user_id, day) values (uid, d);
  end loop;
  return bal;
end;
$$;

-- Recompensa por leitura: cada dia (da última semana) com pelo menos 10 minutos lidos dá 2
-- diamantes, uma vez só. Os minutos vêm do que o app enviou para o ranking (reading_days).
-- Devolve os dias que já têm recompensa, marcando os ganhos agora.
create or replace function public.claim_reading_rewards()
returns table (day date, diamonds integer, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  rules record;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  r record;
  granted integer;
begin
  if uid is null then
    return;
  end if;
  select * into rules from public.diamond_rules();
  for r in
    select d.day from public.reading_days d
    where d.user_id = uid and d.day between today - 7 and today + 1 and d.seconds >= rules.goal_minutes * 60
    order by d.day
  loop
    granted := public.apply_diamonds(uid, rules.goal_reward, 'reading_goal', r.day::text);
    day := r.day;
    diamonds := rules.goal_reward;
    is_new := granted is not null;
    return next;
  end loop;
end;
$$;

-- Roleta diária: um giro por dia (horário de Brasília). O prêmio é sorteado aqui, nunca no app.
-- Chances: 1 💎 35% · 2 💎 30% · 3 💎 18% · 5 💎 12% · 10 💎 4% · 20 💎 1% (média ≈ 2,7 por dia).
create or replace function public.daily_spin_status()
returns table (spun_today boolean, prize integer)
language sql
stable
security definer
set search_path = public
as $$
  select l.amount is not null, l.amount
  from (select auth.uid() as uid) me
  left join public.diamond_ledger l
    on l.user_id = me.uid and l.reason = 'daily_spin'
   and l.ref = ((now() at time zone 'America/Sao_Paulo')::date)::text
  where me.uid is not null;
$$;

-- Gira a roleta. Se já girou hoje (outro aparelho, dois toques), devolve o prêmio de hoje sem
-- pagar de novo (is_new = false).
create or replace function public.spin_daily_wheel()
returns table (prize integer, is_new boolean, balance integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today text := ((now() at time zone 'America/Sao_Paulo')::date)::text;
  r double precision := random();
  won integer;
  bal integer;
begin
  if uid is null then
    raise exception 'Entre na sua conta para girar a roleta.';
  end if;
  won := case
    when r < 0.35 then 1
    when r < 0.65 then 2
    when r < 0.83 then 3
    when r < 0.95 then 5
    when r < 0.99 then 10
    else 20
  end;
  bal := public.apply_diamonds(uid, won, 'daily_spin', today);
  if bal is not null then
    return query select won, true, bal;
    return;
  end if;
  return query
    select l.amount, false, w.balance
    from public.diamond_ledger l
    join public.diamond_wallets w on w.user_id = l.user_id
    where l.user_id = uid and l.reason = 'daily_spin' and l.ref = today;
end;
$$;

-- Funções internas não ficam expostas na API; as demais só para quem entrou.
revoke execute on function public.apply_diamonds(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.my_wallet() from public, anon;
revoke execute on function public.my_diamond_history(integer) from public, anon;
revoke execute on function public.my_streak_freezes() from public, anon;
revoke execute on function public.use_streak_freeze(date[]) from public, anon;
revoke execute on function public.claim_reading_rewards() from public, anon;
grant execute on function public.diamond_rules() to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.my_diamond_history(integer) to authenticated;
grant execute on function public.my_streak_freezes() to authenticated;
grant execute on function public.use_streak_freeze(date[]) to authenticated;
grant execute on function public.claim_reading_rewards() to authenticated;
revoke execute on function public.daily_spin_status() from public, anon;
revoke execute on function public.spin_daily_wheel() from public, anon;
grant execute on function public.daily_spin_status() to authenticated;
grant execute on function public.spin_daily_wheel() to authenticated;

-- Confere: deve aparecer o preço do salva-ofensiva (10) e o limite por semana (2).
select freeze_price, freezes_per_week, goal_minutes, goal_reward from public.diamond_rules();
