-- iMersSUPA v1.7.28 | Hybrid digital affiliate checkout
-- Existing installation: run once in Supabase SQL Editor.
begin;
alter table public.products add column if not exists checkout_mode text not null default 'internal';
alter table public.products add column if not exists affiliate_checkout_url text;
alter table public.products add column if not exists affiliate_cta_text text not null default 'Checkout Official';
alter table public.products add column if not exists internal_cta_text text not null default 'Beli di Website Ini';
alter table public.products add column if not exists primary_checkout text not null default 'internal';
alter table public.products drop constraint if exists products_checkout_mode_check;
alter table public.products add constraint products_checkout_mode_check check (checkout_mode in ('internal','external','hybrid'));
alter table public.products drop constraint if exists products_primary_checkout_check;
alter table public.products add constraint products_primary_checkout_check check (primary_checkout in ('internal','external'));
create or replace function public.admin_update_product_checkout_settings(p_product_id uuid,p_checkout_mode text,p_affiliate_url text,p_affiliate_cta text,p_internal_cta text,p_primary_checkout text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and status='active' and role in ('admin','super_admin')) then raise exception 'Admin access required'; end if;
  if p_checkout_mode not in ('internal','external','hybrid') or p_primary_checkout not in ('internal','external') then raise exception 'Invalid checkout settings'; end if;
  if p_checkout_mode <> 'internal' and (coalesce(p_affiliate_url,'') !~* '^https?://[^[:space:]]+$') then raise exception 'Valid official affiliate URL required'; end if;
  update public.products set checkout_mode=p_checkout_mode,affiliate_checkout_url=nullif(trim(p_affiliate_url),''),affiliate_cta_text=left(coalesce(nullif(trim(p_affiliate_cta),''),'Checkout Official'),90),internal_cta_text=left(coalesce(nullif(trim(p_internal_cta),''),'Beli di Website Ini'),90),primary_checkout=p_primary_checkout,updated_at=now() where id=p_product_id;
  if not found then raise exception 'Product not found'; end if;
end; $$;
revoke all on function public.admin_update_product_checkout_settings(uuid,text,text,text,text,text) from public;
grant execute on function public.admin_update_product_checkout_settings(uuid,text,text,text,text,text) to authenticated;
commit;
