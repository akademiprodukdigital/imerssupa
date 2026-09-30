-- ============================================================
-- iMersSUPA v1.7.20
-- Agency = Member capabilities + Agency management capabilities
-- IMPORTANT: product purchase/access MUST NOT be blocked by profile role.
-- Existing install: run once in Supabase SQL Editor.
-- ============================================================

begin;

-- 1) Paid product delivery is USER based, not ROLE based.
--    An authenticated profile may be member, agency, admin or super_admin
--    and still own purchased product access.
create or replace function public.grant_paid_product_access(
  p_user_id uuid,
  p_product_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_has_status boolean;
  v_has_access_status boolean;
  v_has_expires boolean;
  v_has_created boolean;
  v_has_updated boolean;
  v_exists boolean;
  v_sql text;
begin
  if p_user_id is null then
    raise exception 'Product delivery requires a user_id';
  end if;

  if not exists(
    select 1 from public.profiles
    where id=p_user_id and coalesce(status,'active')='active'
  ) then
    raise exception 'Active customer profile not found';
  end if;

  if not exists(select 1 from public.products where id=p_product_id) then
    raise exception 'Product not found';
  end if;

  select exists(
    select 1 from public.member_access
    where user_id=p_user_id and product_id=p_product_id
  ) into v_exists;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='status') into v_has_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='access_status') into v_has_access_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='expires_at') into v_has_expires;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='created_at') into v_has_created;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='updated_at') into v_has_updated;

  if v_exists then
    v_sql := 'update public.member_access set ';
    if v_has_access_status then
      v_sql := v_sql || 'access_status=''active''';
    elsif v_has_status then
      v_sql := v_sql || 'status=''active''';
    else
      v_sql := v_sql || 'user_id=user_id';
    end if;
    if v_has_updated then v_sql := v_sql || ',updated_at=now()'; end if;
    v_sql := v_sql || ' where user_id=$1 and product_id=$2';
    execute v_sql using p_user_id,p_product_id;
    return false;
  end if;

  v_sql := 'insert into public.member_access (user_id,product_id';
  if v_has_access_status then v_sql := v_sql || ',access_status';
  elsif v_has_status then v_sql := v_sql || ',status'; end if;
  if v_has_expires then v_sql := v_sql || ',expires_at'; end if;
  if v_has_created then v_sql := v_sql || ',created_at'; end if;
  if v_has_updated then v_sql := v_sql || ',updated_at'; end if;

  v_sql := v_sql || ') values ($1,$2';
  if v_has_access_status or v_has_status then v_sql := v_sql || ',''active'''; end if;
  if v_has_expires then v_sql := v_sql || ',null'; end if;
  if v_has_created then v_sql := v_sql || ',now()'; end if;
  if v_has_updated then v_sql := v_sql || ',now()'; end if;
  v_sql := v_sql || ')';

  execute v_sql using p_user_id,p_product_id;
  return true;
end;
$$;

revoke all on function public.grant_paid_product_access(uuid,uuid,uuid) from public;
grant execute on function public.grant_paid_product_access(uuid,uuid,uuid) to authenticated;
grant execute on function public.grant_paid_product_access(uuid,uuid,uuid) to service_role;

-- 2) Browser access: product ownership follows member_access.user_id,
--    regardless of whether the owner is member/agency/admin.
--    These additive policies do not remove existing policies.
alter table public.member_access enable row level security;

drop policy if exists "member_access_owner_read_any_role" on public.member_access;
create policy "member_access_owner_read_any_role"
on public.member_access
for select
to authenticated
using (user_id = auth.uid());

-- Products owned through member_access must be readable by their owner.
-- Keep existing admin/public/member policies intact.
alter table public.products enable row level security;
drop policy if exists "products_owned_access_any_role" on public.products;
create policy "products_owned_access_any_role"
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.member_access ma
    where ma.user_id = auth.uid()
      and ma.product_id = products.id
      and (
        (to_jsonb(ma)->>'access_status') is null
        or (to_jsonb(ma)->>'access_status') = 'active'
      )
      and (
        (to_jsonb(ma)->>'status') is null
        or (to_jsonb(ma)->>'status') = 'active'
      )
      and (
        (to_jsonb(ma)->>'expires_at') is null
        or nullif(to_jsonb(ma)->>'expires_at','')::timestamptz > now()
      )
  )
);

-- Sections/content follow product ownership through member_access.
alter table public.product_sections enable row level security;
drop policy if exists "product_sections_owned_access_any_role" on public.product_sections;
create policy "product_sections_owned_access_any_role"
on public.product_sections
for select
to authenticated
using (
  exists (
    select 1 from public.member_access ma
    where ma.user_id=auth.uid()
      and ma.product_id=product_sections.product_id
      and ((to_jsonb(ma)->>'access_status') is null or (to_jsonb(ma)->>'access_status')='active')
      and ((to_jsonb(ma)->>'status') is null or (to_jsonb(ma)->>'status')='active')
      and ((to_jsonb(ma)->>'expires_at') is null or nullif(to_jsonb(ma)->>'expires_at','')::timestamptz > now())
  )
);

alter table public.product_contents enable row level security;
drop policy if exists "product_contents_owned_access_any_role" on public.product_contents;
create policy "product_contents_owned_access_any_role"
on public.product_contents
for select
to authenticated
using (
  is_published=true
  and exists (
    select 1 from public.member_access ma
    where ma.user_id=auth.uid()
      and ma.product_id=product_contents.product_id
      and ((to_jsonb(ma)->>'access_status') is null or (to_jsonb(ma)->>'access_status')='active')
      and ((to_jsonb(ma)->>'status') is null or (to_jsonb(ma)->>'status')='active')
      and ((to_jsonb(ma)->>'expires_at') is null or nullif(to_jsonb(ma)->>'expires_at','')::timestamptz > now())
  )
);

commit;

-- Verification: role must NOT be part of ownership rule.
select
  to_regprocedure('public.grant_paid_product_access(uuid,uuid,uuid)') is not null as grant_function_ok,
  exists(select 1 from pg_policies where schemaname='public' and tablename='member_access' and policyname='member_access_owner_read_any_role') as access_policy_ok,
  exists(select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_owned_access_any_role') as product_policy_ok;
