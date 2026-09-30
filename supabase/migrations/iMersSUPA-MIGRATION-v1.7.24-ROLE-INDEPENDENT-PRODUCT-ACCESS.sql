-- iMersSUPA v1.7.24
-- Order/product access is independent from account role.
-- Existing member/agency/admin/super_admin roles are preserved.
begin;

create or replace function public.admin_bind_order_buyer(p_order_id uuid,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.orders where id=p_order_id) then raise exception 'Order not found'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Target account profile not found'; end if;
  update public.orders set buyer_user_id=p_user_id where id=p_order_id;
  return true;
end; $$;
revoke all on function public.admin_bind_order_buyer(uuid,uuid) from public;
grant execute on function public.admin_bind_order_buyer(uuid,uuid) to authenticated;

create or replace function public.grant_paid_product_access(p_user_id uuid,p_product_id uuid,p_order_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_has_status boolean; v_has_access_status boolean; v_has_expires boolean;
  v_has_created boolean; v_has_updated boolean; v_exists boolean; v_sql text;
begin
  if p_user_id is null then raise exception 'Product delivery requires a user_id'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Account profile not found'; end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
  select exists(select 1 from public.member_access where user_id=p_user_id and product_id=p_product_id) into v_exists;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='status') into v_has_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='access_status') into v_has_access_status;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='expires_at') into v_has_expires;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='created_at') into v_has_created;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access' and column_name='updated_at') into v_has_updated;
  if v_exists then
    v_sql := 'update public.member_access set ';
    if v_has_access_status then v_sql := v_sql || 'access_status=''active''';
    elsif v_has_status then v_sql := v_sql || 'status=''active'''; else v_sql := v_sql || 'user_id=user_id'; end if;
    if v_has_updated then v_sql := v_sql || ',updated_at=now()'; end if;
    v_sql := v_sql || ' where user_id=$1 and product_id=$2'; execute v_sql using p_user_id,p_product_id; return false;
  end if;
  v_sql := 'insert into public.member_access (user_id,product_id';
  if v_has_access_status then v_sql := v_sql || ',access_status'; elsif v_has_status then v_sql := v_sql || ',status'; end if;
  if v_has_expires then v_sql := v_sql || ',expires_at'; end if;
  if v_has_created then v_sql := v_sql || ',created_at'; end if;
  if v_has_updated then v_sql := v_sql || ',updated_at'; end if;
  v_sql := v_sql || ') values ($1,$2';
  if v_has_access_status or v_has_status then v_sql := v_sql || ',''active'''; end if;
  if v_has_expires then v_sql := v_sql || ',null'; end if;
  if v_has_created then v_sql := v_sql || ',now()'; end if;
  if v_has_updated then v_sql := v_sql || ',now()'; end if;
  v_sql := v_sql || ')'; execute v_sql using p_user_id,p_product_id; return true;
end; $$;
revoke all on function public.grant_paid_product_access(uuid,uuid,uuid) from public;

create or replace function public.imers_resolve_order_buyer(p_order_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_uid uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_uid:=v_order.buyer_user_id;
  if v_uid is null and nullif(trim(coalesce(v_order.buyer_email,'')),'') is not null then
    select p.id into v_uid from public.profiles p join auth.users u on u.id=p.id
    where lower(coalesce(u.email,''))=lower(trim(v_order.buyer_email))
    order by u.created_at asc limit 1;
    if v_uid is not null then update public.orders set buyer_user_id=v_uid where id=p_order_id and buyer_user_id is null; end if;
  end if;
  return v_uid;
end; $$;
revoke all on function public.imers_resolve_order_buyer(uuid) from public;

grant execute on function public.admin_activate_order_simple(uuid) to authenticated;
commit;

-- Rp0/free checkout follows the same role-independent account rule.
create or replace function public.finalize_free_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_item public.order_items%rowtype; v_uid uuid; v_count integer:=0;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if coalesce(v_order.grand_total,v_order.total_amount,0)<>0 then raise exception 'Order is not free'; end if;
  v_uid:=public.imers_resolve_order_buyer(p_order_id);
  update public.orders set buyer_user_id=coalesce(v_uid,buyer_user_id),status='completed',payment_status='paid',completed_at=coalesce(completed_at,now()),paid_at=coalesce(paid_at,now()) where id=p_order_id;
  if v_uid is not null then
    for v_item in select * from public.order_items where order_id=p_order_id order by created_at,id loop
      if public.grant_paid_product_access(v_uid,v_item.product_id,p_order_id) then v_count:=v_count+1; end if;
    end loop;
  end if;
  return jsonb_build_object('order_id',p_order_id,'completed',true,'access_grants_count',v_count,'member_bound',v_uid is not null);
end; $$;
revoke all on function public.finalize_free_order(uuid) from public;

create or replace function public.create_checkout_order_secure(
  p_items jsonb,p_buyer_name text,p_buyer_email text,p_buyer_phone text default null,
  p_coupon_code text default null,p_visitor_key text default null,p_customer_note text default null,
  p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_order_id uuid; v_expiry integer; v_uid uuid; v_total numeric;
begin
  v_result:=public.create_checkout_order_secure_core(p_items,p_buyer_name,p_buyer_email,p_buyer_phone,p_coupon_code,p_visitor_key,p_customer_note,p_idempotency_key);
  v_order_id:=nullif(v_result->>'order_id','')::uuid;
  if v_order_id is not null then
    v_uid:=public.imers_resolve_order_buyer(v_order_id);
    select coalesce(grand_total,total_amount,0) into v_total from public.orders where id=v_order_id;
    if v_total=0 then
      perform public.finalize_free_order(v_order_id);
      v_result:=v_result||jsonb_build_object('order_status','completed','payment_status','paid','free_order',true);
    elsif coalesce((v_result->>'idempotent_replay')::boolean,false)=false then
      select order_expiry_minutes into v_expiry from public.commerce_settings where id=1;
      update public.orders set expires_at=now()+make_interval(mins=>v_expiry) where id=v_order_id and payment_status in ('unpaid','pending');
    end if;
  end if;
  return v_result;
end; $$;
revoke all on function public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text) from public;
grant execute on function public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text) to anon,authenticated;
