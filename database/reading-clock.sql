-- Install after weekly-ranking.sql / schema.sql. Totals from the client never grant rewards.
create table if not exists public.reading_clock (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_tick timestamptz not null,
  active boolean not null default false
);
alter table public.reading_clock enable row level security;
revoke all on public.reading_clock from public, anon, authenticated;

create or replace function public.reading_heartbeat(p_active boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  previous public.reading_clock%rowtype;
  tick timestamptz;
  credit integer := 0;
  today date;
begin
  if uid is null then raise exception 'Entre na sua conta.'; end if;
  -- Shared side of the weekly-closing lock: heartbeats run in parallel with each other, and no
  -- report may write a week after its awards are fixed (close_reading_week takes it exclusive).
  perform pg_advisory_xact_lock_shared(664332);
  tick := clock_timestamp();
  insert into public.reading_clock(user_id,last_tick,active) values(uid,tick,false) on conflict do nothing;
  select * into previous from public.reading_clock where user_id=uid for update;
  if p_active and previous.active and tick - previous.last_tick between interval '0 seconds' and interval '45 seconds' then
    credit := least(30, floor(extract(epoch from tick - previous.last_tick))::integer);
  end if;
  update public.reading_clock set last_tick=tick, active=coalesce(p_active,false) where user_id=uid;
  today := (tick at time zone 'America/Sao_Paulo')::date;
  if credit > 0 then
    insert into public.reading_days(user_id,day,seconds,updated_at) values(uid,today,credit,tick)
    on conflict(user_id,day) do update
      set seconds=least(43200,reading_days.seconds+excluded.seconds), updated_at=excluded.updated_at;
  end if;
  perform public.report_reading('{}'::jsonb);
  return credit;
end;
$$;
revoke execute on function public.reading_heartbeat(boolean) from public, anon;
grant execute on function public.reading_heartbeat(boolean) to authenticated;
