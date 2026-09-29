-- ============================================================
-- iMersSUPA - FINAL FRESH INSTALL VERIFICATION
-- Run after 00_FULL_FRESH_INSTALL_IMERSSUPA.sql
-- and 01_BIND_FIRST_SUPER_ADMIN_BY_EMAIL.sql
-- ============================================================

-- 1) Core tables
with required_tables(name) as (values
 ('profiles'),('products'),('product_sections'),('product_contents'),('product_files'),('member_access'),
 ('member_content_progress'),('orders'),('order_items'),('payment_methods'),('payment_transactions'),
 ('notification_templates'),('notification_outbox'),('notification_preferences'),
 ('communication_providers'),('commerce_events'),('product_categories'),('product_media'),
 ('product_agency_settings'),('agency_product_entitlements'),('agency_members'),('agency_member_grants')
)
select r.name as object_name,
       case when to_regclass('public.'||r.name) is not null then 'PASS' else 'FAIL' end as status
from required_tables r
order by r.name;

-- 2) Storage buckets
select id,name,public,file_size_limit
from storage.buckets
where id in ('payment-proofs','profile-avatars','product-media')
order by id;

-- 3) Profiles / roles
select role,status,count(*)
from public.profiles
group by role,status
order by role,status;

-- 4) Payment method readiness
select id,name,code,type,active,fee_fixed,fee_percent,min_amount,max_amount,sort_order
from public.payment_methods
order by sort_order,name;

-- 5) Transactional notification template matrix
with required(event_key,channel) as (
  values
    ('order.created','in_app'::public.notification_channel),
    ('order.created','email'),
    ('order.created','whatsapp'),
    ('payment.waiting_verification','in_app'),
    ('payment.waiting_verification','email'),
    ('payment.waiting_verification','whatsapp'),
    ('payment.approved','in_app'),
    ('payment.approved','email'),
    ('payment.approved','whatsapp'),
    ('payment.rejected','in_app'),
    ('payment.rejected','email'),
    ('payment.rejected','whatsapp'),
    ('payment.failed','in_app'),
    ('payment.failed','email'),
    ('payment.failed','whatsapp'),
    ('order.completed','in_app'),
    ('order.completed','email'),
    ('order.completed','whatsapp'),
    ('order.cancelled','in_app'),
    ('order.cancelled','email'),
    ('order.cancelled','whatsapp'),
    ('order.expired','in_app'),
    ('order.expired','email'),
    ('order.expired','whatsapp'),
    ('order.refunded','in_app'),
    ('order.refunded','email'),
    ('order.refunded','whatsapp')
)
select r.event_key,r.channel,
       case when exists (
         select 1 from public.notification_templates nt
         where nt.event_key=r.event_key
           and nt.channel=r.channel
           and nt.active=true
       ) then 'PASS' else 'FAIL' end as status
from required r
order by r.event_key,r.channel;

-- 6) Final commerce notification triggers
select
  t.tgname as trigger_name,
  c.relname as table_name,
  case when t.tgenabled='O' then 'PASS' else 'CHECK' end as status
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and t.tgname in (
    'trg_commerce_event_notification',
    'trg_order_created_notification',
    'trg_order_status_notification',
    'trg_payment_status_notification'
  )
  and not t.tgisinternal
order by t.tgname;

-- 7) Critical functions
select *
from (
  values
    ('create_checkout_order_secure',
      to_regprocedure('public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)')),
    ('create_checkout_order_secure_core',
      to_regprocedure('public.create_checkout_order_secure_core(jsonb,text,text,text,text,text,text,text)')),
    ('admin_upsert_payment_method',
      to_regprocedure('public.admin_upsert_payment_method(uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,numeric,numeric,numeric,numeric,integer,boolean)')),
    ('queue_user_notification',
      to_regprocedure('public.queue_user_notification(uuid,uuid,text,jsonb,text)')),
    ('notify_from_commerce_event',
      to_regprocedure('public.notify_from_commerce_event()'))
) as x(name,signature)
order by name;

-- 8) Recent notification outbox activity
select event_key,channel,status,recipient,provider_name,attempt_count,last_error,created_at
from public.notification_outbox
order by created_at desc
limit 30;
