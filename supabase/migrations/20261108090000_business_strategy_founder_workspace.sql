create table public.business_strategies (
  id uuid primary key default gen_random_uuid(),
  pillar text not null check (pillar in ('foundation','topline','middleline','bottomline')),
  title text not null check (length(trim(title)) > 0),
  description text,
  metric_name text not null check (length(trim(metric_name)) > 0),
  target_value numeric(18,2) not null check (target_value > 0),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  unit_label text not null default 'unit',
  period_type text not null check (period_type in ('weekly','monthly','quarterly','annual','custom')),
  starts_on date not null,
  due_on date not null,
  owner_membership_id uuid not null references public.memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_on >= starts_on)
);

create table public.business_strategy_progress (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.business_strategies(id) on delete cascade,
  recorded_on date not null,
  value numeric(18,2) not null check (value >= 0),
  created_at timestamptz not null default now(),
  unique (strategy_id, recorded_on)
);

create index business_strategies_pillar_period_idx on public.business_strategies(pillar, period_type, due_on);
create index business_strategies_owner_idx on public.business_strategies(owner_membership_id);
create index business_strategy_progress_date_idx on public.business_strategy_progress(recorded_on, strategy_id);

alter table public.business_strategies enable row level security;
alter table public.business_strategy_progress enable row level security;

create or replace function public.is_business_strategy_founder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.positions p on p.id = m.position_id
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.key in ('ceo','cto','coo')
  );
$$;

create or replace function public.business_strategy_is_founder_member(target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.positions p on p.id = m.position_id
    where m.id = target_membership_id
      and m.status = 'active'
      and p.key in ('ceo','cto','coo')
  );
$$;

create or replace function public.business_strategy_founders()
returns table(membership_id uuid, full_name text, position_name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, coalesce(m.full_name, m.email::text), p.name
  from public.memberships m
  join public.positions p on p.id = m.position_id
  where public.is_business_strategy_founder()
    and m.status = 'active'
    and p.key in ('ceo','cto','coo')
  order by case p.key when 'ceo' then 1 when 'cto' then 2 else 3 end, m.full_name;
$$;

revoke all on function public.is_business_strategy_founder() from public, anon;
revoke all on function public.business_strategy_is_founder_member(uuid) from public, anon;
revoke all on function public.business_strategy_founders() from public, anon;
grant execute on function public.is_business_strategy_founder() to authenticated;
grant execute on function public.business_strategy_is_founder_member(uuid) to authenticated;
grant execute on function public.business_strategy_founders() to authenticated;

grant select, insert, update, delete on public.business_strategies to authenticated;
grant select, insert, update on public.business_strategy_progress to authenticated;

create policy business_strategies_founders_select
  on public.business_strategies for select to authenticated
  using ((select public.is_business_strategy_founder()));

create policy business_strategies_founders_insert
  on public.business_strategies for insert to authenticated
  with check (
    (select public.is_business_strategy_founder())
    and (select public.business_strategy_is_founder_member(owner_membership_id))
  );

create policy business_strategies_founders_update
  on public.business_strategies for update to authenticated
  using ((select public.is_business_strategy_founder()))
  with check (
    (select public.is_business_strategy_founder())
    and (select public.business_strategy_is_founder_member(owner_membership_id))
  );

create policy business_strategies_founders_delete
  on public.business_strategies for delete to authenticated
  using ((select public.is_business_strategy_founder()));

create policy business_strategy_progress_founders_select
  on public.business_strategy_progress for select to authenticated
  using ((select public.is_business_strategy_founder()));

create policy business_strategy_progress_founders_insert
  on public.business_strategy_progress for insert to authenticated
  with check ((select public.is_business_strategy_founder()));

create policy business_strategy_progress_founders_update
  on public.business_strategy_progress for update to authenticated
  using ((select public.is_business_strategy_founder()))
  with check ((select public.is_business_strategy_founder()));

create or replace function public.touch_business_strategy_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger business_strategies_touch_updated_at
  before update on public.business_strategies
  for each row execute function public.touch_business_strategy_updated_at();

create or replace function public.record_business_strategy_progress()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.current_value is distinct from new.current_value then
    insert into public.business_strategy_progress(strategy_id, recorded_on, value)
    values (new.id, timezone('Asia/Jakarta', now())::date, new.current_value)
    on conflict (strategy_id, recorded_on)
    do update set value = excluded.value;
  end if;
  return new;
end;
$$;

create trigger business_strategies_record_progress
  after insert or update of current_value on public.business_strategies
  for each row execute function public.record_business_strategy_progress();
