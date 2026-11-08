create or replace function public.business_strategy_is_founder_member(target_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_business_strategy_founder() and exists (
    select 1
    from public.memberships m
    join public.positions p on p.id = m.position_id
    where m.id = target_membership_id
      and m.status = 'active'
      and p.key in ('ceo','cto','coo')
  );
$$;
