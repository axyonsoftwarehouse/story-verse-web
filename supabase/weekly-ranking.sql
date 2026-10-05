-- Ranking semanal de leitores: minutos lidos de segunda a domingo (horário de Brasília), pódio
-- com os 3 primeiros, aviso para quem ficou no pódio e diamantes de recompensa. Ver src/lib/ranking.ts.
--
-- Como usar: Supabase › SQL Editor › New query › cole este arquivo inteiro › Run.
-- Pode rodar de novo sem problema. Rode DEPOIS de supabase/diamonds.sql (a carteira de diamantes).
--
-- Ninguém lê nem grava estas tabelas direto pela API: tudo passa pelas funções abaixo, que só
-- deixam cada pessoa informar os próprios minutos (com teto por dia) e só mostram nome, avatar e
-- total da semana dos outros. Quem não quiser aparecer pode se esconder (set_ranking_hidden).
--
-- A semana é fechada (pódio gravado e diamantes entregues) uma única vez, na primeira vez que
-- alguém abre o app depois de domingo — não precisa de pg_cron. Os minutos não "zeram": a
-- semana nova simplesmente soma só os dias dela.

-- Minutos de cada dia (em segundos), como o app conta (src/lib/readingStats.ts).
create table if not exists public.reading_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 43200),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- O que aparece no ranking (nome e avatar copiados do perfil).
create table if not exists public.ranking_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  avatar text,
  photo text,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Semanas já fechadas: depois disso os minutos delas não mudam mais.
create table if not exists public.weekly_closings (
  week_start date primary key,
  closed_at timestamptz not null default now()
);

-- Pódio de cada semana fechada; seen_at marca que a pessoa já viu o aviso.
create table if not exists public.weekly_awards (
  week_start date not null references public.weekly_closings (week_start) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  place smallint not null check (place between 1 and 3),
  minutes integer not null,
  diamonds integer not null,
  seen_at timestamptz,
  primary key (week_start, user_id)
);

-- Versão anterior guardava os diamantes aqui: passam para a carteira (pelo pódio de cada
-- semana, sem repetir) e a coluna sai.
select public.apply_diamonds(a.user_id, a.diamonds, 'ranking', a.week_start::text) from public.weekly_awards a;
alter table public.ranking_profiles drop column if exists diamonds;

alter table public.reading_days enable row level security;
alter table public.ranking_profiles enable row level security;
alter table public.weekly_closings enable row level security;
alter table public.weekly_awards enable row level security;
-- Sem regras nem grants: só as funções (security definer) mexem nas tabelas.
revoke all on public.reading_days, public.ranking_profiles, public.weekly_closings, public.weekly_awards from anon, authenticated;

-- Segunda-feira da semana atual (0), da passada (-1)... no horário de Brasília.
create or replace function public.ranking_week_start(p_offset integer default 0)
returns date
language sql
stable
set search_path = public
as $$
  select (date_trunc('week', now() at time zone 'America/Sao_Paulo'))::date + 7 * p_offset;
$$;

-- Ranking de uma semana (uso interno): os `p_limit` primeiros e a posição de `p_me`.
create or replace function public.ranking_for_week(p_week date, p_limit integer, p_me uuid)
returns table (place integer, user_id uuid, name text, avatar text, photo text, minutes integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select d.user_id, (sum(d.seconds) / 60)::integer as minutes, max(d.updated_at) as last_update
    from public.reading_days d
    where d.day >= p_week and d.day < p_week + 7
    group by d.user_id
  ),
  ranked as (
    -- Empate: fica na frente quem chegou primeiro ao total.
    select t.user_id, t.minutes,
           (row_number() over (order by t.minutes desc, t.last_update asc, t.user_id))::integer as place
    from totals t
    join public.ranking_profiles p on p.user_id = t.user_id
    where t.minutes >= 1 and not p.hidden
  )
  select r.place, r.user_id, p.name, p.avatar, p.photo, r.minutes, r.user_id = p_me
  from ranked r
  join public.ranking_profiles p on p.user_id = r.user_id
  where r.place <= p_limit or r.user_id = p_me
  order by r.place;
$$;

-- Fecha uma semana já terminada (uso interno): grava o pódio e entrega os diamantes, uma vez só.
-- Espera 1 hora depois de domingo para os minutos lidos no fim da noite chegarem.
create or replace function public.close_reading_week(p_week date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (p_week + 7)::timestamp + interval '1 hour' > (now() at time zone 'America/Sao_Paulo') then
    return;
  end if;
  insert into public.weekly_closings (week_start) values (p_week) on conflict do nothing;
  if not found then
    return; -- Já fechada (por outra pessoa, talvez agora mesmo).
  end if;
  insert into public.weekly_awards (week_start, user_id, place, minutes, diamonds)
  select p_week, r.user_id, r.place, r.minutes, (array[50, 30, 20])[r.place]
  from public.ranking_for_week(p_week, 3, null) r
  where r.place <= 3;
  perform public.apply_diamonds(a.user_id, a.diamonds, 'ranking', p_week::text)
  from public.weekly_awards a
  where a.week_start = p_week;
end;
$$;

-- O app envia os segundos lidos por dia ({"2026-10-05": 900, ...}). Vale o maior valor já
-- enviado para o dia (vários aparelhos), até 12 h por dia, só para dias da semana ainda aberta.
create or replace function public.report_reading(p_days jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  open_from date := public.ranking_week_start(-1);
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  photo_url text;
begin
  if uid is null then
    raise exception 'Entre na sua conta para participar do ranking.';
  end if;
  if exists (select 1 from public.weekly_closings c where c.week_start = open_from) then
    open_from := public.ranking_week_start(0);
  end if;

  insert into public.reading_days (user_id, day, seconds)
  select uid, v.day, v.seconds
  from (
    select case when e.key ~ '^\d{4}-\d{2}-\d{2}$' then e.key::date end as day,
           case when e.value ~ '^\d{1,9}(\.\d+)?$' then least(e.value::numeric, 43200)::integer end as seconds
    from jsonb_each_text(case when jsonb_typeof(p_days) = 'object' then p_days else '{}'::jsonb end) e
  ) v
  -- Até amanhã: quem está num fuso à frente de Brasília já pode estar no dia seguinte.
  where v.day between open_from and today + 1 and v.seconds > 0
  on conflict (user_id, day) do update
    set seconds = greatest(reading_days.seconds, excluded.seconds),
        updated_at = case when excluded.seconds > reading_days.seconds then now() else reading_days.updated_at end;

  -- Nome e avatar do perfil. Sem nome, não expõe o e-mail: aparece só "Leitor".
  select u.raw_user_meta_data into meta from auth.users u where u.id = uid;
  -- Só foto do próprio Storyverse (bucket profile-media), não qualquer endereço da internet.
  photo_url := case when meta ->> 'photo' like '%/storage/v1/object/public/profile-media/' || uid::text || '/%'
                    then left(meta ->> 'photo', 500) end;
  insert into public.ranking_profiles (user_id, name, avatar, photo)
  values (uid, left(coalesce(nullif(btrim(meta ->> 'name'), ''), 'Leitor'), 60), left(meta ->> 'avatar', 40), photo_url)
  on conflict (user_id) do update
    set name = excluded.name, avatar = excluded.avatar, photo = excluded.photo, updated_at = now()
    where (ranking_profiles.name, ranking_profiles.avatar, ranking_profiles.photo)
          is distinct from (excluded.name, excluded.avatar, excluded.photo);
end;
$$;

-- Ranking da semana atual (0) ou da passada (-1): até `p_limit` leitores e a sua posição.
create or replace function public.weekly_ranking(p_offset integer default 0, p_limit integer default 50)
returns table (place integer, user_id uuid, name text, avatar text, photo text, minutes integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.ranking_for_week(
    public.ranking_week_start(greatest(least(p_offset, 0), -1)),
    greatest(least(p_limit, 100), 3),
    auth.uid()
  );
$$;

-- Seus diamantes e se está escondido do ranking.
create or replace function public.my_ranking_profile()
returns table (hidden boolean, diamonds integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.hidden, false), coalesce(w.balance, 0)
  from (select auth.uid() as uid) me
  left join public.ranking_profiles p on p.user_id = me.uid
  left join public.diamond_wallets w on w.user_id = me.uid
  where me.uid is not null;
$$;

create or replace function public.set_ranking_hidden(p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para mudar isso.';
  end if;
  update public.ranking_profiles set hidden = p_hidden, updated_at = now() where user_id = auth.uid();
  if not found then
    insert into public.ranking_profiles (user_id, name, hidden) values (auth.uid(), 'Leitor', p_hidden)
    on conflict (user_id) do update set hidden = excluded.hidden;
  end if;
end;
$$;

-- Ao abrir o app: fecha a semana passada (se ainda não foi) e devolve os pódios que você
-- conquistou e ainda não viu. Depois de mostrar, o app chama mark_awards_seen.
create or replace function public.my_weekly_awards()
returns table (week_start date, place smallint, minutes integer, diamonds integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    return;
  end if;
  perform public.close_reading_week(public.ranking_week_start(-1));
  return query
    select a.week_start, a.place, a.minutes, a.diamonds
    from public.weekly_awards a
    where a.user_id = auth.uid() and a.seen_at is null
    order by a.week_start;
end;
$$;

create or replace function public.mark_awards_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.weekly_awards set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;

-- Funções internas não ficam expostas na API; as demais só para quem entrou.
revoke execute on function public.ranking_for_week(date, integer, uuid) from public, anon, authenticated;
revoke execute on function public.close_reading_week(date) from public, anon, authenticated;
revoke execute on function public.report_reading(jsonb) from public, anon;
revoke execute on function public.weekly_ranking(integer, integer) from public, anon;
revoke execute on function public.my_ranking_profile() from public, anon;
revoke execute on function public.set_ranking_hidden(boolean) from public, anon;
revoke execute on function public.my_weekly_awards() from public, anon;
revoke execute on function public.mark_awards_seen() from public, anon;
grant execute on function public.ranking_week_start(integer) to authenticated;
grant execute on function public.report_reading(jsonb) to authenticated;
grant execute on function public.weekly_ranking(integer, integer) to authenticated;
grant execute on function public.my_ranking_profile() to authenticated;
grant execute on function public.set_ranking_hidden(boolean) to authenticated;
grant execute on function public.my_weekly_awards() to authenticated;
grant execute on function public.mark_awards_seen() to authenticated;

-- Confere: deve aparecer a segunda-feira desta semana e 0 leitores (antes de alguém ler).
select public.ranking_week_start() as semana_atual, count(*) as leitores_na_semana
from public.reading_days where day >= public.ranking_week_start();
