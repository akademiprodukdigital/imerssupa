-- iMersSUPA v1.7.23
-- Commerce permission + canonical order activation repair
-- SQL MIGRATION: REQUIRED
begin;

-- Server-side service role is used only by trusted Next.js API routes.
-- Restore explicit privileges in case older hardening steps/custom grants removed them.
grant usage on schema public to service_role;
grant select,insert,update,delete on table public.profiles to service_role;
grant select,insert,update,delete on table public.orders to service_role;
grant select,insert,update,delete on table public.order_items to service_role;
grant select,insert,update,delete on table public.payment_methods to service_role;
grant select,insert,update,delete on table public.payment_transactions to service_role;
grant select,insert,update,delete on table public.member_access to service_role;
grant select,insert,update,delete on table public.commerce_events to service_role;
grant select,insert,update,delete on table public.notification_outbox to service_role;

-- Browser/admin reads remain SELECT-only and RLS-protected.
grant select on table public.profiles to authenticated;
grant select on table public.orders, public.order_items to authenticated;
grant select on table public.payment_methods, public.payment_transactions to authenticated;
grant select on table public.member_access to authenticated;
grant select on table public.commerce_events, public.notification_outbox to authenticated;

-- Never grant browser direct commerce mutations.
revoke insert,update,delete on table public.orders, public.order_items from anon,authenticated;
revoke insert,update,delete on table public.payment_methods, public.payment_transactions from anon,authenticated;
revoke insert,update,delete on table public.commerce_events, public.notification_outbox from anon,authenticated;

-- Bind a verified Auth member to an order without browser UPDATE permission.
create or replace function public.admin_bind_order_buyer(p_order_id uuid,p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.orders where id=p_order_id) then raise exception 'Order not found'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and role='member' and status='active') then
    raise exception 'Target user is not an active member';
  end if;
  update public.orders set buyer_user_id=p_user_id where id=p_order_id;
  return true;
end;
$$;
revoke all on function public.admin_bind_order_buyer(uuid,uuid) from public;
grant execute on function public.admin_bind_order_buyer(uuid,uuid) to authenticated;

-- Re-assert activation functions execute through SECURITY DEFINER.
grant execute on function public.admin_activate_order_simple(uuid) to authenticated;
grant execute on function public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text) to anon,authenticated;

commit;
