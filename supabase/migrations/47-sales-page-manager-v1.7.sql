-- iMersSUPA v1.7 — Sales Page Manager + lowercase affiliate tracking fix
-- Safe/idempotent migration for existing v1.6 installations.

alter table public.products add column if not exists sales_page_mode text not null default 'none';
alter table public.products add column if not exists sales_page_html text;
alter table public.products add column if not exists external_sales_page_url text;

alter table public.products drop constraint if exists products_sales_page_mode_check;
alter table public.products add constraint products_sales_page_mode_check check (sales_page_mode in ('none','internal','external'));

create or replace function public.admin_update_product_sales_page(
  p_product_id uuid,
  p_mode text,
  p_html text default null,
  p_external_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and role in ('admin','super_admin')
  ) then raise exception 'Admin access required'; end if;
  if p_mode not in ('none','internal','external') then raise exception 'Invalid sales page mode'; end if;
  if p_mode='external' and trim(coalesce(p_external_url,''))='' then raise exception 'External URL required'; end if;
  update public.products set
    sales_page_mode=p_mode,
    sales_page_html=case when p_mode='internal' then nullif(p_html,'') else sales_page_html end,
    external_sales_page_url=case when p_mode='external' then nullif(trim(p_external_url),'') else external_sales_page_url end,
    updated_at=now()
  where id=p_product_id;
  if not found then raise exception 'Product not found'; end if;
end; $$;
revoke all on function public.admin_update_product_sales_page(uuid,text,text,text) from public;
grant execute on function public.admin_update_product_sales_page(uuid,text,text,text) to authenticated;

-- v1.6 generated lowercase referral codes. Make referral resolution case-insensitive.
create or replace function public.track_affiliate_referral(
  p_referral_code text,
  p_visitor_key text,
  p_product_id uuid default null,
  p_landing_path text default null,
  p_referrer_url text default null
)
returns table (affiliate_id uuid, affiliate_name text, referral_code text, expires_at timestamptz, locked_forever boolean)
language plpgsql security definer set search_path = public
as $$
declare v_settings public.affiliate_settings%rowtype; v_affiliate public.affiliates%rowtype;
begin
  if trim(coalesce(p_visitor_key,'')) = '' then raise exception 'visitor_key required'; end if;
  if length(p_visitor_key)>200 or length(coalesce(p_landing_path,''))>1000 or length(coalesce(p_referrer_url,''))>2000 then raise exception 'Tracking value too long'; end if;
  select * into v_settings from public.affiliate_settings where id=1;
  if not found or not v_settings.enabled then return; end if;
  select * into v_affiliate from public.affiliates where lower(referral_code)=lower(trim(p_referral_code)) and status='active' limit 1;
  if not found then return; end if;
  if v_settings.prevent_self_referral and auth.uid() is not null and auth.uid()=v_affiliate.user_id then return; end if;
  insert into public.affiliate_clicks(affiliate_id,product_id,visitor_key,landing_path,referrer_url)
  values(v_affiliate.id,p_product_id,p_visitor_key,nullif(trim(p_landing_path),''),nullif(trim(p_referrer_url),''));
  return query select * from public.apply_affiliate_attribution(p_visitor_key,v_affiliate.referral_code,auth.uid(),'referral_link',null,false);
end; $$;
revoke all on function public.track_affiliate_referral(text,text,uuid,text,text) from public;
grant execute on function public.track_affiliate_referral(text,text,uuid,text,text) to anon, authenticated;
