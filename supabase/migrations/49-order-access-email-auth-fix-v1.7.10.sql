-- iMersSUPA v1.7.10 - Order Access + Free Checkout hardening
-- Existing installs: run this migration once.
begin;

-- Compatibility fix: member_access schemas in iMersSUPA use access_status in newer builds,
-- while older settlement helper only checked a column named status.
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
  if p_user_id is null then raise exception 'Product delivery requires a member user_id'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and role='member') then
    raise exception 'Member profile not found';
  end if;
  if not exists(select 1 from public.products where id=p_product_id) then
    raise exception 'Product not found';
  end if;

  select exists(select 1 from public.member_access where user_id=p_user_id and product_id=p_product_id) into v_exists;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='status') into v_has_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='access_status') into v_has_access_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='expires_at') into v_has_expires;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='created_at') into v_has_created;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='updated_at') into v_has_updated;

  if v_exists then
    v_sql := 'update public.member_access set ';
    if v_has_access_status then v_sql := v_sql || 'access_status=''active''';
    elsif v_has_status then v_sql := v_sql || 'status=''active''';
    else v_sql := v_sql || 'user_id=user_id'; end if;
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

-- Free orders do not need a payment transaction. They are completed and delivered immediately
-- when the checkout email belongs to an existing active member account.
create or replace function public.finalize_free_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_uid uuid;
  v_count integer := 0;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_order.grand_total,v_order.total_amount,0) <> 0 then raise exception 'Order is not free'; end if;

  v_uid := v_order.buyer_user_id;
  if v_uid is null then
    select p.id into v_uid
    from public.profiles p
    join auth.users u on u.id=p.id
    where lower(u.email)=lower(trim(v_order.buyer_email))
      and p.role='member' and p.status='active'
    order by p.created_at asc limit 1;
  end if;

  if v_uid is null then
    -- Keep the order valid but do not fabricate access for a non-existent member.
    update public.orders set status='completed',payment_status='paid',completed_at=coalesce(completed_at,now()),paid_at=coalesce(paid_at,now()) where id=p_order_id;
    return jsonb_build_object('order_id',p_order_id,'completed',true,'access_grants_count',0,'member_bound',false);
  end if;

  update public.orders set buyer_user_id=v_uid,status='completed',payment_status='paid',completed_at=coalesce(completed_at,now()),paid_at=coalesce(paid_at,now()) where id=p_order_id;
  for v_item in select * from public.order_items where order_id=p_order_id order by created_at,id loop
    if public.grant_paid_product_access(v_uid,v_item.product_id,p_order_id) then v_count:=v_count+1; end if;
  end loop;

  return jsonb_build_object('order_id',p_order_id,'completed',true,'access_grants_count',v_count,'member_bound',true);
end;
$$;
revoke all on function public.finalize_free_order(uuid) from public;

-- Bind anonymous checkout to an existing active member by email, then auto-finish Rp0 orders.
create or replace function public.create_checkout_order_secure(
  p_items jsonb,p_buyer_name text,p_buyer_email text,p_buyer_phone text default null,
  p_coupon_code text default null,p_visitor_key text default null,p_customer_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_expiry integer;
  v_uid uuid;
  v_total numeric;
begin
  v_result:=public.create_checkout_order_secure_core(p_items,p_buyer_name,p_buyer_email,p_buyer_phone,p_coupon_code,p_visitor_key,p_customer_note,p_idempotency_key);
  v_order_id:=nullif(v_result->>'order_id','')::uuid;

  if v_order_id is not null then
    select buyer_user_id,coalesce(grand_total,total_amount,0) into v_uid,v_total from public.orders where id=v_order_id;
    if v_uid is null then
      select p.id into v_uid
      from public.profiles p
      join auth.users u on u.id=p.id
      where lower(u.email)=lower(trim(p_buyer_email))
        and p.role='member' and p.status='active'
      order by p.created_at asc limit 1;
      if v_uid is not null then update public.orders set buyer_user_id=v_uid where id=v_order_id and buyer_user_id is null; end if;
    end if;

    if v_total=0 then
      perform public.finalize_free_order(v_order_id);
      v_result := v_result || jsonb_build_object('order_status','completed','payment_status','paid','free_order',true);
    elsif coalesce((v_result->>'idempotent_replay')::boolean,false)=false then
      select order_expiry_minutes into v_expiry from public.commerce_settings where id=1;
      update public.orders set expires_at=now()+make_interval(mins=>v_expiry)
      where id=v_order_id and payment_status in ('unpaid','pending');
    end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text) from public;
grant execute on function public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text) to anon,authenticated;

-- Repair existing Rp0 orders created before this migration.
do $$ declare r record; begin
  for r in select id from public.orders where coalesce(grand_total,total_amount,0)=0 and status in ('pending','awaiting_payment') loop
    perform public.finalize_free_order(r.id);
  end loop;
end $$;

commit;
