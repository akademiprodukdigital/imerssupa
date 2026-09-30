-- iMersSUPA v1.7.25 - END TO END NOTIFICATION WIRING
-- Requires existing notification core (templates/outbox/provider settings).
begin;

do $$ begin
 if to_regclass('public.notification_templates') is null or to_regclass('public.notification_outbox') is null then
  raise exception 'Notification core belum terpasang.';
 end if;
end $$;

insert into public.notification_templates(event_key,channel,name,subject_template,body_template,active,sort_order) values
('member.registered','in_app','Member Registered',null,'Halo {{name}}, akun iMersSUPA Anda sudah terdaftar.',true,80),
('member.registered','email','Member Registered Email','Akun iMersSUPA Anda sudah terdaftar','Halo {{name}}, akun Anda sudah terdaftar. Silakan login untuk mengakses member area.',true,81),
('member.registered','whatsapp','Member Registered WhatsApp',null,'Halo {{name}}, akun iMersSUPA Anda sudah terdaftar. Silakan login ke member area.',true,82),
('product.access_granted','in_app','Product Access Granted',null,'Akses produk {{product_name}} sudah aktif.',true,90),
('product.access_granted','email','Product Access Granted Email','Akses {{product_name}} sudah aktif','Halo {{name}}, akses produk {{product_name}} sudah aktif dan tersedia di member area.',true,91),
('product.access_granted','whatsapp','Product Access Granted WhatsApp',null,'Halo {{name}}, akses produk {{product_name}} sudah aktif dan tersedia di member area.',true,92),
('product.access_revoked','in_app','Product Access Revoked',null,'Akses produk {{product_name}} telah dinonaktifkan.',true,93),
('product.access_revoked','email','Product Access Revoked Email','Perubahan akses {{product_name}}','Halo {{name}}, akses produk {{product_name}} telah dinonaktifkan.',true,94),
('product.access_revoked','whatsapp','Product Access Revoked WhatsApp',null,'Halo {{name}}, akses produk {{product_name}} telah dinonaktifkan.',true,95),
('affiliate.order_attributed','in_app','Affiliate Referral Order',null,'Ada order baru melalui referral Anda untuk {{product_name}}.',true,100),
('affiliate.order_attributed','email','Affiliate Referral Order Email','Order baru dari link affiliate Anda','Halo {{name}}, ada order baru melalui referral Anda untuk {{product_name}}.',true,101),
('affiliate.order_attributed','whatsapp','Affiliate Referral Order WhatsApp',null,'Halo {{name}}, ada order baru melalui referral Anda untuk {{product_name}}.',true,102),
('affiliate.commission_created','in_app','Affiliate Commission Created',null,'Komisi {{commission_amount}} dibuat untuk {{product_name}}.',true,110),
('affiliate.commission_created','email','Affiliate Commission Created Email','Komisi affiliate baru','Halo {{name}}, komisi {{commission_amount}} untuk {{product_name}} sudah tercatat.',true,111),
('affiliate.commission_created','whatsapp','Affiliate Commission Created WhatsApp',null,'Halo {{name}}, komisi {{commission_amount}} untuk {{product_name}} sudah tercatat.',true,112),
('affiliate.commission_approved','in_app','Affiliate Commission Approved',null,'Komisi {{commission_amount}} telah disetujui.',true,113),
('affiliate.commission_approved','email','Affiliate Commission Approved Email','Komisi affiliate disetujui','Halo {{name}}, komisi {{commission_amount}} telah disetujui.',true,114),
('affiliate.commission_approved','whatsapp','Affiliate Commission Approved WhatsApp',null,'Halo {{name}}, komisi affiliate {{commission_amount}} telah disetujui.',true,115),
('affiliate.commission_paid','in_app','Affiliate Commission Paid',null,'Komisi {{commission_amount}} telah dibayarkan.',true,116),
('affiliate.commission_paid','email','Affiliate Commission Paid Email','Komisi affiliate dibayarkan','Halo {{name}}, komisi {{commission_amount}} telah dibayarkan.',true,117),
('affiliate.commission_paid','whatsapp','Affiliate Commission Paid WhatsApp',null,'Halo {{name}}, komisi affiliate {{commission_amount}} telah dibayarkan.',true,118)
on conflict(event_key,channel) do update set name=excluded.name,subject_template=excluded.subject_template,body_template=excluded.body_template,active=true,sort_order=excluded.sort_order,updated_at=now();

-- Account-level dispatcher for events that do not belong to one order.
create or replace function public.queue_account_notification(
 p_user_id uuid,p_event_key text,p_context jsonb default '{}'::jsonb,p_action_url text default '/member'
) returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_email text;v_phone text;v_name text;v_t record;v_title text;v_body text;v_out int:=0;v_in int:=0;v_ctx jsonb;
begin
 if p_user_id is null then return jsonb_build_object('in_app',0,'outbox',0); end if;
 select u.email,p.phone,p.full_name into v_email,v_phone,v_name from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
 v_ctx:=jsonb_build_object('name',coalesce(nullif(v_name,''),split_part(coalesce(v_email,''),'@',1)),'email',v_email,'phone',v_phone)||coalesce(p_context,'{}'::jsonb);
 for v_t in select * from public.notification_templates where event_key=p_event_key and active=true order by sort_order loop
  v_title:=coalesce(public.render_notification_template(v_t.subject_template,v_ctx),v_t.name,p_event_key);
  v_body:=public.render_notification_template(v_t.body_template,v_ctx);
  if v_t.channel='in_app' then
   insert into public.notifications(user_id,order_id,event_key,title,body,action_url,metadata) values(p_user_id,null,p_event_key,v_title,v_body,p_action_url,v_ctx);v_in:=v_in+1;
  elsif v_t.channel='email' and nullif(trim(coalesce(v_email,'')),'') is not null then
   insert into public.notification_outbox(user_id,order_id,event_key,channel,recipient,subject,body,metadata) values(p_user_id,null,p_event_key,'email',lower(trim(v_email)),v_title,v_body,v_ctx);v_out:=v_out+1;
  elsif v_t.channel='whatsapp' and nullif(trim(coalesce(v_phone,'')),'') is not null then
   insert into public.notification_outbox(user_id,order_id,event_key,channel,recipient,subject,body,metadata) values(p_user_id,null,p_event_key,'whatsapp',trim(v_phone),null,v_body,v_ctx);v_out:=v_out+1;
  end if;
 end loop;
 return jsonb_build_object('in_app',v_in,'outbox',v_out,'email_recipient',v_email,'whatsapp_recipient',v_phone);
end $$;
revoke all on function public.queue_account_notification(uuid,text,jsonb,text) from public;
grant execute on function public.queue_account_notification(uuid,text,jsonb,text) to service_role;

create or replace function public.notify_member_access_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_new_status text;v_old_status text;v_product text;v_event text;
begin
 v_new_status:=coalesce(to_jsonb(new)->>'access_status',to_jsonb(new)->>'status','active');
 if tg_op='UPDATE' then v_old_status:=coalesce(to_jsonb(old)->>'access_status',to_jsonb(old)->>'status','active'); end if;
 if tg_op='INSERT' and v_new_status='active' then v_event:='product.access_granted';
 elsif tg_op='UPDATE' and v_new_status is distinct from v_old_status and v_new_status='active' then v_event:='product.access_granted';
 elsif tg_op='UPDATE' and v_new_status is distinct from v_old_status and v_new_status in ('revoked','expired') then v_event:='product.access_revoked';
 else return new; end if;
 select name into v_product from public.products where id=new.product_id;
 perform public.queue_account_notification(new.user_id,v_event,jsonb_build_object('product_name',coalesce(v_product,'Produk'),'product_id',new.product_id,'access_status',v_new_status),'/member');
 return new;
end $$;
drop trigger if exists trg_member_access_notification on public.member_access;
create trigger trg_member_access_notification after insert or update on public.member_access for each row execute function public.notify_member_access_change();

create or replace function public.notify_affiliate_order_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid;v_product text;
begin
 if new.affiliate_id is null then return new; end if;
 select user_id into v_user from public.affiliates where id=new.affiliate_id;
 select name into v_product from public.products where id=new.product_id;
 if v_user is not null then perform public.queue_account_notification(v_user,'affiliate.order_attributed',jsonb_build_object('product_name',coalesce(v_product,'Produk'),'gross_amount',new.gross_amount::text,'net_amount',new.net_amount::text,'referral_code',new.affiliate_referral_code_snapshot),'/member/affiliate'); end if;
 return new;
end $$;
drop trigger if exists trg_affiliate_order_notification on public.affiliate_orders;
create trigger trg_affiliate_order_notification after insert on public.affiliate_orders for each row execute function public.notify_affiliate_order_change();

create or replace function public.notify_affiliate_commission_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid;v_product text;v_event text;
begin
 select user_id into v_user from public.affiliates where id=new.affiliate_id;
 select name into v_product from public.products where id=new.product_id;
 if tg_op='INSERT' then v_event:='affiliate.commission_created';
 elsif old.status is distinct from new.status and new.status='approved' then v_event:='affiliate.commission_approved';
 elsif old.status is distinct from new.status and new.status='paid' then v_event:='affiliate.commission_paid';
 else return new; end if;
 if v_user is not null then perform public.queue_account_notification(v_user,v_event,jsonb_build_object('product_name',coalesce(v_product,'Produk'),'commission_amount',new.commission_amount::text,'commission_percent',new.commission_percent::text,'commission_status',new.status::text),'/member/affiliate'); end if;
 return new;
end $$;
drop trigger if exists trg_affiliate_commission_notification on public.affiliate_commissions;
create trigger trg_affiliate_commission_notification after insert or update of status on public.affiliate_commissions for each row execute function public.notify_affiliate_commission_change();

-- Verification: every required event has email + WhatsApp template.
do $$ declare v_missing int; begin
 select count(*) into v_missing from (values
 ('order.created'),('payment.waiting_verification'),('payment.approved'),('payment.rejected'),('payment.failed'),('order.completed'),('order.cancelled'),('order.expired'),('order.refunded'),('member.registered'),('product.access_granted'),('product.access_revoked'),('affiliate.order_attributed'),('affiliate.commission_created'),('affiliate.commission_approved'),('affiliate.commission_paid')) e(k)
 where not exists(select 1 from public.notification_templates t where t.event_key=e.k and t.channel='email' and t.active=true)
    or not exists(select 1 from public.notification_templates t where t.event_key=e.k and t.channel='whatsapp' and t.active=true);
 if v_missing>0 then raise exception 'Notification matrix incomplete: % event(s)',v_missing; end if;
end $$;
commit;
