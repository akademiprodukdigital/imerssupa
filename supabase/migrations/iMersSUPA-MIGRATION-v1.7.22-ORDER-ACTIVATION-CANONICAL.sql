-- iMersSUPA v1.7.22
-- Canonical order activation/member binding repair
-- SQL MIGRATION: REQUIRED
begin;

-- Resolve an order buyer through auth.users.email. profiles intentionally has no email column.
create or replace function public.imers_resolve_order_buyer(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_uid uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  v_uid := v_order.buyer_user_id;
  if v_uid is null and nullif(trim(coalesce(v_order.buyer_email,'')),'') is not null then
    select p.id into v_uid
    from public.profiles p
    join auth.users u on u.id=p.id
    where lower(coalesce(u.email,''))=lower(trim(v_order.buyer_email))
      and p.role='member'
      and p.status='active'
    order by u.created_at asc
    limit 1;

    if v_uid is not null then
      update public.orders set buyer_user_id=v_uid where id=p_order_id and buyer_user_id is null;
    end if;
  end if;
  return v_uid;
end;
$$;
revoke all on function public.imers_resolve_order_buyer(uuid) from public;

-- Admin's single canonical manual activation path.
create or replace function public.admin_activate_order_simple(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_uid uuid;
  v_item public.order_items%rowtype;
  v_grants integer := 0;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('cancelled','expired','refunded') then
    raise exception 'Order % tidak dapat diaktifkan',v_order.status;
  end if;

  v_uid := public.imers_resolve_order_buyer(v_order.id);
  if v_uid is null then
    raise exception 'Member aktif dengan email % belum ditemukan',coalesce(v_order.buyer_email,'-');
  end if;

  update public.orders
  set buyer_user_id=v_uid,
      status='completed',
      payment_status='paid',
      paid_at=coalesce(paid_at,now()),
      completed_at=coalesce(completed_at,now())
  where id=v_order.id;

  update public.payment_transactions
  set status='paid'
  where order_id=v_order.id and status in ('pending','waiting_verification');

  for v_item in select * from public.order_items where order_id=v_order.id order by created_at,id loop
    if public.grant_paid_product_access(v_uid,v_item.product_id,v_order.id) then
      v_grants:=v_grants+1;
    end if;
  end loop;

  return public.admin_get_order_detail(v_order.id) || jsonb_build_object('access_grants_count',v_grants);
end;
$$;
revoke all on function public.admin_activate_order_simple(uuid) from public;
grant execute on function public.admin_activate_order_simple(uuid) to authenticated;

-- Free order path must use auth.users.email too.
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

  v_uid := public.imers_resolve_order_buyer(v_order.id);
  if v_uid is null then
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


-- Checkout wrapper: bind an existing member through the canonical resolver; never profiles.email.
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
    if v_uid is null then v_uid:=public.imers_resolve_order_buyer(v_order_id); end if;

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

commit;
