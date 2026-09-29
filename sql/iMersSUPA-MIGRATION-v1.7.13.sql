-- iMersSUPA v1.7.13
-- Base: v1.7.10
-- Simple Orders > Detail > AKTIFKAN ORDER
begin;

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
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.status in ('cancelled','expired','refunded') then
    raise exception 'Order % tidak dapat diaktifkan',v_order.status;
  end if;

  v_uid:=v_order.buyer_user_id;

  if v_uid is null then
    select p.id into v_uid
    from public.profiles p
    join auth.users u on u.id=p.id
    where lower(coalesce(u.email,''))=lower(trim(coalesce(v_order.buyer_email,'')))
      and p.role='member'
      and p.status='active'
    order by u.created_at asc
    limit 1;
  end if;

  if v_uid is null then
    raise exception 'Member aktif dengan email % belum ditemukan',v_order.buyer_email;
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
  where order_id=v_order.id
    and status in ('pending','waiting_verification');

  for v_item in select * from public.order_items where order_id=v_order.id loop
    perform public.grant_paid_product_access(v_uid,v_item.product_id,v_order.id);
  end loop;

  return public.admin_get_order_detail(v_order.id);
end;
$$;

revoke all on function public.admin_activate_order_simple(uuid) from public;
grant execute on function public.admin_activate_order_simple(uuid) to authenticated;

commit;
