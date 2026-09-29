-- ============================================================
-- iMersSUPA FULL FRESH INSTALLER
-- Generated from final backend steps. Fresh Supabase project only.
-- Development test/demo seed steps intentionally excluded.
-- ============================================================


-- ===== SOURCE STEP 01: 01-core-auth-profile.sql =====
-- =========================================================
-- iMersSUPA v0.1
-- STEP 2A : CORE AUTH / PROFILE
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    full_name text,
    phone text,
    avatar_url text,

    role text not null default 'member'
        check (role in ('super_admin', 'admin', 'member')),

    status text not null default 'active'
        check (status in ('active', 'inactive', 'suspended')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- AUTO UPDATED_AT
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at
on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- AUTO CREATE PROFILE AFTER SIGNUP
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        role,
        status
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', ''),
        'member',
        'active'
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------
-- HELPER: CURRENT USER ROLE
-- ---------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select role
    from public.profiles
    where id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role()
to authenticated;

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "member_read_own_profile"
on public.profiles;

create policy "member_read_own_profile"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
    or public.current_user_role() in ('admin', 'super_admin')
);

drop policy if exists "member_update_own_profile"
on public.profiles;

create policy "member_update_own_profile"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
)
with check (
    id = auth.uid()
);

-- Admin dapat membaca seluruh profile.
-- Update role/status TIDAK akan kita berikan langsung
-- dari frontend. Nanti dilakukan melalui privileged function.

-- ---------------------------------------------------------
-- PRIVILEGES
-- ---------------------------------------------------------
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;

-- Sengaja belum memberikan UPDATE langsung.
-- Profile editing akan kita buat lewat RPC aman pada step berikutnya.

-- =========================================================
-- END STEP 2A
-- =========================================================



-- ===== RECONSTRUCTED STEP 04 CORE =====
-- ============================================================
-- iMersSUPA - PRODUCT CORE & MEMBER ACCESS (Fresh Install Base)
-- Reconstructed from the final application schema/dependencies.
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  product_type text not null default 'digital' check (product_type in ('digital','ebook','course','membership','software','external','bundle')),
  price numeric(18,2) not null default 0 check (price >= 0),
  compare_price numeric(18,2),
  description text,
  thumbnail_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_featured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_contents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  content_type text not null default 'text' check (content_type in ('text','html','video','external_url')),
  content_text text,
  external_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade
);

create table if not exists public.member_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  access_status text not null default 'active' check (access_status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','order','coupon','import','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,product_id)
);

create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_product_contents_product on public.product_contents(product_id);
create index if not exists idx_product_files_product on public.product_files(product_id);
create index if not exists idx_member_access_user on public.member_access(user_id);
create index if not exists idx_member_access_product on public.member_access(product_id);

alter table public.products enable row level security;
alter table public.product_contents enable row level security;
alter table public.product_files enable row level security;
alter table public.member_access enable row level security;

revoke all on public.products, public.product_contents, public.product_files, public.member_access from anon, authenticated;
grant select on public.products, public.product_contents, public.product_files, public.member_access to authenticated;

drop policy if exists "authenticated_read_products" on public.products;
create policy "authenticated_read_products" on public.products for select to authenticated using (true);

drop policy if exists "member_read_own_access" on public.member_access;
create policy "member_read_own_access" on public.member_access for select to authenticated using (user_id=auth.uid() or public.current_user_role() in ('admin','super_admin'));

drop policy if exists "member_read_owned_content" on public.product_contents;
create policy "member_read_owned_content" on public.product_contents for select to authenticated using (
  exists(select 1 from public.member_access ma where ma.user_id=auth.uid() and ma.product_id=product_contents.product_id and ma.access_status='active' and (ma.expires_at is null or ma.expires_at>now()))
  or public.current_user_role() in ('admin','super_admin')
);

drop policy if exists "member_read_owned_files" on public.product_files;
create policy "member_read_owned_files" on public.product_files for select to authenticated using (
  exists(select 1 from public.member_access ma where ma.user_id=auth.uid() and ma.product_id=product_files.product_id and ma.access_status='active' and (ma.expires_at is null or ma.expires_at>now()))
  or public.current_user_role() in ('admin','super_admin')
);


-- ===== SOURCE STEP 05: 05-secure-admin-actions.sql =====
-- ============================================================
-- iMersSUPA
-- STEP 05 - SECURE ADMIN ACTIONS
-- ============================================================


-- ============================================================
-- 1. HELPER: CHECK ADMIN
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role in ('admin', 'super_admin')
          and status = 'active'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- ============================================================
-- 2. CREATE PRODUCT
-- Hanya Admin / Super Admin
-- ============================================================

create or replace function public.admin_create_product(
    p_name text,
    p_slug text,
    p_product_type text default 'digital',
    p_price numeric default 0,
    p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_product_id uuid;
begin

    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not public.is_admin() then
        raise exception 'Unauthorized';
    end if;

    if nullif(trim(p_name), '') is null then
        raise exception 'Product name is required';
    end if;

    if nullif(trim(p_slug), '') is null then
        raise exception 'Product slug is required';
    end if;

    if p_product_type not in (
        'digital',
        'ebook',
        'course',
        'membership',
        'software',
        'external',
        'bundle'
    ) then
        raise exception 'Invalid product type';
    end if;

    if p_price < 0 then
        raise exception 'Price cannot be negative';
    end if;

    insert into public.products (
        name,
        slug,
        product_type,
        price,
        description,
        status,
        created_by
    )
    values (
        trim(p_name),
        lower(trim(p_slug)),
        p_product_type,
        p_price,
        p_description,
        'draft',
        auth.uid()
    )
    returning id into new_product_id;

    return new_product_id;

exception
    when unique_violation then
        raise exception 'Product slug already exists';
end;
$$;

revoke all on function public.admin_create_product(
    text,
    text,
    text,
    numeric,
    text
) from public;

grant execute on function public.admin_create_product(
    text,
    text,
    text,
    numeric,
    text
) to authenticated;


-- ============================================================
-- 3. UPDATE PRODUCT
-- ============================================================

create or replace function public.admin_update_product(
    p_product_id uuid,
    p_name text,
    p_slug text,
    p_product_type text,
    p_price numeric,
    p_compare_price numeric,
    p_description text,
    p_thumbnail_url text,
    p_status text,
    p_is_featured boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin

    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not public.is_admin() then
        raise exception 'Unauthorized';
    end if;

    if nullif(trim(p_name), '') is null then
        raise exception 'Product name is required';
    end if;

    if nullif(trim(p_slug), '') is null then
        raise exception 'Product slug is required';
    end if;

    if p_product_type not in (
        'digital',
        'ebook',
        'course',
        'membership',
        'software',
        'external',
        'bundle'
    ) then
        raise exception 'Invalid product type';
    end if;

    if p_status not in (
        'draft',
        'published',
        'archived'
    ) then
        raise exception 'Invalid product status';
    end if;

    if p_price < 0 then
        raise exception 'Price cannot be negative';
    end if;

    if p_compare_price is not null and p_compare_price < 0 then
        raise exception 'Compare price cannot be negative';
    end if;

    update public.products
    set
        name = trim(p_name),
        slug = lower(trim(p_slug)),
        product_type = p_product_type,
        price = p_price,
        compare_price = p_compare_price,
        description = p_description,
        thumbnail_url = p_thumbnail_url,
        status = p_status,
        is_featured = p_is_featured
    where id = p_product_id;

    if not found then
        raise exception 'Product not found';
    end if;

    return true;

exception
    when unique_violation then
        raise exception 'Product slug already exists';
end;
$$;

revoke all on function public.admin_update_product(
    uuid,
    text,
    text,
    text,
    numeric,
    numeric,
    text,
    text,
    text,
    boolean
) from public;

grant execute on function public.admin_update_product(
    uuid,
    text,
    text,
    text,
    numeric,
    numeric,
    text,
    text,
    text,
    boolean
) to authenticated;


-- ============================================================
-- 4. GRANT PRODUCT ACCESS
-- Admin memberikan akses produk ke member.
-- ============================================================

create or replace function public.admin_grant_product_access(
    p_user_id uuid,
    p_product_id uuid,
    p_expires_at timestamptz default null,
    p_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    access_id uuid;
begin

    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not public.is_admin() then
        raise exception 'Unauthorized';
    end if;

    if p_source not in (
        'manual',
        'order',
        'coupon',
        'import',
        'system'
    ) then
        raise exception 'Invalid access source';
    end if;

    if not exists (
        select 1
        from auth.users
        where id = p_user_id
    ) then
        raise exception 'User not found';
    end if;

    if not exists (
        select 1
        from public.products
        where id = p_product_id
    ) then
        raise exception 'Product not found';
    end if;

    insert into public.member_access (
        user_id,
        product_id,
        access_status,
        granted_at,
        expires_at,
        granted_by,
        source
    )
    values (
        p_user_id,
        p_product_id,
        'active',
        now(),
        p_expires_at,
        auth.uid(),
        p_source
    )

    on conflict (user_id, product_id)
    do update set
        access_status = 'active',
        granted_at = now(),
        expires_at = excluded.expires_at,
        granted_by = auth.uid(),
        source = excluded.source

    returning id into access_id;

    return access_id;
end;
$$;

revoke all on function public.admin_grant_product_access(
    uuid,
    uuid,
    timestamptz,
    text
) from public;

grant execute on function public.admin_grant_product_access(
    uuid,
    uuid,
    timestamptz,
    text
) to authenticated;


-- ============================================================
-- 5. REVOKE PRODUCT ACCESS
-- ============================================================

create or replace function public.admin_revoke_product_access(
    p_user_id uuid,
    p_product_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin

    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not public.is_admin() then
        raise exception 'Unauthorized';
    end if;

    update public.member_access
    set access_status = 'revoked'
    where user_id = p_user_id
      and product_id = p_product_id;

    if not found then
        raise exception 'Member access not found';
    end if;

    return true;
end;
$$;

revoke all on function public.admin_revoke_product_access(
    uuid,
    uuid
) from public;

grant execute on function public.admin_revoke_product_access(
    uuid,
    uuid
) to authenticated;


-- ============================================================
-- 6. UPDATE OWN PROFILE SAFELY
--
-- Member hanya bisa mengubah:
-- full_name
-- phone
-- avatar_url
--
-- role & status TIDAK tersedia sebagai parameter.
-- ============================================================

create or replace function public.update_my_profile(
    p_full_name text,
    p_phone text default null,
    p_avatar_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin

    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    update public.profiles
    set
        full_name = p_full_name,
        phone = p_phone,
        avatar_url = p_avatar_url
    where id = auth.uid();

    if not found then
        raise exception 'Profile not found';
    end if;

    return true;
end;
$$;

revoke all on function public.update_my_profile(
    text,
    text,
    text
) from public;

grant execute on function public.update_my_profile(
    text,
    text,
    text
) to authenticated;


-- ============================================================
-- 7. SECURITY
--
-- Tetap TIDAK memberikan INSERT / UPDATE / DELETE langsung
-- pada tabel sensitif kepada authenticated.
-- ============================================================

revoke insert, update, delete
on table public.products
from authenticated;

revoke insert, update, delete
on table public.product_contents
from authenticated;

revoke insert, update, delete
on table public.product_files
from authenticated;

revoke insert, update, delete
on table public.member_access
from authenticated;

revoke insert, update, delete
on table public.profiles
from authenticated;


-- ============================================================
-- END STEP 05
-- ============================================================

-- ===== SOURCE STEP 07: 07-content-delivery-core.sql =====
-- ============================================================
-- iMersSUPA
-- STEP 07 - CONTENT DELIVERY CORE
-- ============================================================

-- ------------------------------------------------------------
-- 1. PRODUCT SECTIONS
-- Modul / Chapter / Folder di dalam sebuah produk
-- ------------------------------------------------------------

create table if not exists public.product_sections (
    id uuid primary key default gen_random_uuid(),

    product_id uuid not null
        references public.products(id)
        on delete cascade,

    title text not null,
    description text,

    sort_order integer not null default 0,

    status text not null default 'published'
        check (status in ('draft', 'published', 'hidden')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 2. UPGRADE PRODUCT CONTENTS
-- Hubungkan content dengan section
-- ------------------------------------------------------------

alter table public.product_contents
add column if not exists section_id uuid
references public.product_sections(id)
on delete set null;

alter table public.product_contents
add column if not exists sort_order integer not null default 0;

alter table public.product_contents
add column if not exists is_preview boolean not null default false;


-- ------------------------------------------------------------
-- 3. MEMBER CONTENT PROGRESS
-- Menyimpan progress belajar/member
-- ------------------------------------------------------------

create table if not exists public.member_content_progress (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    content_id uuid not null
        references public.product_contents(id)
        on delete cascade,

    progress_percent integer not null default 0
        check (
            progress_percent >= 0
            and progress_percent <= 100
        ),

    completed boolean not null default false,

    last_position integer not null default 0,

    started_at timestamptz,
    completed_at timestamptz,

    updated_at timestamptz not null default now(),

    unique (user_id, content_id)
);


-- ------------------------------------------------------------
-- 4. INDEXES
-- ------------------------------------------------------------

create index if not exists idx_product_sections_product
on public.product_sections(product_id);

create index if not exists idx_product_contents_section
on public.product_contents(section_id);

create index if not exists idx_member_progress_user
on public.member_content_progress(user_id);

create index if not exists idx_member_progress_content
on public.member_content_progress(content_id);


-- ------------------------------------------------------------
-- 5. ENABLE RLS
-- ------------------------------------------------------------

alter table public.product_sections
enable row level security;

alter table public.member_content_progress
enable row level security;


-- ------------------------------------------------------------
-- 6. RESET BASIC PRIVILEGES
-- ------------------------------------------------------------

revoke all on table public.product_sections
from anon;

revoke all on table public.member_content_progress
from anon;

revoke all on table public.product_sections
from authenticated;

revoke all on table public.member_content_progress
from authenticated;


-- Member boleh membaca section.
-- RLS policy detail akan kita kunci berdasarkan entitlement.

grant select
on table public.product_sections
to authenticated;


-- Member hanya diberi SELECT progress.
-- INSERT/UPDATE progress nanti melalui secure RPC.

grant select
on table public.member_content_progress
to authenticated;


-- ------------------------------------------------------------
-- 7. MEMBER HANYA BOLEH MELIHAT PROGRESS MILIK SENDIRI
-- ------------------------------------------------------------

drop policy if exists
"member_read_own_progress"
on public.member_content_progress;

create policy
"member_read_own_progress"
on public.member_content_progress
for select
to authenticated
using (
    user_id = auth.uid()
);


-- ------------------------------------------------------------
-- 8. VERIFY STRUCTURE
-- ------------------------------------------------------------

select
    table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
    'product_sections',
    'product_contents',
    'member_content_progress'
)
order by table_name;

-- ============================================================
-- END STEP 07
-- ============================================================

-- ===== SOURCE STEP 08: 08-entitlement-content-security.sql =====
-- ============================================================
-- iMersSUPA
-- STEP 08 - ENTITLEMENT CONTENT SECURITY
-- ============================================================

-- ------------------------------------------------------------
-- HELPER:
-- cek apakah user memiliki akses aktif ke product tertentu
-- ------------------------------------------------------------

create or replace function public.has_product_access(
    target_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.member_access ma
        where ma.user_id = auth.uid()
          and ma.product_id = target_product_id
          and ma.access_status = 'active'
          and (
              ma.expires_at is null
              or ma.expires_at > now()
          )
    );
$$;

revoke all
on function public.has_product_access(uuid)
from public;

grant execute
on function public.has_product_access(uuid)
to authenticated;


-- ============================================================
-- PRODUCT SECTIONS
-- ============================================================

drop policy if exists
"member_read_entitled_sections"
on public.product_sections;

create policy
"member_read_entitled_sections"
on public.product_sections
for select
to authenticated
using (
    status = 'published'
    and public.has_product_access(product_id)
);


-- ============================================================
-- PRODUCT CONTENTS
-- ============================================================

alter table public.product_contents
enable row level security;

drop policy if exists
"member_read_entitled_content"
on public.product_contents;

create policy
"member_read_entitled_content"
on public.product_contents
for select
to authenticated
using (
    exists (
        select 1
        from public.products p
        where p.id = product_contents.product_id
          and p.status = 'published'
          and public.has_product_access(p.id)
    )
);


-- ============================================================
-- PRODUCT FILES
-- ============================================================

alter table public.product_files
enable row level security;

drop policy if exists
"member_read_entitled_files"
on public.product_files;

create policy
"member_read_entitled_files"
on public.product_files
for select
to authenticated
using (
    exists (
        select 1
        from public.products p
        where p.id = product_files.product_id
          and p.status = 'published'
          and public.has_product_access(p.id)
    )
);


-- ============================================================
-- PRODUCTS
-- Member hanya melihat produk yang dimiliki
-- ============================================================

alter table public.products
enable row level security;

drop policy if exists
"member_read_entitled_products"
on public.products;

create policy
"member_read_entitled_products"
on public.products
for select
to authenticated
using (
    status = 'published'
    and public.has_product_access(id)
);


-- ============================================================
-- VERIFY POLICIES
-- ============================================================

select
    schemaname,
    tablename,
    policyname,
    cmd
from pg_policies
where schemaname = 'public'
and tablename in (
    'products',
    'product_sections',
    'product_contents',
    'product_files',
    'member_content_progress'
)
order by tablename, policyname;

-- ============================================================
-- END STEP 08
-- ============================================================

-- ===== SOURCE STEP 09: 09-security-cleanup.sql =====
-- ============================================================
-- iMersSUPA
-- STEP 09 - SECURITY POLICY CLEANUP
-- ============================================================

-- Hapus policy lama yang sudah digantikan
-- oleh entitlement security STEP 08

drop policy if exists
"authenticated_read_products"
on public.products;

drop policy if exists
"member_read_owned_content"
on public.product_contents;

drop policy if exists
"member_read_owned_files"
on public.product_files;


-- ============================================================
-- VERIFY FINAL MEMBER CONTENT POLICIES
-- ============================================================

select
    schemaname,
    tablename,
    policyname,
    cmd
from pg_policies
where schemaname = 'public'
and tablename in (
    'products',
    'product_sections',
    'product_contents',
    'product_files',
    'member_content_progress'
)
order by tablename, policyname;


-- ============================================================
-- EXPECTED:
--
-- member_content_progress
--   member_read_own_progress
--
-- product_contents
--   member_read_entitled_content
--
-- product_files
--   member_read_entitled_files
--
-- product_sections
--   member_read_entitled_sections
--
-- products
--   member_read_entitled_products
--
-- Total expected: 5 policies
-- ============================================================

-- END STEP 09

-- ===== SOURCE STEP 13: 13-member-progress.sql =====
-- ============================================================
-- iMersSUPA
-- STEP 13A - CHECK MEMBER_CONTENT_PROGRESS STRUCTURE
-- ============================================================
-- Tujuan:
-- Mengecek struktur tabel member_content_progress
-- sebelum kita mengaktifkan progress lesson.
--
-- Query ini HANYA membaca struktur.
-- TIDAK mengubah database.
-- ============================================================

select
    ordinal_position as no,
    column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'member_content_progress'
order by ordinal_position;

-- ============================================================
-- END STEP 13A
-- ============================================================

-- ===== SOURCE STEP 14: 14-white-label-homepage-settings.sql =====
-- ============================================================
-- iMersSUPA STEP 14
-- WHITE LABEL + HOMEPAGE SETTINGS
-- ============================================================

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),

  setting_group text not null,
  setting_key text not null,

  setting_value jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_settings_group_key_unique
    unique (setting_group, setting_key)
);

alter table public.platform_settings
enable row level security;


-- ============================================================
-- HELPER FUNCTION
-- SUPER ADMIN CHECK
-- ============================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and status = 'active'
  );
$$;


-- ============================================================
-- PERMISSIONS
-- ============================================================

grant select
on public.platform_settings
to anon, authenticated;

grant insert, update, delete
on public.platform_settings
to authenticated;


-- ============================================================
-- PUBLIC READ
--
-- Homepage harus bisa dibaca visitor yang belum login.
-- ============================================================

drop policy if exists
"public_read_platform_settings"
on public.platform_settings;

create policy
"public_read_platform_settings"
on public.platform_settings
for select
to anon, authenticated
using (true);


-- ============================================================
-- SUPER ADMIN WRITE ONLY
-- ============================================================

drop policy if exists
"super_admin_insert_platform_settings"
on public.platform_settings;

create policy
"super_admin_insert_platform_settings"
on public.platform_settings
for insert
to authenticated
with check (
  public.is_super_admin()
);


drop policy if exists
"super_admin_update_platform_settings"
on public.platform_settings;

create policy
"super_admin_update_platform_settings"
on public.platform_settings
for update
to authenticated
using (
  public.is_super_admin()
)
with check (
  public.is_super_admin()
);


drop policy if exists
"super_admin_delete_platform_settings"
on public.platform_settings;

create policy
"super_admin_delete_platform_settings"
on public.platform_settings
for delete
to authenticated
using (
  public.is_super_admin()
);


-- ============================================================
-- DEFAULT HOMEPAGE CONFIG
-- ============================================================

insert into public.platform_settings (
  setting_group,
  setting_key,
  setting_value
)
values (
  'homepage',
  'config',
  jsonb_build_object(

    -- MODE
    'mode', 'marketplace',

    -- BRAND
    'brand_name', 'iMersSUPA',
    'brand_tagline', 'Digital Product Marketplace',
    'logo_url', '',
    'icon_url', '',

    -- HERO COPYWRITING
    'hero_badge', 'DIGITAL PRODUCT MARKETPLACE',
    'hero_title', 'Temukan Produk Digital Pilihan',
    'hero_highlight', 'Untuk Membantu Anda Bertumbuh.',
    'hero_description',
      'Jelajahi koleksi produk digital, materi pembelajaran, resource dan berbagai konten pilihan dalam satu platform.',

    -- HERO CTA
    'primary_cta_text', 'Jelajahi Produk',
    'primary_cta_url', '#products',
    'secondary_cta_text', 'Masuk Member',
    'secondary_cta_url', '/login',

    -- MARKETPLACE COPY
    'featured_title', 'Produk Unggulan',
    'featured_description',
      'Pilihan produk digital untuk Anda.',

    'latest_title', 'Produk Terbaru',
    'latest_description',
      'Temukan koleksi terbaru kami.',

    'search_placeholder',
      'Cari produk digital...',

    'empty_products_text',
      'Belum ada produk yang tersedia.',

    -- PRODUCT BUTTONS
    'product_detail_text', 'Lihat Detail',
    'member_product_text', 'Buka Produk',

    -- TYPOGRAPHY
    'heading_font', 'Poppins',
    'body_font', 'Inter',

    -- VISUAL
    'primary_color', '#6366f1',
    'secondary_color', '#7c3aed',
    'accent_color', '#38bdf8',

    'background_start', '#030712',
    'background_end', '#111827',

    'card_radius', '20px',

    -- NAVIGATION
    'login_text', 'Login',
    'member_area_text', 'Member Area',

    -- FOOTER
    'footer_text',
      'Digital Product Marketplace',

    -- CUSTOM HTML
    'custom_html', ''
  )
)
on conflict (
  setting_group,
  setting_key
)
do nothing;


-- ============================================================
-- AUTO UPDATED_AT
-- ============================================================

create or replace function
public.set_platform_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
platform_settings_updated_at
on public.platform_settings;

create trigger
platform_settings_updated_at
before update
on public.platform_settings
for each row
execute function
public.set_platform_settings_updated_at();


-- ============================================================
-- VERIFY
-- ============================================================

select
  setting_group,
  setting_key,
  setting_value,
  updated_at
from public.platform_settings
where setting_group = 'homepage'
  and setting_key = 'config';

-- ===== SOURCE STEP 15: 15-public-marketplace-product-access.sql =====
-- ============================================================
-- iMersSUPA STEP 15
-- PUBLIC MARKETPLACE PRODUCT ACCESS
-- ============================================================
--
-- TUJUAN:
-- 1. Visitor / anon boleh membaca produk PUBLISHED
-- 2. Member tetap menggunakan entitlement policy existing
-- 3. Draft / unpublished tidak dibuka ke publik
-- 4. Tidak memberikan INSERT / UPDATE / DELETE ke anon
-- ============================================================


-- ============================================================
-- ENABLE RLS
-- ============================================================

alter table public.products
enable row level security;


-- ============================================================
-- ANON HANYA BUTUH SELECT
-- ============================================================

grant select
on public.products
to anon;


-- ============================================================
-- PUBLIC READ PUBLISHED PRODUCTS
-- ============================================================

drop policy if exists
"public_read_published_products"
on public.products;

create policy
"public_read_published_products"
on public.products
for select
to anon
using (
  status = 'published'
);


-- ============================================================
-- AUTHENTICATED USER JUGA BOLEH MELIHAT PUBLISHED CATALOG
--
-- Ini penting:
-- user yang sudah login tetap bisa melihat marketplace,
-- walaupun produk tersebut belum dia miliki.
--
-- Access ke CONTENT tetap diamankan oleh entitlement/RLS
-- product_sections, product_contents, product_files, dst.
-- ============================================================

drop policy if exists
"authenticated_read_published_products"
on public.products;

create policy
"authenticated_read_published_products"
on public.products
for select
to authenticated
using (
  status = 'published'
);


-- ============================================================
-- VERIFY PRODUCT POLICIES
-- ============================================================

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'products'
order by policyname;

-- ===== SOURCE STEP 16: 16-global-platform-branding.sql =====
-- =========================================================
-- iMersSUPA - STEP 16
-- Global Platform Branding Configuration
-- =========================================================

insert into public.platform_settings (
  setting_group,
  setting_key,
  setting_value
)
values (
  'platform',
  'branding',
  '{
    "app_name": "iMersSUPA",
    "short_name": "SUPA",
    "company_name": "",
    "developer_name": "",
    "copyright_text": "",
    "logo_url": "",
    "icon_url": "",
    "app_url": "",
    "heading_font": "Poppins",
    "body_font": "Inter",
    "button_font": "Inter",
    "primary_color": "#4f46e5",
    "secondary_color": "#7c3aed",
    "accent_color": "#38bdf8",
    "sidebar_style": "gradient",
    "card_radius": "20px",
    "login_badge": "DIGITAL MEMBER EXPERIENCE",
    "login_title": "Semua produk digital. Satu member area.",
    "login_description": "Akses produk, materi pembelajaran dan resource digital Anda dalam satu tempat.",
    "show_developer_credit": false
  }'::jsonb
)
on conflict (setting_group, setting_key)
do update set
  setting_value = excluded.setting_value,
  updated_at = now();

select
  setting_group,
  setting_key,
  setting_value,
  updated_at
from public.platform_settings
where setting_group = 'platform'
  and setting_key = 'branding';

-- ===== SOURCE STEP 17: 17-affiliate-coupon-core.sql =====
-- ============================================================
-- iMersSUPA — STEP 17
-- AFFILIATE + COUPON CORE
-- Target: Supabase / PostgreSQL
--
-- IMPORTANT:
-- - Built against the current iMersSUPA master architecture:
--   public.profiles(id, role, status, ...)
--   public.products(id, ...)
-- - Does NOT alter existing course/content/progress tables.
-- - Internal/master coupons NEVER generate affiliate commission.
-- - Affiliate alias coupons inherit the parent public coupon rules.
-- - Supports last_click and affiliate_lock attribution.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 17.1 ENUMS
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'affiliate_attribution_mode'
  ) then
    create type public.affiliate_attribution_mode as enum (
      'last_click',
      'affiliate_lock'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'affiliate_lock_mode'
  ) then
    create type public.affiliate_lock_mode as enum (
      'cookie_duration',
      'lifetime'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'affiliate_status'
  ) then
    create type public.affiliate_status as enum (
      'pending',
      'active',
      'suspended',
      'rejected'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'commission_status'
  ) then
    create type public.commission_status as enum (
      'pending',
      'approved',
      'rejected',
      'paid',
      'cancelled'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'payout_status'
  ) then
    create type public.payout_status as enum (
      'pending',
      'processing',
      'paid',
      'rejected',
      'cancelled'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'coupon_kind'
  ) then
    create type public.coupon_kind as enum (
      'internal_master',
      'public'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname = 'discount_type'
  ) then
    create type public.discount_type as enum (
      'percent',
      'fixed'
    );
  end if;
end
$$;

-- ------------------------------------------------------------
-- 17.2 GLOBAL AFFILIATE SETTINGS
-- Single row: id = 1
-- ------------------------------------------------------------

create table if not exists public.affiliate_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,

  attribution_mode public.affiliate_attribution_mode
    not null default 'last_click',

  cookie_duration_days integer
    not null default 30
    check (cookie_duration_days between 1 and 3650),

  lock_mode public.affiliate_lock_mode
    not null default 'cookie_duration',

  default_commission_percent numeric(7,4)
    not null default 20
    check (
      default_commission_percent >= 0
      and default_commission_percent <= 100
    ),

  minimum_payout numeric(18,2)
    not null default 0
    check (minimum_payout >= 0),

  auto_approve_affiliate boolean not null default true,

  coupon_alias_overrides_cookie boolean not null default true,

  prevent_self_referral boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.affiliate_settings (id)
values (1)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 17.3 AFFILIATE ACCOUNTS
-- One affiliate account per profile.
-- ------------------------------------------------------------

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references public.profiles(id) on delete cascade,

  referral_code text not null unique,

  status public.affiliate_status not null default 'active',

  display_name text,

  payout_method text,
  payout_account_name text,
  payout_account_number text,

  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliates_referral_code_format
    check (
      referral_code = lower(referral_code)
      and referral_code ~ '^[a-z0-9]{7,10}$'
    )
);

-- ------------------------------------------------------------
-- Referral codes are lowercase and unique case-insensitively.
create unique index if not exists affiliates_referral_code_lower_uidx
  on public.affiliates (lower(referral_code));

-- 17.4 PRODUCT AFFILIATE RULES
-- No modification to public.products required.
-- ------------------------------------------------------------

create table if not exists public.product_affiliate_rules (
  product_id uuid primary key
    references public.products(id) on delete cascade,

  affiliate_enabled boolean not null default false,

  commission_percent numeric(7,4)
    check (
      commission_percent is null
      or (
        commission_percent >= 0
        and commission_percent <= 100
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULL commission_percent = use global default.

-- ------------------------------------------------------------
-- 17.5 COUPON PARENTS / SUPER ADMIN COUPONS
--
-- internal_master:
--   Super Admin internal coupon.
--   force_no_affiliate is ALWAYS true by constraint.
--
-- public:
--   General customer coupon.
--   May allow affiliates to create alias codes.
-- ------------------------------------------------------------

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  name text not null,
  description text,

  kind public.coupon_kind not null default 'public',

  discount_type public.discount_type not null,
  discount_value numeric(18,2) not null
    check (discount_value > 0),

  starts_at timestamptz,
  ends_at timestamptz,

  usage_limit integer
    check (usage_limit is null or usage_limit > 0),

  usage_limit_per_customer integer
    check (
      usage_limit_per_customer is null
      or usage_limit_per_customer > 0
    ),

  minimum_order_amount numeric(18,2)
    check (
      minimum_order_amount is null
      or minimum_order_amount >= 0
    ),

  active boolean not null default true,

  allow_affiliate_alias boolean not null default false,

  max_aliases_per_affiliate integer
    not null default 1
    check (max_aliases_per_affiliate between 1 and 100),

  force_no_affiliate boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint coupons_code_format
    check (
      code = upper(code)
      and code ~ '^[A-Z0-9_-]{2,50}$'
    ),

  constraint coupons_date_range
    check (
      starts_at is null
      or ends_at is null
      or ends_at > starts_at
    ),

  constraint coupons_percent_max
    check (
      discount_type <> 'percent'
      or discount_value <= 100
    ),

  constraint coupons_internal_rules
    check (
      kind <> 'internal_master'
      or (
        force_no_affiliate = true
        and allow_affiliate_alias = false
      )
    )
);

-- ------------------------------------------------------------
-- 17.6 COUPON PRODUCT SCOPE
-- Empty rows for a coupon = coupon applies to all products.
-- ------------------------------------------------------------

create table if not exists public.coupon_products (
  coupon_id uuid not null
    references public.coupons(id) on delete cascade,

  product_id uuid not null
    references public.products(id) on delete cascade,

  primary key (coupon_id, product_id)
);

-- ------------------------------------------------------------
-- 17.7 AFFILIATE COUPON ALIASES
--
-- Example:
-- parent coupon = PROMO
-- affiliate Terry alias = TERRY20
--
-- Alias has NO independent discount settings.
-- Discount/rules always come from parent_coupon_id.
-- ------------------------------------------------------------

create table if not exists public.affiliate_coupon_aliases (
  id uuid primary key default gen_random_uuid(),

  affiliate_id uuid not null
    references public.affiliates(id) on delete cascade,

  parent_coupon_id uuid not null
    references public.coupons(id) on delete cascade,

  alias_code text not null unique,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint affiliate_coupon_alias_code_format
    check (
      alias_code = upper(alias_code)
      and alias_code ~ '^[A-Z0-9_-]{2,50}$'
    ),

  constraint affiliate_coupon_alias_unique_parent
    unique (affiliate_id, parent_coupon_id, alias_code)
);

-- ------------------------------------------------------------
-- 17.8 REFERRAL CLICK LOG
-- Raw click/audit trail.
-- ------------------------------------------------------------

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),

  affiliate_id uuid not null
    references public.affiliates(id) on delete cascade,

  product_id uuid
    references public.products(id) on delete set null,

  visitor_key text not null,

  landing_path text,
  referrer_url text,

  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_affiliate_created_idx
  on public.affiliate_clicks (affiliate_id, created_at desc);

create index if not exists affiliate_clicks_visitor_created_idx
  on public.affiliate_clicks (visitor_key, created_at desc);

-- ------------------------------------------------------------
-- 17.9 ATTRIBUTIONS
--
-- visitor_key:
-- Anonymous/browser identity generated by the application.
--
-- customer_user_id:
-- Filled when visitor is authenticated / becomes a member.
--
-- expires_at:
-- last_click / cookie-duration lock expiration.
--
-- locked_forever:
-- lifetime affiliate lock.
-- ------------------------------------------------------------

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),

  visitor_key text not null unique,

  customer_user_id uuid
    references public.profiles(id) on delete set null,

  affiliate_id uuid not null
    references public.affiliates(id) on delete cascade,

  source text not null default 'referral_link'
    check (
      source in (
        'referral_link',
        'affiliate_coupon',
        'admin'
      )
    ),

  source_alias_id uuid
    references public.affiliate_coupon_aliases(id) on delete set null,

  first_attributed_at timestamptz not null default now(),
  last_attributed_at timestamptz not null default now(),

  expires_at timestamptz,
  locked_forever boolean not null default false,

  updated_at timestamptz not null default now()
);

create index if not exists affiliate_attributions_customer_idx
  on public.affiliate_attributions (customer_user_id);

create index if not exists affiliate_attributions_affiliate_idx
  on public.affiliate_attributions (affiliate_id);

-- ------------------------------------------------------------
-- 17.10 AFFILIATE ORDERS
--
-- This is the affiliate/checkout snapshot layer.
-- It intentionally does not assume an old orders table because the
-- current master frontend has no existing checkout/order schema yet.
--
-- external_order_id can later point to the checkout/payment order ID.
-- ------------------------------------------------------------

create table if not exists public.affiliate_orders (
  id uuid primary key default gen_random_uuid(),

  external_order_id text unique,

  buyer_user_id uuid
    references public.profiles(id) on delete set null,

  buyer_email text,

  product_id uuid not null
    references public.products(id) on delete restrict,

  gross_amount numeric(18,2) not null
    check (gross_amount >= 0),

  discount_amount numeric(18,2) not null default 0
    check (discount_amount >= 0),

  net_amount numeric(18,2) not null
    check (net_amount >= 0),

  coupon_id uuid
    references public.coupons(id) on delete set null,

  affiliate_alias_id uuid
    references public.affiliate_coupon_aliases(id) on delete set null,

  affiliate_id uuid
    references public.affiliates(id) on delete set null,

  attribution_id uuid
    references public.affiliate_attributions(id) on delete set null,

  affiliate_display_name_snapshot text,
  affiliate_referral_code_snapshot text,

  attribution_mode_snapshot public.affiliate_attribution_mode,

  commission_percent_snapshot numeric(7,4)
    check (
      commission_percent_snapshot is null
      or (
        commission_percent_snapshot >= 0
        and commission_percent_snapshot <= 100
      )
    ),

  affiliate_eligible_snapshot boolean not null default false,

  no_affiliate_reason text,

  payment_status text not null default 'pending'
    check (
      payment_status in (
        'pending',
        'paid',
        'failed',
        'cancelled',
        'refunded'
      )
    ),

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists affiliate_orders_affiliate_idx
  on public.affiliate_orders (affiliate_id, created_at desc);

create index if not exists affiliate_orders_buyer_idx
  on public.affiliate_orders (buyer_user_id, created_at desc);

-- ------------------------------------------------------------
-- 17.11 COMMISSION LEDGER
-- Snapshot; changing future settings never changes old commission.
-- ------------------------------------------------------------

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),

  affiliate_id uuid not null
    references public.affiliates(id) on delete restrict,

  affiliate_order_id uuid not null unique
    references public.affiliate_orders(id) on delete restrict,

  product_id uuid not null
    references public.products(id) on delete restrict,

  commission_base numeric(18,2) not null
    check (commission_base >= 0),

  commission_percent numeric(7,4) not null
    check (
      commission_percent >= 0
      and commission_percent <= 100
    ),

  commission_amount numeric(18,2) not null
    check (commission_amount >= 0),

  status public.commission_status not null default 'pending',

  note text,

  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,

  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_commissions_affiliate_status_idx
  on public.affiliate_commissions (affiliate_id, status, created_at desc);

-- ------------------------------------------------------------
-- 17.12 PAYOUT REQUESTS
-- ------------------------------------------------------------

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),

  affiliate_id uuid not null
    references public.affiliates(id) on delete restrict,

  amount numeric(18,2) not null
    check (amount > 0),

  status public.payout_status not null default 'pending',

  payout_method_snapshot text,
  payout_account_name_snapshot text,
  payout_account_number_snapshot text,

  note text,
  admin_note text,

  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null
);

create index if not exists affiliate_payouts_affiliate_status_idx
  on public.affiliate_payouts (affiliate_id, status, requested_at desc);

-- ------------------------------------------------------------
-- 17.13 COUPON USAGE AUDIT
-- ------------------------------------------------------------

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),

  coupon_id uuid not null
    references public.coupons(id) on delete restrict,

  affiliate_alias_id uuid
    references public.affiliate_coupon_aliases(id) on delete set null,

  affiliate_order_id uuid
    references public.affiliate_orders(id) on delete set null,

  user_id uuid
    references public.profiles(id) on delete set null,

  customer_key text,

  discount_amount numeric(18,2) not null default 0
    check (discount_amount >= 0),

  created_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id, created_at desc);

-- ------------------------------------------------------------
-- 17.14 SHARED updated_at TRIGGER
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_affiliate_settings_updated_at
  on public.affiliate_settings;
create trigger trg_affiliate_settings_updated_at
before update on public.affiliate_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_affiliates_updated_at
  on public.affiliates;
create trigger trg_affiliates_updated_at
before update on public.affiliates
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_affiliate_rules_updated_at
  on public.product_affiliate_rules;
create trigger trg_product_affiliate_rules_updated_at
before update on public.product_affiliate_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_coupons_updated_at
  on public.coupons;
create trigger trg_coupons_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

drop trigger if exists trg_affiliate_coupon_aliases_updated_at
  on public.affiliate_coupon_aliases;
create trigger trg_affiliate_coupon_aliases_updated_at
before update on public.affiliate_coupon_aliases
for each row execute function public.set_updated_at();

drop trigger if exists trg_affiliate_attributions_updated_at
  on public.affiliate_attributions;
create trigger trg_affiliate_attributions_updated_at
before update on public.affiliate_attributions
for each row execute function public.set_updated_at();

drop trigger if exists trg_affiliate_commissions_updated_at
  on public.affiliate_commissions;
create trigger trg_affiliate_commissions_updated_at
before update on public.affiliate_commissions
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 17.15 ADMIN CHECK
-- Uses current iMersSUPA profiles.role architecture.
-- ------------------------------------------------------------

create or replace function public.is_imerssupa_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.is_imerssupa_admin() from public;
grant execute on function public.is_imerssupa_admin() to authenticated;

-- ------------------------------------------------------------
-- 17.16 VALIDATE AFFILIATE ALIAS
-- Enforces parent coupon rules and alias count in DB.
-- ------------------------------------------------------------

create or replace function public.validate_affiliate_coupon_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_alias_count integer;
begin
  new.alias_code := upper(trim(new.alias_code));

  select *
  into v_coupon
  from public.coupons
  where id = new.parent_coupon_id;

  if not found then
    raise exception 'Parent coupon not found';
  end if;

  if v_coupon.kind <> 'public' then
    raise exception 'Internal/master coupon cannot have affiliate aliases';
  end if;

  if not v_coupon.allow_affiliate_alias then
    raise exception 'This coupon does not allow affiliate aliases';
  end if;

  if not v_coupon.active then
    raise exception 'Parent coupon is inactive';
  end if;

  select *
  into v_affiliate
  from public.affiliates
  where id = new.affiliate_id;

  if not found or v_affiliate.status <> 'active' then
    raise exception 'Affiliate is not active';
  end if;

  select count(*)
  into v_alias_count
  from public.affiliate_coupon_aliases a
  where a.affiliate_id = new.affiliate_id
    and a.parent_coupon_id = new.parent_coupon_id
    and a.active = true
    and (tg_op = 'INSERT' or a.id <> new.id);

  if v_alias_count >= v_coupon.max_aliases_per_affiliate then
    raise exception 'Affiliate alias limit reached for this coupon';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_affiliate_coupon_alias
  on public.affiliate_coupon_aliases;
create trigger trg_validate_affiliate_coupon_alias
before insert or update
on public.affiliate_coupon_aliases
for each row
execute function public.validate_affiliate_coupon_alias();

-- ------------------------------------------------------------
-- 17.17 NORMALIZE COUPON CODES
-- Also guarantees internal coupon behavior.
-- ------------------------------------------------------------

create or replace function public.normalize_coupon()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));

  if new.kind = 'internal_master' then
    new.force_no_affiliate := true;
    new.allow_affiliate_alias := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_coupon
  on public.coupons;
create trigger trg_normalize_coupon
before insert or update
on public.coupons
for each row
execute function public.normalize_coupon();

-- ------------------------------------------------------------
-- 17.18 REFERRAL CODE NORMALIZER
-- ------------------------------------------------------------

create or replace function public.normalize_affiliate_referral_code()
returns trigger
language plpgsql
as $$
begin
  new.referral_code := lower(regexp_replace(trim(new.referral_code), '[^a-zA-Z0-9]', '', 'g'));
  return new;
end;
$$;

drop trigger if exists trg_normalize_affiliate_referral_code
  on public.affiliates;
create trigger trg_normalize_affiliate_referral_code
before insert or update
on public.affiliates
for each row
execute function public.normalize_affiliate_referral_code();

-- ------------------------------------------------------------
-- 17.19 RESOLVE COUPON
--
-- Returns both direct public/master coupon and affiliate alias coupon.
-- Checkout can call this RPC before calculating totals.
-- ------------------------------------------------------------

create or replace function public.resolve_coupon_code(
  p_code text,
  p_product_id uuid default null
)
returns table (
  valid boolean,
  coupon_id uuid,
  coupon_code text,
  coupon_kind public.coupon_kind,
  discount_type public.discount_type,
  discount_value numeric,
  minimum_order_amount numeric,
  affiliate_alias_id uuid,
  affiliate_id uuid,
  affiliate_name text,
  force_no_affiliate boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_coupon public.coupons%rowtype;
  v_alias public.affiliate_coupon_aliases%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_has_product_scope boolean;
  v_product_allowed boolean;
begin
  if v_code = '' then
    return query
    select
      false, null::uuid, null::text, null::public.coupon_kind,
      null::public.discount_type, null::numeric, null::numeric,
      null::uuid, null::uuid, null::text, false,
      'Coupon code is empty'::text;
    return;
  end if;

  select *
  into v_coupon
  from public.coupons c
  where c.code = v_code
  limit 1;

  if not found then
    select *
    into v_alias
    from public.affiliate_coupon_aliases a
    where a.alias_code = v_code
      and a.active = true
    limit 1;

    if found then
      select *
      into v_coupon
      from public.coupons c
      where c.id = v_alias.parent_coupon_id;

      select *
      into v_affiliate
      from public.affiliates a
      where a.id = v_alias.affiliate_id;
    end if;
  end if;

  if v_coupon.id is null then
    return query
    select
      false, null::uuid, null::text, null::public.coupon_kind,
      null::public.discount_type, null::numeric, null::numeric,
      null::uuid, null::uuid, null::text, false,
      'Coupon not found'::text;
    return;
  end if;

  if not v_coupon.active then
    return query
    select
      false, v_coupon.id, v_coupon.code, v_coupon.kind,
      v_coupon.discount_type, v_coupon.discount_value,
      v_coupon.minimum_order_amount,
      case when v_alias.id is null then null else v_alias.id end,
      case when v_alias.id is null then null else v_affiliate.id end,
      case when v_alias.id is null then null else coalesce(v_affiliate.display_name, v_affiliate.referral_code) end,
      v_coupon.force_no_affiliate,
      'Coupon is inactive'::text;
    return;
  end if;

  if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    return query
    select
      false, v_coupon.id, v_coupon.code, v_coupon.kind,
      v_coupon.discount_type, v_coupon.discount_value,
      v_coupon.minimum_order_amount,
      case when v_alias.id is null then null else v_alias.id end,
      case when v_alias.id is null then null else v_affiliate.id end,
      case when v_alias.id is null then null else coalesce(v_affiliate.display_name, v_affiliate.referral_code) end,
      v_coupon.force_no_affiliate,
      'Coupon has not started yet'::text;
    return;
  end if;

  if v_coupon.ends_at is not null and now() >= v_coupon.ends_at then
    return query
    select
      false, v_coupon.id, v_coupon.code, v_coupon.kind,
      v_coupon.discount_type, v_coupon.discount_value,
      v_coupon.minimum_order_amount,
      case when v_alias.id is null then null else v_alias.id end,
      case when v_alias.id is null then null else v_affiliate.id end,
      case when v_alias.id is null then null else coalesce(v_affiliate.display_name, v_affiliate.referral_code) end,
      v_coupon.force_no_affiliate,
      'Coupon has expired'::text;
    return;
  end if;

  if v_alias.id is not null
     and (v_affiliate.id is null or v_affiliate.status <> 'active') then
    return query
    select
      false, v_coupon.id, v_coupon.code, v_coupon.kind,
      v_coupon.discount_type, v_coupon.discount_value,
      v_coupon.minimum_order_amount,
      v_alias.id, v_affiliate.id,
      coalesce(v_affiliate.display_name, v_affiliate.referral_code),
      v_coupon.force_no_affiliate,
      'Affiliate is inactive'::text;
    return;
  end if;

  if p_product_id is not null then
    select exists (
      select 1
      from public.coupon_products cp
      where cp.coupon_id = v_coupon.id
    )
    into v_has_product_scope;

    if v_has_product_scope then
      select exists (
        select 1
        from public.coupon_products cp
        where cp.coupon_id = v_coupon.id
          and cp.product_id = p_product_id
      )
      into v_product_allowed;

      if not v_product_allowed then
        return query
        select
          false, v_coupon.id, v_coupon.code, v_coupon.kind,
          v_coupon.discount_type, v_coupon.discount_value,
          v_coupon.minimum_order_amount,
          case when v_alias.id is null then null else v_alias.id end,
          case when v_alias.id is null then null else v_affiliate.id end,
          case when v_alias.id is null then null else coalesce(v_affiliate.display_name, v_affiliate.referral_code) end,
          v_coupon.force_no_affiliate,
          'Coupon is not valid for this product'::text;
        return;
      end if;
    end if;
  end if;

  return query
  select
    true,
    v_coupon.id,
    v_coupon.code,
    v_coupon.kind,
    v_coupon.discount_type,
    v_coupon.discount_value,
    v_coupon.minimum_order_amount,
    case when v_alias.id is null then null else v_alias.id end,
    case when v_alias.id is null then null else v_affiliate.id end,
    case when v_alias.id is null then null else coalesce(v_affiliate.display_name, v_affiliate.referral_code) end,
    v_coupon.force_no_affiliate,
    'OK'::text;
end;
$$;

grant execute on function public.resolve_coupon_code(text, uuid)
to anon, authenticated;

-- ------------------------------------------------------------
-- 17.20 APPLY REFERRAL ATTRIBUTION
--
-- Rules:
-- last_click:
--   latest valid affiliate replaces previous attribution.
--
-- affiliate_lock:
--   first valid affiliate remains.
--   cookie_duration = locked until expires_at.
--   lifetime = locked_forever.
--
-- p_force=true:
--   reserved for an explicit affiliate alias coupon when
--   coupon_alias_overrides_cookie=true.
-- ------------------------------------------------------------

create or replace function public.apply_affiliate_attribution(
  p_visitor_key text,
  p_referral_code text,
  p_customer_user_id uuid default null,
  p_source text default 'referral_link',
  p_source_alias_id uuid default null,
  p_force boolean default false
)
returns table (
  affiliate_id uuid,
  affiliate_name text,
  referral_code text,
  expires_at timestamptz,
  locked_forever boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.affiliate_settings%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_existing public.affiliate_attributions%rowtype;
  v_expiry timestamptz;
  v_lifetime boolean;
begin
  if trim(coalesce(p_visitor_key, '')) = '' then
    raise exception 'visitor_key is required';
  end if;

  select *
  into v_settings
  from public.affiliate_settings
  where id = 1;

  if not v_settings.enabled then
    return;
  end if;

  select *
  into v_affiliate
  from public.affiliates a
  where a.referral_code = upper(trim(p_referral_code))
    and a.status = 'active'
  limit 1;

  if not found then
    return;
  end if;

  if v_settings.prevent_self_referral
     and p_customer_user_id is not null
     and p_customer_user_id = v_affiliate.user_id then
    return;
  end if;

  select *
  into v_existing
  from public.affiliate_attributions a
  where a.visitor_key = p_visitor_key
  for update;

  v_lifetime :=
    v_settings.attribution_mode = 'affiliate_lock'
    and v_settings.lock_mode = 'lifetime';

  if v_lifetime then
    v_expiry := null;
  else
    v_expiry :=
      now() + make_interval(days => v_settings.cookie_duration_days);
  end if;

  if v_existing.id is null then
    insert into public.affiliate_attributions (
      visitor_key,
      customer_user_id,
      affiliate_id,
      source,
      source_alias_id,
      expires_at,
      locked_forever
    )
    values (
      p_visitor_key,
      p_customer_user_id,
      v_affiliate.id,
      p_source,
      p_source_alias_id,
      v_expiry,
      v_lifetime
    );
  else
    if not p_force
       and v_settings.attribution_mode = 'affiliate_lock'
       and (
         v_existing.locked_forever
         or (
           v_existing.expires_at is not null
           and v_existing.expires_at > now()
         )
       ) then

      update public.affiliate_attributions
      set
        customer_user_id =
          coalesce(customer_user_id, p_customer_user_id),
        updated_at = now()
      where id = v_existing.id;

    else
      update public.affiliate_attributions
      set
        customer_user_id =
          coalesce(p_customer_user_id, customer_user_id),
        affiliate_id = v_affiliate.id,
        source = p_source,
        source_alias_id = p_source_alias_id,
        last_attributed_at = now(),
        expires_at = v_expiry,
        locked_forever = v_lifetime,
        updated_at = now()
      where id = v_existing.id;
    end if;
  end if;

  return query
  select
    a.affiliate_id,
    coalesce(af.display_name, af.referral_code),
    af.referral_code,
    a.expires_at,
    a.locked_forever
  from public.affiliate_attributions a
  join public.affiliates af
    on af.id = a.affiliate_id
  where a.visitor_key = p_visitor_key;
end;
$$;

grant execute on function public.apply_affiliate_attribution(
  text, text, uuid, text, uuid, boolean
) to anon, authenticated;

-- ------------------------------------------------------------
-- 17.21 AFFILIATE BALANCE VIEW
-- Approved = withdrawable.
-- Paid = historical paid amount.
-- Pending = not withdrawable yet.
-- ------------------------------------------------------------

create or replace view public.affiliate_balances
with (security_invoker = true)
as
select
  a.id as affiliate_id,
  a.user_id,

  coalesce(sum(
    case
      when c.status = 'pending'
      then c.commission_amount
      else 0
    end
  ), 0)::numeric(18,2) as pending_amount,

  coalesce(sum(
    case
      when c.status = 'approved'
      then c.commission_amount
      else 0
    end
  ), 0)::numeric(18,2) as available_amount,

  coalesce(sum(
    case
      when c.status = 'paid'
      then c.commission_amount
      else 0
    end
  ), 0)::numeric(18,2) as paid_amount

from public.affiliates a
left join public.affiliate_commissions c
  on c.affiliate_id = a.id
group by a.id, a.user_id;

-- ------------------------------------------------------------
-- 17.22 ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.affiliate_settings enable row level security;
alter table public.affiliates enable row level security;
alter table public.product_affiliate_rules enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_products enable row level security;
alter table public.affiliate_coupon_aliases enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_orders enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;
alter table public.coupon_redemptions enable row level security;

-- Clean policy names first so STEP 17 is safe to rerun.

drop policy if exists "affiliate_settings_admin_all"
  on public.affiliate_settings;
drop policy if exists "affiliate_settings_authenticated_read"
  on public.affiliate_settings;

create policy "affiliate_settings_admin_all"
on public.affiliate_settings
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliate_settings_authenticated_read"
on public.affiliate_settings
for select
to authenticated
using (true);


drop policy if exists "affiliates_admin_all"
  on public.affiliates;
drop policy if exists "affiliates_owner_read"
  on public.affiliates;
drop policy if exists "affiliates_owner_update"
  on public.affiliates;

create policy "affiliates_admin_all"
on public.affiliates
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliates_owner_read"
on public.affiliates
for select
to authenticated
using (user_id = auth.uid());

create policy "affiliates_owner_update"
on public.affiliates
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());


drop policy if exists "product_affiliate_rules_admin_all"
  on public.product_affiliate_rules;
drop policy if exists "product_affiliate_rules_authenticated_read"
  on public.product_affiliate_rules;

create policy "product_affiliate_rules_admin_all"
on public.product_affiliate_rules
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "product_affiliate_rules_authenticated_read"
on public.product_affiliate_rules
for select
to authenticated
using (true);


drop policy if exists "coupons_admin_all"
  on public.coupons;
drop policy if exists "coupons_affiliate_parent_read"
  on public.coupons;

create policy "coupons_admin_all"
on public.coupons
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "coupons_affiliate_parent_read"
on public.coupons
for select
to authenticated
using (
  kind = 'public'
  and active = true
  and allow_affiliate_alias = true
);


drop policy if exists "coupon_products_admin_all"
  on public.coupon_products;
drop policy if exists "coupon_products_authenticated_read"
  on public.coupon_products;

create policy "coupon_products_admin_all"
on public.coupon_products
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "coupon_products_authenticated_read"
on public.coupon_products
for select
to authenticated
using (true);


drop policy if exists "affiliate_aliases_admin_all"
  on public.affiliate_coupon_aliases;
drop policy if exists "affiliate_aliases_owner_read"
  on public.affiliate_coupon_aliases;
drop policy if exists "affiliate_aliases_owner_insert"
  on public.affiliate_coupon_aliases;
drop policy if exists "affiliate_aliases_owner_update"
  on public.affiliate_coupon_aliases;

create policy "affiliate_aliases_admin_all"
on public.affiliate_coupon_aliases
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliate_aliases_owner_read"
on public.affiliate_coupon_aliases
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);

create policy "affiliate_aliases_owner_insert"
on public.affiliate_coupon_aliases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
      and a.status = 'active'
  )
);

create policy "affiliate_aliases_owner_update"
on public.affiliate_coupon_aliases
for update
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
      and a.status = 'active'
  )
);


drop policy if exists "affiliate_clicks_admin_read"
  on public.affiliate_clicks;
drop policy if exists "affiliate_clicks_owner_read"
  on public.affiliate_clicks;

create policy "affiliate_clicks_admin_read"
on public.affiliate_clicks
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "affiliate_clicks_owner_read"
on public.affiliate_clicks
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);


drop policy if exists "affiliate_attributions_admin_read"
  on public.affiliate_attributions;
drop policy if exists "affiliate_attributions_owner_read"
  on public.affiliate_attributions;

create policy "affiliate_attributions_admin_read"
on public.affiliate_attributions
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "affiliate_attributions_owner_read"
on public.affiliate_attributions
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);


drop policy if exists "affiliate_orders_admin_all"
  on public.affiliate_orders;
drop policy if exists "affiliate_orders_owner_read"
  on public.affiliate_orders;

create policy "affiliate_orders_admin_all"
on public.affiliate_orders
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliate_orders_owner_read"
on public.affiliate_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);


drop policy if exists "affiliate_commissions_admin_all"
  on public.affiliate_commissions;
drop policy if exists "affiliate_commissions_owner_read"
  on public.affiliate_commissions;

create policy "affiliate_commissions_admin_all"
on public.affiliate_commissions
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliate_commissions_owner_read"
on public.affiliate_commissions
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);


drop policy if exists "affiliate_payouts_admin_all"
  on public.affiliate_payouts;
drop policy if exists "affiliate_payouts_owner_read"
  on public.affiliate_payouts;
drop policy if exists "affiliate_payouts_owner_insert"
  on public.affiliate_payouts;

create policy "affiliate_payouts_admin_all"
on public.affiliate_payouts
for all
to authenticated
using (public.is_imerssupa_admin())
with check (public.is_imerssupa_admin());

create policy "affiliate_payouts_owner_read"
on public.affiliate_payouts
for select
to authenticated
using (
  exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
  )
);

create policy "affiliate_payouts_owner_insert"
on public.affiliate_payouts
for insert
to authenticated
with check (
  status = 'pending'
  and exists (
    select 1
    from public.affiliates a
    where a.id = affiliate_id
      and a.user_id = auth.uid()
      and a.status = 'active'
  )
);


drop policy if exists "coupon_redemptions_admin_read"
  on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_affiliate_read"
  on public.coupon_redemptions;

create policy "coupon_redemptions_admin_read"
on public.coupon_redemptions
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "coupon_redemptions_affiliate_read"
on public.coupon_redemptions
for select
to authenticated
using (
  affiliate_alias_id is not null
  and exists (
    select 1
    from public.affiliate_coupon_aliases aca
    join public.affiliates a
      on a.id = aca.affiliate_id
    where aca.id = affiliate_alias_id
      and a.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 17.23 PRIVILEGES
-- Direct mutation stays controlled by RLS/admin policies.
-- Public coupon validation + attribution happen via RPC.
-- ------------------------------------------------------------

grant select on public.affiliate_settings to authenticated;
grant select on public.product_affiliate_rules to authenticated;

grant select, update on public.affiliates to authenticated;
grant select on public.coupons to authenticated;
grant select on public.coupon_products to authenticated;

grant select, insert, update
on public.affiliate_coupon_aliases
to authenticated;

grant select on public.affiliate_clicks to authenticated;
grant select on public.affiliate_attributions to authenticated;
grant select on public.affiliate_orders to authenticated;
grant select on public.affiliate_commissions to authenticated;

grant select, insert
on public.affiliate_payouts
to authenticated;

grant select on public.coupon_redemptions to authenticated;
grant select on public.affiliate_balances to authenticated;

-- Admin writes still require RLS is_imerssupa_admin().
grant insert, update, delete
on public.affiliate_settings,
   public.affiliates,
   public.product_affiliate_rules,
   public.coupons,
   public.coupon_products,
   public.affiliate_coupon_aliases,
   public.affiliate_orders,
   public.affiliate_commissions,
   public.affiliate_payouts
to authenticated;

-- ------------------------------------------------------------
-- 17.24 FINAL SANITY CHECKS
-- These intentionally fail the transaction if core assumptions are missing.
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'STEP 17 requires public.profiles';
  end if;

  if to_regclass('public.products') is null then
    raise exception 'STEP 17 requires public.products';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    raise exception 'STEP 17 requires public.profiles.role';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'status'
  ) then
    raise exception 'STEP 17 requires public.profiles.status';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 17 COMPLETE
--
-- NEXT:
-- Admin UI:
--   Affiliate Settings
--   Affiliate Management
--   Product Commission Rules
--   Coupon Manager
--
-- Member UI:
--   Affiliate Saya
--   Referral Link
--   Alias Coupon
--   Commission / Payout
--
-- Checkout:
--   Show affiliate name
--   Resolve coupon
--   Apply Last Click / Affiliate Lock
--   Internal/master coupon => NO affiliate commission
-- ============================================================


-- ===== SOURCE STEP 18: 18-affiliate-admin-operations.sql =====
-- ============================================================
-- iMersSUPA - 18 Affiliate Admin Operations
-- Requires: STEP 17 Affiliate & Coupon Core
-- ============================================================

begin;

-- 18.1 PRE-FLIGHT
do $$
begin
  if to_regclass('public.affiliate_settings') is null
     or to_regclass('public.affiliates') is null
     or to_regclass('public.product_affiliate_rules') is null
     or to_regclass('public.coupons') is null
     or to_regclass('public.affiliate_coupon_aliases') is null
     or to_regclass('public.affiliate_clicks') is null
     or to_regclass('public.affiliate_commissions') is null
     or to_regclass('public.affiliate_payouts') is null then
    raise exception 'STEP 18 requires STEP 17 Affiliate & Coupon Core';
  end if;
end
$$;

-- 18.2 HARDEN MEMBER WRITES
-- Sensitive mutations now go through validated RPC functions.
revoke insert, update, delete on public.affiliates from authenticated;
revoke insert, update, delete on public.affiliate_payouts from authenticated;
revoke insert, update, delete on public.affiliate_coupon_aliases from authenticated;

drop policy if exists "affiliates_owner_update" on public.affiliates;
drop policy if exists "affiliate_payouts_owner_insert" on public.affiliate_payouts;
drop policy if exists "affiliate_aliases_owner_insert" on public.affiliate_coupon_aliases;
drop policy if exists "affiliate_aliases_owner_update" on public.affiliate_coupon_aliases;

-- 18.3 REFERRAL CODE GENERATOR
create or replace function public.generate_affiliate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_base text;
  v_code text;
begin
  select coalesce(nullif(trim(p.full_name), ''), 'member')
    into v_name
  from public.profiles p
  where p.id = auth.uid();

  v_base := lower(regexp_replace(coalesce(v_name, 'member'), '[^a-zA-Z0-9]', '', 'g'));
  if length(v_base) < 3 then
    v_base := substring(v_base || 'member' from 1 for 3);
  else
    v_base := substring(v_base from 1 for 6);
  end if;

  loop
    v_code := v_base || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (
      select 1 from public.affiliates where lower(referral_code) = lower(v_code)
    );
  end loop;
  return v_code;
end;
$$;

revoke all on function public.generate_affiliate_referral_code() from public;

-- 18.4 MEMBER JOIN AFFILIATE
create or replace function public.join_affiliate_program()
returns table (
  affiliate_id uuid,
  referral_code text,
  affiliate_status public.affiliate_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings public.affiliate_settings%rowtype;
  v_profile public.profiles%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_status public.affiliate_status;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_settings from public.affiliate_settings where id = 1;
  if not found or not v_settings.enabled then
    raise exception 'Affiliate program is disabled';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.status <> 'active' then
    raise exception 'Active member profile required';
  end if;

  select * into v_affiliate from public.affiliates where user_id = v_uid;
  if found then
    return query select v_affiliate.id, v_affiliate.referral_code, v_affiliate.status;
    return;
  end if;

  v_status := case
    when v_settings.auto_approve_affiliate then 'active'::public.affiliate_status
    else 'pending'::public.affiliate_status
  end;

  insert into public.affiliates (
    user_id, referral_code, status, display_name, approved_at
  )
  values (
    v_uid,
    public.generate_affiliate_referral_code(),
    v_status,
    nullif(trim(v_profile.full_name), ''),
    case when v_status = 'active' then now() else null end
  )
  returning * into v_affiliate;

  return query select v_affiliate.id, v_affiliate.referral_code, v_affiliate.status;
end;
$$;

revoke all on function public.join_affiliate_program() from public;
grant execute on function public.join_affiliate_program() to authenticated;

-- 18.5 MEMBER PAYOUT PROFILE
create or replace function public.update_affiliate_payout_profile(
  p_display_name text,
  p_payout_method text,
  p_account_name text,
  p_account_number text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if length(trim(coalesce(p_display_name,''))) > 150
     or length(trim(coalesce(p_payout_method,''))) > 100
     or length(trim(coalesce(p_account_name,''))) > 150
     or length(trim(coalesce(p_account_number,''))) > 150 then
    raise exception 'Invalid payout profile value';
  end if;

  update public.affiliates
  set display_name = nullif(trim(p_display_name),''),
      payout_method = nullif(trim(p_payout_method),''),
      payout_account_name = nullif(trim(p_account_name),''),
      payout_account_number = nullif(trim(p_account_number),'')
  where user_id = auth.uid();

  if not found then raise exception 'Affiliate account not found'; end if;
end;
$$;

revoke all on function public.update_affiliate_payout_profile(text,text,text,text) from public;
grant execute on function public.update_affiliate_payout_profile(text,text,text,text) to authenticated;

-- 18.6 MEMBER CREATE AFFILIATE COUPON ALIAS
create or replace function public.create_affiliate_coupon_alias(
  p_parent_coupon_id uuid,
  p_alias_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_alias_id uuid;
  v_code text := upper(trim(coalesce(p_alias_code,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if v_code !~ '^[A-Z0-9_-]{2,50}$' then
    raise exception 'Alias must use 2-50 characters: A-Z, 0-9, _ or -';
  end if;

  if exists (select 1 from public.coupons where code = v_code) then
    raise exception 'Code already used by a main coupon';
  end if;

  select id into v_affiliate_id
  from public.affiliates
  where user_id = auth.uid() and status = 'active';

  if v_affiliate_id is null then raise exception 'Active affiliate required'; end if;

  insert into public.affiliate_coupon_aliases (
    affiliate_id, parent_coupon_id, alias_code, active
  )
  values (v_affiliate_id, p_parent_coupon_id, v_code, true)
  returning id into v_alias_id;

  return v_alias_id;
end;
$$;

revoke all on function public.create_affiliate_coupon_alias(uuid,text) from public;
grant execute on function public.create_affiliate_coupon_alias(uuid,text) to authenticated;

create or replace function public.set_my_affiliate_alias_status(
  p_alias_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.affiliate_coupon_aliases aca
  set active = p_active
  where aca.id = p_alias_id
    and exists (
      select 1 from public.affiliates a
      where a.id = aca.affiliate_id and a.user_id = auth.uid()
    );

  if not found then raise exception 'Affiliate alias not found'; end if;
end;
$$;

revoke all on function public.set_my_affiliate_alias_status(uuid,boolean) from public;
grant execute on function public.set_my_affiliate_alias_status(uuid,boolean) to authenticated;

-- 18.7 SAFE REFERRAL CLICK + ATTRIBUTION
create or replace function public.track_affiliate_referral(
  p_referral_code text,
  p_visitor_key text,
  p_product_id uuid default null,
  p_landing_path text default null,
  p_referrer_url text default null
)
returns table (
  affiliate_id uuid,
  affiliate_name text,
  referral_code text,
  expires_at timestamptz,
  locked_forever boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.affiliate_settings%rowtype;
  v_affiliate public.affiliates%rowtype;
begin
  if trim(coalesce(p_visitor_key,'')) = '' then
    raise exception 'visitor_key required';
  end if;

  if length(p_visitor_key) > 200
     or length(coalesce(p_landing_path,'')) > 1000
     or length(coalesce(p_referrer_url,'')) > 2000 then
    raise exception 'Tracking value too long';
  end if;

  select * into v_settings from public.affiliate_settings where id = 1;
  if not found or not v_settings.enabled then return; end if;

  select * into v_affiliate
  from public.affiliates
  where referral_code = upper(trim(p_referral_code))
    and status = 'active'
  limit 1;

  if not found then return; end if;

  if v_settings.prevent_self_referral
     and auth.uid() is not null
     and auth.uid() = v_affiliate.user_id then
    return;
  end if;

  insert into public.affiliate_clicks (
    affiliate_id, product_id, visitor_key, landing_path, referrer_url
  )
  values (
    v_affiliate.id, p_product_id, p_visitor_key,
    nullif(trim(p_landing_path),''),
    nullif(trim(p_referrer_url),'')
  );

  return query
  select * from public.apply_affiliate_attribution(
    p_visitor_key,
    v_affiliate.referral_code,
    auth.uid(),
    'referral_link',
    null,
    false
  );
end;
$$;

revoke all on function public.track_affiliate_referral(text,text,uuid,text,text) from public;
grant execute on function public.track_affiliate_referral(text,text,uuid,text,text) to anon, authenticated;

-- 18.8 AFFILIATE ALIAS ATTRIBUTION
create or replace function public.apply_affiliate_alias_attribution(
  p_alias_code text,
  p_visitor_key text
)
returns table (
  affiliate_id uuid,
  affiliate_name text,
  referral_code text,
  expires_at timestamptz,
  locked_forever boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.affiliate_settings%rowtype;
  v_alias public.affiliate_coupon_aliases%rowtype;
  v_affiliate public.affiliates%rowtype;
begin
  if trim(coalesce(p_visitor_key,'')) = '' then
    raise exception 'visitor_key required';
  end if;

  select * into v_settings from public.affiliate_settings where id = 1;
  if not found or not v_settings.enabled then return; end if;

  select aca.* into v_alias
  from public.affiliate_coupon_aliases aca
  join public.coupons c on c.id = aca.parent_coupon_id
  where aca.alias_code = upper(trim(p_alias_code))
    and aca.active = true
    and c.kind = 'public'
    and c.active = true
    and c.allow_affiliate_alias = true
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.ends_at is null or now() < c.ends_at)
  limit 1;

  if not found then return; end if;

  select * into v_affiliate
  from public.affiliates
  where id = v_alias.affiliate_id and status = 'active';

  if not found then return; end if;

  if v_settings.prevent_self_referral
     and auth.uid() is not null
     and auth.uid() = v_affiliate.user_id then
    return;
  end if;

  return query
  select * from public.apply_affiliate_attribution(
    p_visitor_key,
    v_affiliate.referral_code,
    auth.uid(),
    'affiliate_coupon',
    v_alias.id,
    v_settings.coupon_alias_overrides_cookie
  );
end;
$$;

revoke all on function public.apply_affiliate_alias_attribution(text,text) from public;
grant execute on function public.apply_affiliate_alias_attribution(text,text) to anon, authenticated;

-- 18.9 SAFE PAYOUT REQUEST
create or replace function public.request_affiliate_payout(p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.affiliate_settings%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_approved numeric(18,2);
  v_reserved numeric(18,2);
  v_available numeric(18,2);
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Invalid payout amount'; end if;

  select * into v_settings from public.affiliate_settings where id = 1;
  if not found or not v_settings.enabled then
    raise exception 'Affiliate program is disabled';
  end if;

  select * into v_affiliate
  from public.affiliates
  where user_id = auth.uid() and status = 'active'
  for update;

  if not found then raise exception 'Active affiliate required'; end if;

  if v_affiliate.payout_method is null
     or v_affiliate.payout_account_name is null
     or v_affiliate.payout_account_number is null then
    raise exception 'Complete payout information first';
  end if;

  if p_amount < v_settings.minimum_payout then
    raise exception 'Amount is below minimum payout';
  end if;

  select coalesce(sum(commission_amount),0)
  into v_approved
  from public.affiliate_commissions
  where affiliate_id = v_affiliate.id and status = 'approved';

  select coalesce(sum(amount),0)
  into v_reserved
  from public.affiliate_payouts
  where affiliate_id = v_affiliate.id
    and status in ('pending','processing');

  v_available := v_approved - v_reserved;

  if p_amount > v_available then
    raise exception 'Payout exceeds available balance';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id, amount, status,
    payout_method_snapshot,
    payout_account_name_snapshot,
    payout_account_number_snapshot
  )
  values (
    v_affiliate.id, p_amount, 'pending',
    v_affiliate.payout_method,
    v_affiliate.payout_account_name,
    v_affiliate.payout_account_number
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_affiliate_payout(numeric) from public;
grant execute on function public.request_affiliate_payout(numeric) to authenticated;

-- 18.10 MEMBER SUMMARY VIEW
create or replace view public.my_affiliate_summary
with (security_invoker = true)
as
select
  a.id as affiliate_id,
  a.user_id,
  a.referral_code,
  a.display_name,
  a.status,
  a.payout_method,
  a.payout_account_name,
  a.payout_account_number,
  (select count(*) from public.affiliate_clicks x
   where x.affiliate_id = a.id)::bigint as total_clicks,
  (select count(*) from public.affiliate_orders x
   where x.affiliate_id = a.id and x.payment_status = 'paid')::bigint as paid_orders,
  coalesce((select sum(x.commission_amount)
   from public.affiliate_commissions x
   where x.affiliate_id = a.id and x.status = 'pending'),0)::numeric(18,2) as pending_commission,
  greatest(
    coalesce((select sum(x.commission_amount)
      from public.affiliate_commissions x
      where x.affiliate_id = a.id and x.status = 'approved'),0)
    -
    coalesce((select sum(x.amount)
      from public.affiliate_payouts x
      where x.affiliate_id = a.id and x.status in ('pending','processing')),0),
    0
  )::numeric(18,2) as available_balance,
  coalesce((select sum(x.commission_amount)
   from public.affiliate_commissions x
   where x.affiliate_id = a.id and x.status = 'paid'),0)::numeric(18,2) as total_paid
from public.affiliates a
where a.user_id = auth.uid();

grant select on public.my_affiliate_summary to authenticated;

-- 18.11 ADMIN SUMMARY VIEW
create or replace view public.admin_affiliate_summary
with (security_invoker = true)
as
select
  (select count(*) from public.affiliates) as total_affiliates,
  (select count(*) from public.affiliates where status='active') as active_affiliates,
  (select count(*) from public.affiliates where status='pending') as pending_affiliates,
  (select count(*) from public.affiliate_clicks) as total_clicks,
  (select count(*) from public.affiliate_orders where payment_status='paid') as paid_referral_orders,
  coalesce((select sum(commission_amount) from public.affiliate_commissions where status='pending'),0)::numeric(18,2) as pending_commission,
  coalesce((select sum(commission_amount) from public.affiliate_commissions where status='approved'),0)::numeric(18,2) as approved_commission,
  coalesce((select sum(amount) from public.affiliate_payouts where status in ('pending','processing')),0)::numeric(18,2) as pending_payout
where public.is_imerssupa_admin();

grant select on public.admin_affiliate_summary to authenticated;

-- 18.12 ADMIN GLOBAL SETTINGS
create or replace function public.admin_update_affiliate_settings(
  p_enabled boolean,
  p_attribution_mode public.affiliate_attribution_mode,
  p_cookie_duration_days integer,
  p_lock_mode public.affiliate_lock_mode,
  p_default_commission_percent numeric,
  p_minimum_payout numeric,
  p_auto_approve_affiliate boolean,
  p_coupon_alias_overrides_cookie boolean,
  p_prevent_self_referral boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if p_cookie_duration_days not between 1 and 3650 then raise exception 'Invalid cookie duration'; end if;
  if p_default_commission_percent < 0 or p_default_commission_percent > 100 then raise exception 'Invalid commission'; end if;
  if p_minimum_payout < 0 then raise exception 'Invalid minimum payout'; end if;

  update public.affiliate_settings
  set enabled=p_enabled,
      attribution_mode=p_attribution_mode,
      cookie_duration_days=p_cookie_duration_days,
      lock_mode=p_lock_mode,
      default_commission_percent=p_default_commission_percent,
      minimum_payout=p_minimum_payout,
      auto_approve_affiliate=p_auto_approve_affiliate,
      coupon_alias_overrides_cookie=p_coupon_alias_overrides_cookie,
      prevent_self_referral=p_prevent_self_referral
  where id=1;
end;
$$;

revoke all on function public.admin_update_affiliate_settings(boolean,public.affiliate_attribution_mode,integer,public.affiliate_lock_mode,numeric,numeric,boolean,boolean,boolean) from public;
grant execute on function public.admin_update_affiliate_settings(boolean,public.affiliate_attribution_mode,integer,public.affiliate_lock_mode,numeric,numeric,boolean,boolean,boolean) to authenticated;

-- 18.13 ADMIN AFFILIATE STATUS
create or replace function public.admin_set_affiliate_status(
  p_affiliate_id uuid,
  p_status public.affiliate_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;

  update public.affiliates
  set status=p_status,
      approved_at=case when p_status='active' then coalesce(approved_at,now()) else approved_at end,
      approved_by=case when p_status='active' then coalesce(approved_by,auth.uid()) else approved_by end
  where id=p_affiliate_id;

  if not found then raise exception 'Affiliate not found'; end if;
end;
$$;

revoke all on function public.admin_set_affiliate_status(uuid,public.affiliate_status) from public;
grant execute on function public.admin_set_affiliate_status(uuid,public.affiliate_status) to authenticated;

-- 18.14 ADMIN PRODUCT AFFILIATE RULE
create or replace function public.admin_upsert_product_affiliate_rule(
  p_product_id uuid,
  p_affiliate_enabled boolean,
  p_commission_percent numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if p_commission_percent is not null
     and (p_commission_percent < 0 or p_commission_percent > 100) then
    raise exception 'Invalid commission';
  end if;
  if not exists(select 1 from public.products where id=p_product_id) then
    raise exception 'Product not found';
  end if;

  insert into public.product_affiliate_rules(product_id,affiliate_enabled,commission_percent)
  values(p_product_id,p_affiliate_enabled,p_commission_percent)
  on conflict(product_id) do update
  set affiliate_enabled=excluded.affiliate_enabled,
      commission_percent=excluded.commission_percent;
end;
$$;

revoke all on function public.admin_upsert_product_affiliate_rule(uuid,boolean,numeric) from public;
grant execute on function public.admin_upsert_product_affiliate_rule(uuid,boolean,numeric) to authenticated;

-- 18.15 ADMIN CREATE COUPON
create or replace function public.admin_create_coupon(
  p_code text,
  p_name text,
  p_description text,
  p_kind public.coupon_kind,
  p_discount_type public.discount_type,
  p_discount_value numeric,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_usage_limit integer default null,
  p_usage_limit_per_customer integer default null,
  p_minimum_order_amount numeric default null,
  p_allow_affiliate_alias boolean default false,
  p_max_aliases_per_affiliate integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text := upper(trim(coalesce(p_code,'')));
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if v_code !~ '^[A-Z0-9_-]{2,50}$' then raise exception 'Invalid coupon code'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'Coupon name required'; end if;
  if exists(select 1 from public.affiliate_coupon_aliases where alias_code=v_code) then
    raise exception 'Code already used by affiliate alias';
  end if;

  insert into public.coupons(
    code,name,description,kind,discount_type,discount_value,
    starts_at,ends_at,usage_limit,usage_limit_per_customer,
    minimum_order_amount,active,allow_affiliate_alias,
    max_aliases_per_affiliate,force_no_affiliate,created_by
  )
  values(
    v_code,trim(p_name),nullif(trim(p_description),''),p_kind,
    p_discount_type,p_discount_value,p_starts_at,p_ends_at,
    p_usage_limit,p_usage_limit_per_customer,p_minimum_order_amount,true,
    case when p_kind='internal_master' then false else p_allow_affiliate_alias end,
    p_max_aliases_per_affiliate,
    case when p_kind='internal_master' then true else false end,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_coupon(text,text,text,public.coupon_kind,public.discount_type,numeric,timestamptz,timestamptz,integer,integer,numeric,boolean,integer) from public;
grant execute on function public.admin_create_coupon(text,text,text,public.coupon_kind,public.discount_type,numeric,timestamptz,timestamptz,integer,integer,numeric,boolean,integer) to authenticated;

-- 18.16 ADMIN COUPON STATUS + PRODUCT SCOPE
create or replace function public.admin_set_coupon_status(p_coupon_id uuid,p_active boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  update public.coupons set active=p_active where id=p_coupon_id;
  if not found then raise exception 'Coupon not found'; end if;
end;
$$;

revoke all on function public.admin_set_coupon_status(uuid,boolean) from public;
grant execute on function public.admin_set_coupon_status(uuid,boolean) to authenticated;

create or replace function public.admin_replace_coupon_products(
  p_coupon_id uuid,
  p_product_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.coupons where id=p_coupon_id) then
    raise exception 'Coupon not found';
  end if;

  delete from public.coupon_products where coupon_id=p_coupon_id;

  if p_product_ids is not null and cardinality(p_product_ids)>0 then
    if exists(
      select 1 from unnest(p_product_ids) x(product_id)
      where not exists(select 1 from public.products p where p.id=x.product_id)
    ) then
      raise exception 'One or more products not found';
    end if;

    insert into public.coupon_products(coupon_id,product_id)
    select p_coupon_id,x.product_id
    from (select distinct unnest(p_product_ids) product_id) x;
  end if;
end;
$$;

revoke all on function public.admin_replace_coupon_products(uuid,uuid[]) from public;
grant execute on function public.admin_replace_coupon_products(uuid,uuid[]) to authenticated;

-- 18.17 ADMIN PAYOUT STATUS
-- Commission settlement itself will be bound to checkout/order settlement
-- in the Checkout Engine step; this RPC only manages payout workflow.
create or replace function public.admin_set_payout_status(
  p_payout_id uuid,
  p_status public.payout_status,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_old_status public.payout_status;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;

  select status into v_old_status
  from public.affiliate_payouts
  where id=p_payout_id
  for update;

  if not found then raise exception 'Payout not found'; end if;
  if v_old_status='paid' and p_status<>'paid' then
    raise exception 'Paid payout cannot be reverted';
  end if;

  update public.affiliate_payouts
  set status=p_status,
      admin_note=nullif(trim(p_admin_note),''),
      processed_at=case when p_status in('paid','rejected','cancelled') then now() else processed_at end,
      processed_by=case when p_status in('processing','paid','rejected','cancelled') then auth.uid() else processed_by end
  where id=p_payout_id;
end;
$$;

revoke all on function public.admin_set_payout_status(uuid,public.payout_status,text) from public;
grant execute on function public.admin_set_payout_status(uuid,public.payout_status,text) to authenticated;

-- 18.18 REMOVE BROAD DIRECT ADMIN/MEMBER TABLE WRITES FROM STEP 17
-- Admin mutations use the explicit admin RPCs above.
revoke insert,update,delete
on public.affiliate_settings,
   public.affiliates,
   public.product_affiliate_rules,
   public.coupons,
   public.coupon_products,
   public.affiliate_coupon_aliases,
   public.affiliate_orders,
   public.affiliate_commissions,
   public.affiliate_payouts
from authenticated;

-- Preserve RLS-protected reads.
grant select on public.affiliate_settings,
                public.affiliates,
                public.product_affiliate_rules,
                public.coupons,
                public.coupon_products,
                public.affiliate_coupon_aliases,
                public.affiliate_clicks,
                public.affiliate_attributions,
                public.affiliate_orders,
                public.affiliate_commissions,
                public.affiliate_payouts,
                public.coupon_redemptions
to authenticated;

commit;

-- ============================================================
-- STEP 18 COMPLETE
-- Query name:
-- iMersSUPA - 18 Affiliate Admin Operations
--
-- NEXT: Admin Affiliate Center frontend
-- ============================================================


-- ===== SOURCE STEP 19: 19-checkout-order-core.sql =====
-- ============================================================
-- iMersSUPA - 19 Checkout & Order Core
-- Requires:
--   iMersSUPA - 17 Affiliate & Coupon Core
--   iMersSUPA - 18 Affiliate Admin Operations
--
-- Scope:
-- - Canonical commerce orders + order items
-- - Server-side product price snapshots
-- - Coupon validation + usage reservation
-- - Public / affiliate alias coupons
-- - Internal/master coupon => affiliate disabled
-- - Last Click / Affiliate Lock attribution snapshot
-- - Affiliate identity snapshot for checkout/order
-- - Anti self-referral
-- - Idempotent checkout creation
-- - Buyer/admin read security
--
-- Payment settlement and product delivery are NOT performed here.
-- They are intentionally handled by the next backend steps.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 19.1 PRE-FLIGHT: VERIFY THE REAL EXISTING SCHEMA
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.products') is null
     or to_regclass('public.affiliate_settings') is null
     or to_regclass('public.affiliates') is null
     or to_regclass('public.product_affiliate_rules') is null
     or to_regclass('public.coupons') is null
     or to_regclass('public.coupon_products') is null
     or to_regclass('public.affiliate_coupon_aliases') is null
     or to_regclass('public.affiliate_attributions') is null
     or to_regclass('public.coupon_redemptions') is null then
    raise exception 'STEP 19 requires STEP 17 and STEP 18';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='slug'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='price'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='status'
  ) then
    raise exception 'STEP 19 requires products.id, name, slug, price, status';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 19.2 ENUMS
-- ------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname='commerce_order_status') then
    create type public.commerce_order_status as enum (
      'pending',
      'awaiting_payment',
      'paid',
      'processing',
      'completed',
      'cancelled',
      'expired',
      'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname='commerce_payment_status') then
    create type public.commerce_payment_status as enum (
      'unpaid',
      'pending',
      'paid',
      'failed',
      'cancelled',
      'expired',
      'refunded',
      'partially_refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname='coupon_redemption_status') then
    create type public.coupon_redemption_status as enum (
      'reserved',
      'consumed',
      'released'
    );
  end if;
end
$$;

-- ------------------------------------------------------------
-- 19.3 CANONICAL ORDERS
-- ------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  order_number text not null unique,
  idempotency_key text not null unique,

  buyer_user_id uuid
    references public.profiles(id) on delete set null,

  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,

  currency text not null default 'IDR',

  subtotal numeric(18,2) not null check (subtotal >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(18,2) not null check (total_amount >= 0),

  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code_snapshot text,
  coupon_kind_snapshot public.coupon_kind,
  affiliate_alias_id uuid
    references public.affiliate_coupon_aliases(id) on delete set null,

  affiliate_id uuid references public.affiliates(id) on delete set null,
  affiliate_name_snapshot text,
  affiliate_referral_code_snapshot text,
  attribution_id uuid
    references public.affiliate_attributions(id) on delete set null,
  attribution_mode_snapshot public.affiliate_attribution_mode,

  affiliate_eligible_snapshot boolean not null default false,
  no_affiliate_reason text,

  status public.commerce_order_status not null default 'pending',
  payment_status public.commerce_payment_status not null default 'unpaid',

  customer_note text,
  expires_at timestamptz,

  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_currency_format
    check (currency ~ '^[A-Z]{3}$'),

  constraint orders_amount_math
    check (
      discount_amount <= subtotal
      and total_amount = subtotal - discount_amount
    )
);

create index if not exists orders_buyer_created_idx
  on public.orders (buyer_user_id, created_at desc);

create index if not exists orders_email_created_idx
  on public.orders (lower(buyer_email), created_at desc);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_payment_status_created_idx
  on public.orders (payment_status, created_at desc);

create index if not exists orders_affiliate_created_idx
  on public.orders (affiliate_id, created_at desc);

-- ------------------------------------------------------------
-- 19.4 ORDER ITEMS
-- One immutable commercial snapshot per purchased product.
-- ------------------------------------------------------------

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id) on delete cascade,

  product_id uuid not null
    references public.products(id) on delete restrict,

  product_name_snapshot text not null,
  product_slug_snapshot text not null,

  quantity integer not null default 1 check (quantity > 0),

  unit_price numeric(18,2) not null check (unit_price >= 0),
  line_subtotal numeric(18,2) not null check (line_subtotal >= 0),
  line_discount numeric(18,2) not null default 0 check (line_discount >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),

  coupon_eligible_snapshot boolean not null default false,

  affiliate_eligible_snapshot boolean not null default false,
  commission_percent_snapshot numeric(7,4)
    check (
      commission_percent_snapshot is null
      or (
        commission_percent_snapshot >= 0
        and commission_percent_snapshot <= 100
      )
    ),

  created_at timestamptz not null default now(),

  constraint order_items_amount_math
    check (
      line_subtotal = unit_price * quantity
      and line_discount <= line_subtotal
      and line_total = line_subtotal - line_discount
    )
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

create index if not exists order_items_product_idx
  on public.order_items (product_id);

-- ------------------------------------------------------------
-- 19.5 EXTEND COUPON REDEMPTION AUDIT FOR COMMERCE ORDERS
-- Existing STEP 17 table is extended, not recreated.
-- ------------------------------------------------------------

alter table public.coupon_redemptions
  add column if not exists commerce_order_id uuid
    references public.orders(id) on delete set null;

alter table public.coupon_redemptions
  add column if not exists status public.coupon_redemption_status
    not null default 'reserved';

create unique index if not exists coupon_redemptions_commerce_order_uidx
  on public.coupon_redemptions (commerce_order_id)
  where commerce_order_id is not null;

create index if not exists coupon_redemptions_coupon_status_idx
  on public.coupon_redemptions (coupon_id, status, created_at desc);

-- ------------------------------------------------------------
-- 19.6 UPDATED_AT
-- public.set_updated_at() already exists from STEP 17.
-- ------------------------------------------------------------

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 19.7 ORDER NUMBER GENERATOR
-- ------------------------------------------------------------

create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_number text;
begin
  loop
    v_number :=
      'IMS-' ||
      to_char(now(), 'YYYYMMDD') ||
      '-' ||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

    exit when not exists (
      select 1 from public.orders where order_number=v_number
    );
  end loop;

  return v_number;
end;
$$;

revoke all on function public.generate_order_number() from public;

-- ------------------------------------------------------------
-- 19.8 PRIVATE CHECKOUT QUOTE ENGINE
--
-- IMPORTANT:
-- Client sends only product IDs + quantity + coupon code.
-- Price, discount, affiliate eligibility and commission are read
-- from trusted database records.
--
-- Returns JSONB so STEP 19 can reuse the exact same calculation
-- in preview and order creation without duplicating business logic.
-- ------------------------------------------------------------

create or replace function public.checkout_quote_internal(
  p_items jsonb,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_buyer_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_settings public.affiliate_settings%rowtype;

  v_coupon public.coupons%rowtype;
  v_alias public.affiliate_coupon_aliases%rowtype;
  v_alias_affiliate public.affiliates%rowtype;

  v_attribution public.affiliate_attributions%rowtype;
  v_affiliate public.affiliates%rowtype;

  v_coupon_code text := upper(trim(coalesce(p_coupon_code,'')));

  v_subtotal numeric(18,2) := 0;
  v_eligible_subtotal numeric(18,2) := 0;
  v_discount numeric(18,2) := 0;
  v_total numeric(18,2) := 0;

  v_coupon_usage bigint := 0;
  v_customer_usage bigint := 0;
  v_customer_key text;

  v_has_coupon_scope boolean := false;

  v_affiliate_id uuid;
  v_affiliate_name text;
  v_affiliate_referral_code text;
  v_attribution_id uuid;
  v_attribution_mode public.affiliate_attribution_mode;
  v_no_affiliate_reason text;

  v_items_out jsonb := '[]'::jsonb;
  v_row record;
  v_line_discount numeric(18,2);
  v_remaining_discount numeric(18,2);
  v_remaining_eligible numeric(18,2);
  v_product_affiliate_enabled boolean;
  v_product_commission numeric(7,4);
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items)=0 then
    raise exception 'At least one checkout item is required';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many checkout items';
  end if;

  select * into v_settings
  from public.affiliate_settings
  where id=1;

  -- Resolve coupon or affiliate alias.
  if v_coupon_code <> '' then
    select * into v_coupon
    from public.coupons
    where code=v_coupon_code
    limit 1;

    if not found then
      select * into v_alias
      from public.affiliate_coupon_aliases
      where alias_code=v_coupon_code
        and active=true
      limit 1;

      if found then
        select * into v_coupon
        from public.coupons
        where id=v_alias.parent_coupon_id;

        select * into v_alias_affiliate
        from public.affiliates
        where id=v_alias.affiliate_id;
      end if;
    end if;

    if v_coupon.id is null then
      raise exception 'Coupon not found';
    end if;

    if not v_coupon.active then
      raise exception 'Coupon is inactive';
    end if;

    if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
      raise exception 'Coupon has not started';
    end if;

    if v_coupon.ends_at is not null and now() >= v_coupon.ends_at then
      raise exception 'Coupon has expired';
    end if;

    if v_alias.id is not null then
      if v_coupon.kind <> 'public'
         or not v_coupon.allow_affiliate_alias
         or v_alias_affiliate.id is null
         or v_alias_affiliate.status <> 'active' then
        raise exception 'Affiliate coupon alias is not valid';
      end if;
    end if;

    select exists(
      select 1 from public.coupon_products
      where coupon_id=v_coupon.id
    )
    into v_has_coupon_scope;
  end if;

  -- Build trusted item snapshot.
  for v_row in
    with requested as (
      select
        (x->>'product_id')::uuid as product_id,
        greatest(coalesce((x->>'quantity')::integer,1),1) as quantity
      from jsonb_array_elements(p_items) x
    ),
    merged as (
      select product_id, sum(quantity)::integer as quantity
      from requested
      group by product_id
    )
    select
      p.id,
      p.name,
      p.slug,
      p.price::numeric as price,
      p.status,
      m.quantity,
      case
        when v_coupon.id is null then false
        when not v_has_coupon_scope then true
        else exists(
          select 1 from public.coupon_products cp
          where cp.coupon_id=v_coupon.id
            and cp.product_id=p.id
        )
      end as coupon_eligible,
      coalesce(par.affiliate_enabled,false) as affiliate_enabled,
      coalesce(
        par.commission_percent,
        v_settings.default_commission_percent
      )::numeric(7,4) as commission_percent
    from merged m
    join public.products p on p.id=m.product_id
    left join public.product_affiliate_rules par
      on par.product_id=p.id
  loop
    if v_row.status <> 'published' then
      raise exception 'Product % is not available for checkout', v_row.id;
    end if;

    if v_row.price is null or v_row.price < 0 then
      raise exception 'Product % has invalid price', v_row.id;
    end if;

    if v_row.quantity > 100 then
      raise exception 'Invalid quantity for product %', v_row.id;
    end if;

    v_subtotal := v_subtotal + (v_row.price * v_row.quantity);

    if v_row.coupon_eligible then
      v_eligible_subtotal :=
        v_eligible_subtotal + (v_row.price * v_row.quantity);
    end if;

    v_items_out := v_items_out || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_row.id,
        'product_name', v_row.name,
        'product_slug', v_row.slug,
        'quantity', v_row.quantity,
        'unit_price', v_row.price,
        'line_subtotal', v_row.price * v_row.quantity,
        'coupon_eligible', v_row.coupon_eligible,
        'affiliate_eligible', v_row.affiliate_enabled,
        'commission_percent',
          case
            when v_row.affiliate_enabled then v_row.commission_percent
            else null
          end
      )
    );
  end loop;

  -- Detect product IDs that do not exist.
  if (
    select count(distinct (x->>'product_id'))
    from jsonb_array_elements(p_items) x
  ) <> jsonb_array_length(v_items_out) then
    raise exception 'One or more products do not exist';
  end if;

  -- Coupon order-level rules.
  if v_coupon.id is not null then
    if v_coupon.minimum_order_amount is not null
       and v_subtotal < v_coupon.minimum_order_amount then
      raise exception 'Order does not meet coupon minimum amount';
    end if;

    if v_eligible_subtotal <= 0 then
      raise exception 'Coupon is not valid for selected products';
    end if;

    select count(*)
    into v_coupon_usage
    from public.coupon_redemptions cr
    where cr.coupon_id=v_coupon.id
      and cr.status in ('reserved','consumed');

    if v_coupon.usage_limit is not null
       and v_coupon_usage >= v_coupon.usage_limit then
      raise exception 'Coupon usage limit reached';
    end if;

    v_customer_key :=
      case
        when p_buyer_user_id is not null then 'user:' || p_buyer_user_id::text
        else null
      end;

    if v_coupon.usage_limit_per_customer is not null
       and v_customer_key is not null then
      select count(*)
      into v_customer_usage
      from public.coupon_redemptions cr
      where cr.coupon_id=v_coupon.id
        and cr.customer_key=v_customer_key
        and cr.status in ('reserved','consumed');

      if v_customer_usage >= v_coupon.usage_limit_per_customer then
        raise exception 'Customer coupon usage limit reached';
      end if;
    end if;

    if v_coupon.discount_type='percent' then
      v_discount :=
        round(v_eligible_subtotal * v_coupon.discount_value / 100.0, 2);
    else
      v_discount :=
        least(v_coupon.discount_value, v_eligible_subtotal);
    end if;
  end if;

  v_discount := least(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount;

  -- Resolve affiliate.
  -- Internal/master coupon always wins by disabling affiliate commission.
  if v_coupon.id is not null and v_coupon.force_no_affiliate then
    v_no_affiliate_reason := 'internal_master_coupon';
  elsif not v_settings.enabled then
    v_no_affiliate_reason := 'affiliate_program_disabled';
  else
    -- Explicit affiliate alias can identify/override attribution according
    -- to Super Admin setting.
    if v_alias.id is not null then
      if v_settings.prevent_self_referral
         and p_buyer_user_id is not null
         and p_buyer_user_id=v_alias_affiliate.user_id then
        v_no_affiliate_reason := 'self_referral';
      else
        v_affiliate_id := v_alias_affiliate.id;
        v_affiliate_name :=
          coalesce(v_alias_affiliate.display_name,
                   v_alias_affiliate.referral_code);
        v_affiliate_referral_code := v_alias_affiliate.referral_code;
        v_attribution_mode := v_settings.attribution_mode;

        if p_visitor_key is not null
           and trim(p_visitor_key)<>''
           and v_settings.coupon_alias_overrides_cookie then
          select *
          into v_attribution
          from public.affiliate_attributions
          where visitor_key=p_visitor_key;

          v_attribution_id := v_attribution.id;
        end if;
      end if;
    end if;

    -- If alias did not establish an affiliate, use current valid attribution.
    if v_affiliate_id is null
       and v_no_affiliate_reason is null
       and p_visitor_key is not null
       and trim(p_visitor_key)<>'' then

      select * into v_attribution
      from public.affiliate_attributions
      where visitor_key=p_visitor_key
        and (
          locked_forever=true
          or expires_at is null
          or expires_at>now()
        )
      limit 1;

      if found then
        select * into v_affiliate
        from public.affiliates
        where id=v_attribution.affiliate_id
          and status='active';

        if found then
          if v_settings.prevent_self_referral
             and p_buyer_user_id is not null
             and p_buyer_user_id=v_affiliate.user_id then
            v_no_affiliate_reason := 'self_referral';
          else
            v_affiliate_id := v_affiliate.id;
            v_affiliate_name :=
              coalesce(v_affiliate.display_name,v_affiliate.referral_code);
            v_affiliate_referral_code := v_affiliate.referral_code;
            v_attribution_id := v_attribution.id;
            v_attribution_mode := v_settings.attribution_mode;
          end if;
        end if;
      end if;
    end if;

    if v_affiliate_id is null and v_no_affiliate_reason is null then
      v_no_affiliate_reason := 'no_valid_affiliate';
    end if;
  end if;

  -- Allocate coupon discount proportionally only across eligible lines.
  v_remaining_discount := v_discount;
  v_remaining_eligible := v_eligible_subtotal;

  select coalesce(jsonb_agg(
    item ||
    jsonb_build_object(
      'line_discount',
      case
        when not (item->>'coupon_eligible')::boolean then 0
        when v_discount <= 0 then 0
        when v_remaining_eligible <= 0 then 0
        else round(
          ((item->>'line_subtotal')::numeric / v_eligible_subtotal)
          * v_discount,
          2
        )
      end
    )
  ), '[]'::jsonb)
  into v_items_out
  from jsonb_array_elements(v_items_out) item;

  -- Correct rounding on the final eligible line so total line discounts
  -- exactly equal order discount.
  if v_discount > 0 then
    declare
      v_sum_line_discount numeric(18,2);
      v_diff numeric(18,2);
      v_last_index integer;
    begin
      select coalesce(sum((x->>'line_discount')::numeric),0)
      into v_sum_line_discount
      from jsonb_array_elements(v_items_out) x;

      v_diff := v_discount - v_sum_line_discount;

      if v_diff <> 0 then
        select max(ord::integer)-1
        into v_last_index
        from jsonb_array_elements(v_items_out) with ordinality t(x,ord)
        where (x->>'coupon_eligible')::boolean;

        v_items_out :=
          jsonb_set(
            v_items_out,
            array[v_last_index::text],
            (v_items_out->v_last_index) ||
            jsonb_build_object(
              'line_discount',
              ((v_items_out->v_last_index->>'line_discount')::numeric + v_diff)
            )
          );
      end if;
    end;
  end if;

  -- Add final line totals.
  select coalesce(jsonb_agg(
    item ||
    jsonb_build_object(
      'line_total',
      (item->>'line_subtotal')::numeric
      - (item->>'line_discount')::numeric
    )
  ), '[]'::jsonb)
  into v_items_out
  from jsonb_array_elements(v_items_out) item;

  return jsonb_build_object(
    'currency','IDR',
    'subtotal',v_subtotal,
    'discount_amount',v_discount,
    'total_amount',v_total,

    'coupon',
      case when v_coupon.id is null then null else
        jsonb_build_object(
          'id',v_coupon.id,
          'code',
            case
              when v_alias.id is not null then v_alias.alias_code
              else v_coupon.code
            end,
          'parent_code',v_coupon.code,
          'kind',v_coupon.kind,
          'discount_type',v_coupon.discount_type,
          'discount_value',v_coupon.discount_value,
          'affiliate_alias_id',v_alias.id,
          'force_no_affiliate',v_coupon.force_no_affiliate
        )
      end,

    'affiliate',
      case when v_affiliate_id is null then null else
        jsonb_build_object(
          'id',v_affiliate_id,
          'name',v_affiliate_name,
          'referral_code',v_affiliate_referral_code,
          'attribution_id',v_attribution_id,
          'attribution_mode',v_attribution_mode
        )
      end,

    'no_affiliate_reason',v_no_affiliate_reason,
    'items',v_items_out
  );
end;
$$;

revoke all on function public.checkout_quote_internal(jsonb,text,text,uuid)
from public;

-- ------------------------------------------------------------
-- 19.9 PUBLIC CHECKOUT QUOTE
-- Safe preview for checkout UI.
-- Does not create an order or consume coupon usage.
-- ------------------------------------------------------------

create or replace function public.get_checkout_quote(
  p_items jsonb,
  p_coupon_code text default null,
  p_visitor_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_quote jsonb;
begin
  v_quote := public.checkout_quote_internal(
    p_items,
    p_coupon_code,
    p_visitor_key,
    auth.uid()
  );

  -- Public result intentionally contains only checkout-safe fields.
  return v_quote;
end;
$$;

revoke all on function public.get_checkout_quote(jsonb,text,text) from public;
grant execute on function public.get_checkout_quote(jsonb,text,text)
to anon, authenticated;

-- ------------------------------------------------------------
-- 19.10 CREATE CHECKOUT ORDER
--
-- Idempotency:
-- same idempotency key returns the existing order instead of creating
-- duplicate orders when buyer double-clicks or network retries.
--
-- Coupon limit is rechecked inside the same transaction.
-- ------------------------------------------------------------

create or replace function public.create_checkout_order(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_customer_note text default null,
  p_idempotency_key text default null
)
returns table (
  order_id uuid,
  order_number text,
  subtotal numeric,
  discount_amount numeric,
  total_amount numeric,
  currency text,
  affiliate_name text,
  coupon_code text,
  order_status public.commerce_order_status,
  payment_status public.commerce_payment_status
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_order public.orders%rowtype;
  v_item jsonb;

  v_coupon_id uuid;
  v_alias_id uuid;
  v_affiliate_id uuid;
  v_attribution_id uuid;

  v_key text := trim(coalesce(p_idempotency_key,''));
  v_email text := lower(trim(coalesce(p_buyer_email,'')));
  v_name text := trim(coalesce(p_buyer_name,''));
  v_phone text := nullif(trim(coalesce(p_buyer_phone,'')),'');
  v_customer_key text;
begin
  if v_name='' or length(v_name)>150 then
    raise exception 'Valid buyer name is required';
  end if;

  if v_email=''
     or length(v_email)>254
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Valid buyer email is required';
  end if;

  if v_phone is not null and length(v_phone)>50 then
    raise exception 'Buyer phone is too long';
  end if;

  if length(coalesce(p_customer_note,''))>2000 then
    raise exception 'Customer note is too long';
  end if;

  if v_key='' then
    v_key := replace(gen_random_uuid()::text,'-','');
  elsif length(v_key)>200 then
    raise exception 'Idempotency key is too long';
  end if;

  -- Return existing order for retry/double click.
  select *
  into v_order
  from public.orders
  where idempotency_key=v_key;

  if found then
    return query
    select
      v_order.id,
      v_order.order_number,
      v_order.subtotal,
      v_order.discount_amount,
      v_order.total_amount,
      v_order.currency,
      v_order.affiliate_name_snapshot,
      v_order.coupon_code_snapshot,
      v_order.status,
      v_order.payment_status;
    return;
  end if;

  -- Serialize coupon checkout creation when a coupon is supplied.
  -- This prevents concurrent requests from overshooting usage_limit.
  if trim(coalesce(p_coupon_code,''))<>'' then
    perform pg_advisory_xact_lock(
      hashtext('imerssupa-coupon:' || upper(trim(p_coupon_code)))
    );
  end if;

  -- Explicit alias coupon attribution is applied before final quote.
  if trim(coalesce(p_coupon_code,''))<>''
     and p_visitor_key is not null
     and trim(p_visitor_key)<>'' then
    perform *
    from public.apply_affiliate_alias_attribution(
      p_coupon_code,
      p_visitor_key
    );
  end if;

  v_quote := public.checkout_quote_internal(
    p_items,
    p_coupon_code,
    p_visitor_key,
    v_uid
  );

  v_coupon_id := nullif(v_quote#>>'{coupon,id}','')::uuid;
  v_alias_id := nullif(v_quote#>>'{coupon,affiliate_alias_id}','')::uuid;
  v_affiliate_id := nullif(v_quote#>>'{affiliate,id}','')::uuid;
  v_attribution_id := nullif(v_quote#>>'{affiliate,attribution_id}','')::uuid;

  insert into public.orders (
    order_number,
    idempotency_key,
    buyer_user_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    currency,
    subtotal,
    discount_amount,
    total_amount,
    coupon_id,
    coupon_code_snapshot,
    coupon_kind_snapshot,
    affiliate_alias_id,
    affiliate_id,
    affiliate_name_snapshot,
    affiliate_referral_code_snapshot,
    attribution_id,
    attribution_mode_snapshot,
    affiliate_eligible_snapshot,
    no_affiliate_reason,
    status,
    payment_status,
    customer_note
  )
  values (
    public.generate_order_number(),
    v_key,
    v_uid,
    v_name,
    v_email,
    v_phone,
    v_quote->>'currency',
    (v_quote->>'subtotal')::numeric,
    (v_quote->>'discount_amount')::numeric,
    (v_quote->>'total_amount')::numeric,
    v_coupon_id,
    v_quote#>>'{coupon,code}',
    nullif(v_quote#>>'{coupon,kind}','')::public.coupon_kind,
    v_alias_id,
    v_affiliate_id,
    v_quote#>>'{affiliate,name}',
    v_quote#>>'{affiliate,referral_code}',
    v_attribution_id,
    nullif(v_quote#>>'{affiliate,attribution_mode}','')::public.affiliate_attribution_mode,
    v_affiliate_id is not null,
    v_quote->>'no_affiliate_reason',
    'pending',
    'unpaid',
    nullif(trim(coalesce(p_customer_note,'')),'')
  )
  returning * into v_order;

  -- Immutable order item snapshots.
  for v_item in
    select value from jsonb_array_elements(v_quote->'items')
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      product_slug_snapshot,
      quantity,
      unit_price,
      line_subtotal,
      line_discount,
      line_total,
      coupon_eligible_snapshot,
      affiliate_eligible_snapshot,
      commission_percent_snapshot
    )
    values (
      v_order.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'product_slug',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_subtotal')::numeric,
      (v_item->>'line_discount')::numeric,
      (v_item->>'line_total')::numeric,
      (v_item->>'coupon_eligible')::boolean,
      (v_item->>'affiliate_eligible')::boolean,
      nullif(v_item->>'commission_percent','')::numeric
    );
  end loop;

  -- Reserve coupon usage for this order.
  if v_coupon_id is not null then
    v_customer_key :=
      case
        when v_uid is not null then 'user:' || v_uid::text
        else 'email:' || v_email
      end;

    -- For anonymous checkout, enforce per-customer usage by normalized email.
    if (
      select usage_limit_per_customer
      from public.coupons
      where id=v_coupon_id
    ) is not null then
      if (
        select count(*)
        from public.coupon_redemptions cr
        where cr.coupon_id=v_coupon_id
          and cr.customer_key=v_customer_key
          and cr.status in ('reserved','consumed')
      ) >= (
        select usage_limit_per_customer
        from public.coupons
        where id=v_coupon_id
      ) then
        raise exception 'Customer coupon usage limit reached';
      end if;
    end if;

    insert into public.coupon_redemptions (
      coupon_id,
      affiliate_alias_id,
      commerce_order_id,
      user_id,
      customer_key,
      discount_amount,
      status
    )
    values (
      v_coupon_id,
      v_alias_id,
      v_order.id,
      v_uid,
      v_customer_key,
      v_order.discount_amount,
      'reserved'
    );
  end if;

  return query
  select
    v_order.id,
    v_order.order_number,
    v_order.subtotal,
    v_order.discount_amount,
    v_order.total_amount,
    v_order.currency,
    v_order.affiliate_name_snapshot,
    v_order.coupon_code_snapshot,
    v_order.status,
    v_order.payment_status;
end;
$$;

revoke all on function public.create_checkout_order(
  jsonb,text,text,text,text,text,text,text
) from public;

grant execute on function public.create_checkout_order(
  jsonb,text,text,text,text,text,text,text
) to anon, authenticated;

-- ------------------------------------------------------------
-- 19.11 GET ONE ORDER SAFELY
-- Authenticated buyer owns by user_id.
-- Anonymous checkout can use order id + normalized email.
-- Admin can read any order.
-- ------------------------------------------------------------

create or replace function public.get_checkout_order(
  p_order_id uuid,
  p_buyer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_allowed boolean := false;
begin
  select * into v_order
  from public.orders
  where id=p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if public.is_imerssupa_admin() then
    v_allowed := true;
  elsif auth.uid() is not null and v_order.buyer_user_id=auth.uid() then
    v_allowed := true;
  elsif auth.uid() is null
        and p_buyer_email is not null
        and lower(trim(p_buyer_email))=lower(v_order.buyer_email) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Order access denied';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',oi.id,
      'product_id',oi.product_id,
      'product_name',oi.product_name_snapshot,
      'product_slug',oi.product_slug_snapshot,
      'quantity',oi.quantity,
      'unit_price',oi.unit_price,
      'line_subtotal',oi.line_subtotal,
      'line_discount',oi.line_discount,
      'line_total',oi.line_total
    )
    order by oi.created_at,oi.id
  ),'[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id=v_order.id;

  return jsonb_build_object(
    'id',v_order.id,
    'order_number',v_order.order_number,
    'buyer_name',v_order.buyer_name,
    'buyer_email',v_order.buyer_email,
    'buyer_phone',v_order.buyer_phone,
    'currency',v_order.currency,
    'subtotal',v_order.subtotal,
    'discount_amount',v_order.discount_amount,
    'total_amount',v_order.total_amount,
    'coupon_code',v_order.coupon_code_snapshot,
    'affiliate_name',v_order.affiliate_name_snapshot,
    'affiliate_referral_code',v_order.affiliate_referral_code_snapshot,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'created_at',v_order.created_at,
    'expires_at',v_order.expires_at,
    'items',v_items
  );
end;
$$;

revoke all on function public.get_checkout_order(uuid,text) from public;
grant execute on function public.get_checkout_order(uuid,text)
to anon, authenticated;

-- ------------------------------------------------------------
-- 19.12 RLS
-- Direct checkout writes are forbidden.
-- Creation happens only through create_checkout_order().
-- ------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_admin_read" on public.orders;
drop policy if exists "orders_buyer_read" on public.orders;
drop policy if exists "order_items_admin_read" on public.order_items;
drop policy if exists "order_items_buyer_read" on public.order_items;

create policy "orders_admin_read"
on public.orders
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "orders_buyer_read"
on public.orders
for select
to authenticated
using (buyer_user_id=auth.uid());

create policy "order_items_admin_read"
on public.order_items
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "order_items_buyer_read"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id=order_items.order_id
      and o.buyer_user_id=auth.uid()
  )
);

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- coupon_redemptions remains RLS-protected from STEP 17.
-- No direct checkout mutation grant is added.

-- ------------------------------------------------------------
-- 19.13 ADMIN ORDER SUMMARY VIEW
-- ------------------------------------------------------------

create or replace view public.admin_order_summary
with (security_invoker=true)
as
select
  count(*)::bigint as total_orders,
  count(*) filter (where status in ('pending','awaiting_payment'))::bigint
    as open_orders,
  count(*) filter (where payment_status='paid')::bigint
    as paid_orders,
  count(*) filter (where status='completed')::bigint
    as completed_orders,
  count(*) filter (where status='cancelled')::bigint
    as cancelled_orders,
  count(*) filter (where status='refunded')::bigint
    as refunded_orders,
  coalesce(sum(total_amount) filter (where payment_status='paid'),0)::numeric(18,2)
    as paid_revenue
from public.orders
where public.is_imerssupa_admin();

grant select on public.admin_order_summary to authenticated;

-- ------------------------------------------------------------
-- 19.14 FINAL STATIC DATABASE CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'STEP 19 failed: orders missing';
  end if;

  if to_regclass('public.order_items') is null then
    raise exception 'STEP 19 failed: order_items missing';
  end if;

  if to_regprocedure('public.get_checkout_quote(jsonb,text,text)') is null then
    raise exception 'STEP 19 failed: get_checkout_quote missing';
  end if;

  if to_regprocedure(
    'public.create_checkout_order(jsonb,text,text,text,text,text,text,text)'
  ) is null then
    raise exception 'STEP 19 failed: create_checkout_order missing';
  end if;

  if to_regprocedure('public.get_checkout_order(uuid,text)') is null then
    raise exception 'STEP 19 failed: get_checkout_order missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 19 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 19 Checkout & Order Core
--
-- NEXT:
-- iMersSUPA - 20 Payment Engine
-- ============================================================


-- ===== SOURCE STEP 20: 20-payment-engine.sql =====
-- ============================================================
-- iMersSUPA - 20 Payment Engine
-- Requires: STEP 19 Checkout & Order Core
--
-- Scope:
-- - Dynamic payment methods (manual bank / e-wallet / static QRIS / gateway)
-- - Public-safe payment method listing
-- - Payment attempts/transactions per order
-- - Manual payment proof submission
-- - Admin verification/rejection
-- - Gateway-ready provider/reference fields
-- - Order payment state synchronization
-- - Expiry handling
-- - No hardcoded bank/provider/payment credential
--
-- IMPORTANT:
-- Product delivery, member_access and affiliate commission settlement
-- are intentionally handled in STEP 21.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 20.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regprocedure('public.is_imerssupa_admin()') is null then
    raise exception 'STEP 20 requires STEP 19 Checkout & Order Core';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 20.2 ENUMS
-- ------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname='payment_method_type') then
    create type public.payment_method_type as enum (
      'bank_transfer',
      'ewallet',
      'qris_static',
      'payment_gateway'
    );
  end if;

  if not exists (select 1 from pg_type where typname='payment_transaction_status') then
    create type public.payment_transaction_status as enum (
      'pending',
      'waiting_verification',
      'paid',
      'rejected',
      'failed',
      'cancelled',
      'expired',
      'refunded'
    );
  end if;
end
$$;

-- ------------------------------------------------------------
-- 20.3 PAYMENT METHODS
--
-- config_private is NEVER exposed by public RPCs.
-- It is reserved for future gateway credentials/configuration.
-- ------------------------------------------------------------

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  code text not null unique,
  type public.payment_method_type not null,

  description text,
  instructions text,

  account_name text,
  account_number text,
  qris_image_url text,

  provider_name text,
  config_private jsonb not null default '{}'::jsonb,

  fee_fixed numeric(18,2) not null default 0 check (fee_fixed >= 0),
  fee_percent numeric(7,4) not null default 0
    check (fee_percent >= 0 and fee_percent <= 100),

  min_amount numeric(18,2) check (min_amount is null or min_amount >= 0),
  max_amount numeric(18,2) check (max_amount is null or max_amount >= 0),

  sort_order integer not null default 0,
  active boolean not null default true,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_methods_code_format
    check (
      code = upper(code)
      and code ~ '^[A-Z0-9_-]{2,50}$'
    ),

  constraint payment_methods_amount_range
    check (
      min_amount is null
      or max_amount is null
      or max_amount >= min_amount
    )
);

create index if not exists payment_methods_active_sort_idx
  on public.payment_methods(active, sort_order, name);

-- ------------------------------------------------------------
-- 20.4 PAYMENT TRANSACTIONS / ATTEMPTS
--
-- One order can have multiple attempts, but only one PAID attempt.
-- amount_due is snapshotted when the method is selected.
-- ------------------------------------------------------------

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id) on delete cascade,

  payment_method_id uuid
    references public.payment_methods(id) on delete set null,

  payment_method_name_snapshot text not null,
  payment_method_code_snapshot text not null,
  payment_method_type_snapshot public.payment_method_type not null,

  base_amount numeric(18,2) not null check (base_amount >= 0),
  fee_amount numeric(18,2) not null default 0 check (fee_amount >= 0),
  amount_due numeric(18,2) not null check (amount_due >= 0),

  status public.payment_transaction_status not null default 'pending',

  provider_name text,
  provider_reference text,
  provider_payload jsonb not null default '{}'::jsonb,

  proof_url text,
  payer_name text,
  payer_account text,
  payer_note text,

  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,

  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_transactions_amount_math
    check (amount_due = base_amount + fee_amount)
);

create index if not exists payment_transactions_order_created_idx
  on public.payment_transactions(order_id, created_at desc);

create index if not exists payment_transactions_status_created_idx
  on public.payment_transactions(status, created_at desc);

create unique index if not exists payment_transactions_one_paid_per_order_uidx
  on public.payment_transactions(order_id)
  where status='paid';

create unique index if not exists payment_transactions_provider_reference_uidx
  on public.payment_transactions(provider_name, provider_reference)
  where provider_reference is not null;

-- ------------------------------------------------------------
-- 20.5 ORDER PAYMENT METHOD SNAPSHOT
-- Extend existing canonical order, do not recreate it.
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists selected_payment_method_id uuid
    references public.payment_methods(id) on delete set null;

alter table public.orders
  add column if not exists payment_fee numeric(18,2)
    not null default 0 check (payment_fee >= 0);

alter table public.orders
  add column if not exists grand_total numeric(18,2);

update public.orders
set grand_total = total_amount + payment_fee
where grand_total is null;

alter table public.orders
  alter column grand_total set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='orders_grand_total_math'
      and conrelid='public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_grand_total_math
      check (grand_total = total_amount + payment_fee);
  end if;
end
$$;

-- ------------------------------------------------------------
-- 20.6 UPDATED_AT
-- ------------------------------------------------------------

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_transactions_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 20.7 NORMALIZE PAYMENT METHOD
-- ------------------------------------------------------------

create or replace function public.normalize_payment_method()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  new.name := trim(new.name);

  if new.name='' then
    raise exception 'Payment method name is required';
  end if;

  if new.type='bank_transfer'
     and (
       nullif(trim(coalesce(new.account_name,'')),'') is null
       or nullif(trim(coalesce(new.account_number,'')),'') is null
     ) then
    raise exception 'Bank transfer requires account name and account number';
  end if;

  if new.type='qris_static'
     and nullif(trim(coalesce(new.qris_image_url,'')),'') is null then
    raise exception 'Static QRIS requires QRIS image URL';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_payment_method on public.payment_methods;
create trigger trg_normalize_payment_method
before insert or update on public.payment_methods
for each row execute function public.normalize_payment_method();

-- ------------------------------------------------------------
-- 20.8 RLS
-- ------------------------------------------------------------

alter table public.payment_methods enable row level security;
alter table public.payment_transactions enable row level security;

drop policy if exists "payment_methods_admin_read" on public.payment_methods;
drop policy if exists "payment_transactions_admin_read" on public.payment_transactions;
drop policy if exists "payment_transactions_buyer_read" on public.payment_transactions;

create policy "payment_methods_admin_read"
on public.payment_methods
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "payment_transactions_admin_read"
on public.payment_transactions
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "payment_transactions_buyer_read"
on public.payment_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id=payment_transactions.order_id
      and o.buyer_user_id=auth.uid()
  )
);

revoke all on public.payment_methods from anon, authenticated;
revoke all on public.payment_transactions from anon, authenticated;

grant select on public.payment_methods to authenticated;
grant select on public.payment_transactions to authenticated;

-- ------------------------------------------------------------
-- 20.9 PUBLIC SAFE PAYMENT METHOD LIST
-- Never returns config_private.
-- ------------------------------------------------------------

create or replace function public.get_available_payment_methods(
  p_order_id uuid
)
returns table (
  payment_method_id uuid,
  name text,
  code text,
  type public.payment_method_type,
  description text,
  instructions text,
  account_name text,
  account_number text,
  qris_image_url text,
  provider_name text,
  fee_amount numeric,
  amount_due numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id=p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('cancelled','expired','refunded','completed')
     or v_order.payment_status in ('paid','cancelled','expired','refunded') then
    return;
  end if;

  return query
  select
    pm.id,
    pm.name,
    pm.code,
    pm.type,
    pm.description,
    pm.instructions,
    pm.account_name,
    pm.account_number,
    pm.qris_image_url,
    pm.provider_name,
    round(pm.fee_fixed + (v_order.total_amount * pm.fee_percent / 100.0),2),
    v_order.total_amount
      + round(pm.fee_fixed + (v_order.total_amount * pm.fee_percent / 100.0),2)
  from public.payment_methods pm
  where pm.active=true
    and (pm.min_amount is null or v_order.total_amount >= pm.min_amount)
    and (pm.max_amount is null or v_order.total_amount <= pm.max_amount)
  order by pm.sort_order, pm.name;
end;
$$;

revoke all on function public.get_available_payment_methods(uuid) from public;
grant execute on function public.get_available_payment_methods(uuid)
to anon, authenticated;

-- ------------------------------------------------------------
-- 20.10 SELECT PAYMENT METHOD / CREATE ATTEMPT
-- No client-supplied amount or fee.
-- ------------------------------------------------------------

create or replace function public.select_order_payment_method(
  p_order_id uuid,
  p_payment_method_id uuid
)
returns table (
  payment_transaction_id uuid,
  payment_method_name text,
  payment_method_type public.payment_method_type,
  base_amount numeric,
  fee_amount numeric,
  amount_due numeric,
  payment_status public.commerce_payment_status
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_transaction public.payment_transactions%rowtype;
  v_fee numeric(18,2);
begin
  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  -- Anonymous orders are selected through the checkout flow; authenticated
  -- buyers may only mutate their own order. Admin is also allowed.
  if auth.uid() is not null
     and not public.is_imerssupa_admin()
     and v_order.buyer_user_id is distinct from auth.uid() then
    raise exception 'Order access denied';
  end if;

  if v_order.status in ('cancelled','expired','refunded','completed')
     or v_order.payment_status='paid' then
    raise exception 'Order cannot accept a new payment method';
  end if;

  select * into v_method
  from public.payment_methods
  where id=p_payment_method_id
    and active=true;

  if not found then raise exception 'Payment method unavailable'; end if;

  if v_method.min_amount is not null
     and v_order.total_amount < v_method.min_amount then
    raise exception 'Order amount is below payment method minimum';
  end if;

  if v_method.max_amount is not null
     and v_order.total_amount > v_method.max_amount then
    raise exception 'Order amount exceeds payment method maximum';
  end if;

  v_fee := round(
    v_method.fee_fixed + (v_order.total_amount * v_method.fee_percent / 100.0),
    2
  );

  -- Cancel old unpaid attempt(s) before creating the new selection.
  update public.payment_transactions
  set status='cancelled'
  where order_id=v_order.id
    and status in ('pending','waiting_verification');

  insert into public.payment_transactions (
    order_id,
    payment_method_id,
    payment_method_name_snapshot,
    payment_method_code_snapshot,
    payment_method_type_snapshot,
    base_amount,
    fee_amount,
    amount_due,
    status,
    provider_name,
    expires_at
  )
  values (
    v_order.id,
    v_method.id,
    v_method.name,
    v_method.code,
    v_method.type,
    v_order.total_amount,
    v_fee,
    v_order.total_amount + v_fee,
    'pending',
    v_method.provider_name,
    v_order.expires_at
  )
  returning * into v_transaction;

  update public.orders
  set selected_payment_method_id=v_method.id,
      payment_fee=v_fee,
      grand_total=v_order.total_amount+v_fee,
      status='awaiting_payment',
      payment_status='pending'
  where id=v_order.id;

  return query
  select
    v_transaction.id,
    v_transaction.payment_method_name_snapshot,
    v_transaction.payment_method_type_snapshot,
    v_transaction.base_amount,
    v_transaction.fee_amount,
    v_transaction.amount_due,
    'pending'::public.commerce_payment_status;
end;
$$;

revoke all on function public.select_order_payment_method(uuid,uuid) from public;
grant execute on function public.select_order_payment_method(uuid,uuid)
to anon, authenticated;

-- ------------------------------------------------------------
-- 20.11 MANUAL PAYMENT PROOF
-- ------------------------------------------------------------

create or replace function public.submit_manual_payment_proof(
  p_payment_transaction_id uuid,
  p_proof_url text,
  p_payer_name text default null,
  p_payer_account text default null,
  p_payer_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
begin
  if nullif(trim(coalesce(p_proof_url,'')),'') is null then
    raise exception 'Payment proof URL is required';
  end if;

  if length(p_proof_url)>2000
     or length(coalesce(p_payer_name,''))>150
     or length(coalesce(p_payer_account,''))>150
     or length(coalesce(p_payer_note,''))>1000 then
    raise exception 'Payment proof value is too long';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id
  for update;

  if not found then raise exception 'Payment transaction not found'; end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id;

  if auth.uid() is not null
     and not public.is_imerssupa_admin()
     and v_order.buyer_user_id is distinct from auth.uid() then
    raise exception 'Order access denied';
  end if;

  if v_tx.payment_method_type_snapshot not in ('bank_transfer','ewallet','qris_static') then
    raise exception 'This payment method does not accept manual proof';
  end if;

  if v_tx.status not in ('pending','rejected') then
    raise exception 'Payment proof cannot be submitted for this transaction';
  end if;

  update public.payment_transactions
  set proof_url=trim(p_proof_url),
      payer_name=nullif(trim(coalesce(p_payer_name,'')),''),
      payer_account=nullif(trim(coalesce(p_payer_account,'')),''),
      payer_note=nullif(trim(coalesce(p_payer_note,'')),''),
      submitted_at=now(),
      status='waiting_verification',
      rejection_reason=null
  where id=v_tx.id;

  update public.orders
  set status='awaiting_payment',
      payment_status='pending'
  where id=v_order.id;
end;
$$;

revoke all on function public.submit_manual_payment_proof(uuid,text,text,text,text)
from public;
grant execute on function public.submit_manual_payment_proof(uuid,text,text,text,text)
to anon, authenticated;

-- ------------------------------------------------------------
-- 20.12 ADMIN CREATE / UPDATE PAYMENT METHOD
-- ------------------------------------------------------------

create or replace function public.admin_upsert_payment_method(
  p_id uuid,
  p_name text,
  p_code text,
  p_type public.payment_method_type,
  p_description text default null,
  p_instructions text default null,
  p_account_name text default null,
  p_account_number text default null,
  p_qris_image_url text default null,
  p_provider_name text default null,
  p_config_private jsonb default '{}'::jsonb,
  p_fee_fixed numeric default 0,
  p_fee_percent numeric default 0,
  p_min_amount numeric default null,
  p_max_amount numeric default null,
  p_sort_order integer default 0,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if p_fee_fixed<0 or p_fee_percent<0 or p_fee_percent>100 then
    raise exception 'Invalid payment fee';
  end if;

  if p_min_amount is not null and p_min_amount<0 then
    raise exception 'Invalid minimum amount';
  end if;

  if p_max_amount is not null and p_max_amount<0 then
    raise exception 'Invalid maximum amount';
  end if;

  if p_min_amount is not null and p_max_amount is not null
     and p_max_amount<p_min_amount then
    raise exception 'Maximum amount must be >= minimum amount';
  end if;

  if p_id is null then
    insert into public.payment_methods (
      name,code,type,description,instructions,
      account_name,account_number,qris_image_url,
      provider_name,config_private,
      fee_fixed,fee_percent,min_amount,max_amount,
      sort_order,active,created_by
    )
    values (
      p_name,upper(trim(p_code)),p_type,p_description,p_instructions,
      p_account_name,p_account_number,p_qris_image_url,
      p_provider_name,coalesce(p_config_private,'{}'::jsonb),
      p_fee_fixed,p_fee_percent,p_min_amount,p_max_amount,
      p_sort_order,p_active,auth.uid()
    )
    returning id into v_id;
  else
    update public.payment_methods
    set name=p_name,
        code=upper(trim(p_code)),
        type=p_type,
        description=p_description,
        instructions=p_instructions,
        account_name=p_account_name,
        account_number=p_account_number,
        qris_image_url=p_qris_image_url,
        provider_name=p_provider_name,
        config_private=coalesce(p_config_private,'{}'::jsonb),
        fee_fixed=p_fee_fixed,
        fee_percent=p_fee_percent,
        min_amount=p_min_amount,
        max_amount=p_max_amount,
        sort_order=p_sort_order,
        active=p_active
    where id=p_id
    returning id into v_id;

    if v_id is null then raise exception 'Payment method not found'; end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_payment_method(
  uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,
  numeric,numeric,numeric,numeric,integer,boolean
) from public;

grant execute on function public.admin_upsert_payment_method(
  uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,
  numeric,numeric,numeric,numeric,integer,boolean
) to authenticated;

create or replace function public.admin_set_payment_method_status(
  p_payment_method_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  update public.payment_methods
  set active=p_active
  where id=p_payment_method_id;

  if not found then raise exception 'Payment method not found'; end if;
end;
$$;

revoke all on function public.admin_set_payment_method_status(uuid,boolean)
from public;
grant execute on function public.admin_set_payment_method_status(uuid,boolean)
to authenticated;

-- ------------------------------------------------------------
-- 20.13 ADMIN VERIFY / REJECT MANUAL PAYMENT
--
-- STEP 20 only changes payment/order state.
-- STEP 21 will add the idempotent settlement trigger/function that
-- grants member access and creates affiliate commission.
-- ------------------------------------------------------------

create or replace function public.admin_review_manual_payment(
  p_payment_transaction_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id
  for update;

  if not found then raise exception 'Payment transaction not found'; end if;

  if v_tx.status<>'waiting_verification' then
    raise exception 'Payment is not waiting for verification';
  end if;

  if p_approve then
    if exists (
      select 1 from public.payment_transactions x
      where x.order_id=v_tx.order_id
        and x.status='paid'
        and x.id<>v_tx.id
    ) then
      raise exception 'Order already has a paid payment transaction';
    end if;

    update public.payment_transactions
    set status='paid',
        verified_at=now(),
        verified_by=auth.uid(),
        rejection_reason=null
    where id=v_tx.id;

    update public.orders
    set payment_status='paid',
        status='paid',
        paid_at=coalesce(paid_at,now())
    where id=v_tx.order_id;
  else
    update public.payment_transactions
    set status='rejected',
        verified_at=now(),
        verified_by=auth.uid(),
        rejection_reason=nullif(trim(coalesce(p_note,'')),'')
    where id=v_tx.id;

    update public.orders
    set payment_status='unpaid',
        status='awaiting_payment'
    where id=v_tx.order_id
      and payment_status<>'paid';
  end if;
end;
$$;

revoke all on function public.admin_review_manual_payment(uuid,boolean,text)
from public;
grant execute on function public.admin_review_manual_payment(uuid,boolean,text)
to authenticated;

-- ------------------------------------------------------------
-- 20.14 GATEWAY PAYMENT RESULT INGESTION
--
-- SECURITY:
-- NOT granted to anon/authenticated.
-- A future trusted server/Edge Function can call it with service_role.
-- It gives the database one canonical gateway settlement entry point.
-- ------------------------------------------------------------

create or replace function public.record_gateway_payment_result(
  p_payment_transaction_id uuid,
  p_provider_reference text,
  p_paid boolean,
  p_provider_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
begin
  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id
  for update;

  if not found then raise exception 'Payment transaction not found'; end if;

  if v_tx.payment_method_type_snapshot<>'payment_gateway' then
    raise exception 'Transaction is not a gateway payment';
  end if;

  if p_paid then
    if exists (
      select 1 from public.payment_transactions x
      where x.order_id=v_tx.order_id
        and x.status='paid'
        and x.id<>v_tx.id
    ) then
      raise exception 'Order already has a paid transaction';
    end if;

    update public.payment_transactions
    set status='paid',
        provider_reference=nullif(trim(p_provider_reference),''),
        provider_payload=coalesce(p_provider_payload,'{}'::jsonb),
        verified_at=now()
    where id=v_tx.id;

    update public.orders
    set payment_status='paid',
        status='paid',
        paid_at=coalesce(paid_at,now())
    where id=v_tx.order_id;
  else
    update public.payment_transactions
    set status='failed',
        provider_reference=nullif(trim(p_provider_reference),''),
        provider_payload=coalesce(p_provider_payload,'{}'::jsonb)
    where id=v_tx.id;

    update public.orders
    set payment_status='unpaid',
        status='awaiting_payment'
    where id=v_tx.order_id
      and payment_status<>'paid';
  end if;
end;
$$;

revoke all on function public.record_gateway_payment_result(uuid,text,boolean,jsonb)
from public;

-- Explicitly trusted backend only.
grant execute on function public.record_gateway_payment_result(uuid,text,boolean,jsonb)
to service_role;

-- ------------------------------------------------------------
-- 20.15 EXPIRE UNPAID ORDERS
--
-- Trusted backend/admin callable. Releases reserved coupon usage.
-- ------------------------------------------------------------

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  update public.orders
  set status='expired',
      payment_status='expired'
  where expires_at is not null
    and expires_at<=now()
    and payment_status in ('unpaid','pending')
    and status in ('pending','awaiting_payment');

  get diagnostics v_count = row_count;

  update public.payment_transactions pt
  set status='expired'
  where exists (
    select 1 from public.orders o
    where o.id=pt.order_id
      and o.status='expired'
  )
  and pt.status in ('pending','waiting_verification');

  update public.coupon_redemptions cr
  set status='released'
  where cr.status='reserved'
    and exists (
      select 1 from public.orders o
      where o.id=cr.commerce_order_id
        and o.status='expired'
    );

  return v_count;
end;
$$;

revoke all on function public.expire_unpaid_orders() from public;
grant execute on function public.expire_unpaid_orders()
to service_role;

-- Admin can manually run expiry cleanup too.
grant execute on function public.expire_unpaid_orders()
to authenticated;

-- Restrict authenticated execution to admins inside wrapper.
create or replace function public.admin_expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return public.expire_unpaid_orders();
end;
$$;

revoke execute on function public.expire_unpaid_orders() from authenticated;
revoke all on function public.admin_expire_unpaid_orders() from public;
grant execute on function public.admin_expire_unpaid_orders()
to authenticated;

-- ------------------------------------------------------------
-- 20.16 PAYMENT DETAIL RPC
-- Public checkout can render payment instructions safely.
-- config_private/provider_payload are never returned.
-- ------------------------------------------------------------

create or replace function public.get_payment_transaction(
  p_payment_transaction_id uuid,
  p_buyer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_allowed boolean:=false;
begin
  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id;

  if not found then raise exception 'Payment transaction not found'; end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id;

  if public.is_imerssupa_admin() then
    v_allowed:=true;
  elsif auth.uid() is not null and v_order.buyer_user_id=auth.uid() then
    v_allowed:=true;
  elsif auth.uid() is null
        and p_buyer_email is not null
        and lower(trim(p_buyer_email))=lower(v_order.buyer_email) then
    v_allowed:=true;
  end if;

  if not v_allowed then raise exception 'Payment access denied'; end if;

  if v_tx.payment_method_id is not null then
    select * into v_method
    from public.payment_methods
    where id=v_tx.payment_method_id;
  end if;

  return jsonb_build_object(
    'id',v_tx.id,
    'order_id',v_tx.order_id,
    'order_number',v_order.order_number,
    'payment_method_name',v_tx.payment_method_name_snapshot,
    'payment_method_code',v_tx.payment_method_code_snapshot,
    'payment_method_type',v_tx.payment_method_type_snapshot,
    'base_amount',v_tx.base_amount,
    'fee_amount',v_tx.fee_amount,
    'amount_due',v_tx.amount_due,
    'status',v_tx.status,
    'instructions',v_method.instructions,
    'account_name',v_method.account_name,
    'account_number',v_method.account_number,
    'qris_image_url',v_method.qris_image_url,
    'provider_name',v_tx.provider_name,
    'provider_reference',v_tx.provider_reference,
    'proof_url',v_tx.proof_url,
    'submitted_at',v_tx.submitted_at,
    'expires_at',v_tx.expires_at,
    'rejection_reason',v_tx.rejection_reason
  );
end;
$$;

revoke all on function public.get_payment_transaction(uuid,text) from public;
grant execute on function public.get_payment_transaction(uuid,text)
to anon, authenticated;

-- ------------------------------------------------------------
-- 20.17 ADMIN PAYMENT SUMMARY
-- ------------------------------------------------------------

create or replace view public.admin_payment_summary
with (security_invoker=true)
as
select
  count(*)::bigint as total_transactions,
  count(*) filter (where status='waiting_verification')::bigint
    as waiting_verification,
  count(*) filter (where status='paid')::bigint as paid_transactions,
  count(*) filter (where status='rejected')::bigint as rejected_transactions,
  count(*) filter (where status='failed')::bigint as failed_transactions,
  coalesce(sum(amount_due) filter (where status='paid'),0)::numeric(18,2)
    as paid_amount
from public.payment_transactions
where public.is_imerssupa_admin();

grant select on public.admin_payment_summary to authenticated;

-- ------------------------------------------------------------
-- 20.18 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.payment_methods') is null then
    raise exception 'STEP 20 failed: payment_methods missing';
  end if;

  if to_regclass('public.payment_transactions') is null then
    raise exception 'STEP 20 failed: payment_transactions missing';
  end if;

  if to_regprocedure('public.get_available_payment_methods(uuid)') is null then
    raise exception 'STEP 20 failed: get_available_payment_methods missing';
  end if;

  if to_regprocedure('public.select_order_payment_method(uuid,uuid)') is null then
    raise exception 'STEP 20 failed: select_order_payment_method missing';
  end if;

  if to_regprocedure('public.submit_manual_payment_proof(uuid,text,text,text,text)') is null then
    raise exception 'STEP 20 failed: submit_manual_payment_proof missing';
  end if;

  if to_regprocedure('public.admin_review_manual_payment(uuid,boolean,text)') is null then
    raise exception 'STEP 20 failed: admin_review_manual_payment missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 20 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 20 Payment Engine
--
-- NEXT:
-- iMersSUPA - 21 Order Settlement & Product Delivery
-- ============================================================


-- ===== SOURCE STEP 21: 21-order-settlement-product-delivery.sql =====
-- ============================================================
-- iMersSUPA - 21 Order Settlement & Product Delivery
-- Requires: STEP 17-20
--
-- Scope:
-- - Idempotent paid-order settlement
-- - Automatic member product access
-- - Coupon reservation -> consumed
-- - Affiliate commission creation from immutable order-item snapshots
-- - Automatic settlement when order becomes PAID
-- - Manual/trusted settlement RPC
-- - Settlement audit trail
--
-- IMPORTANT:
-- Refund/cancel/reversal is handled in STEP 22.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 21.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.member_access') is null
     or to_regclass('public.affiliate_commissions') is null
     or to_regclass('public.coupon_redemptions') is null then
    raise exception 'STEP 21 requires STEP 17-20 and member_access';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 21.2 SETTLEMENT AUDIT
-- ------------------------------------------------------------

create table if not exists public.order_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique
    references public.orders(id) on delete cascade,

  payment_transaction_id uuid
    references public.payment_transactions(id) on delete set null,

  access_grants_count integer not null default 0 check (access_grants_count >= 0),
  commissions_count integer not null default 0 check (commissions_count >= 0),
  commission_total numeric(18,2) not null default 0 check (commission_total >= 0),

  settled_at timestamptz not null default now(),
  settled_by uuid references public.profiles(id) on delete set null,
  settlement_source text not null default 'automatic',

  created_at timestamptz not null default now()
);

create index if not exists order_settlements_settled_at_idx
  on public.order_settlements(settled_at desc);

-- ------------------------------------------------------------
-- 21.3 LINK AFFILIATE COMMISSIONS TO CANONICAL ORDER/ITEM
-- Existing STEP 17 table is extended rather than recreated.
-- ------------------------------------------------------------

alter table public.affiliate_commissions
  add column if not exists commerce_order_id uuid
    references public.orders(id) on delete set null;

alter table public.affiliate_commissions
  add column if not exists commerce_order_item_id uuid
    references public.order_items(id) on delete set null;

create unique index if not exists affiliate_commissions_order_item_uidx
  on public.affiliate_commissions(commerce_order_item_id)
  where commerce_order_item_id is not null;

create index if not exists affiliate_commissions_commerce_order_idx
  on public.affiliate_commissions(commerce_order_id);

-- ------------------------------------------------------------
-- 21.4 MEMBER ACCESS COMPATIBILITY HELPER
--
-- Earlier iMersSUPA schema already owns member_access.
-- We inspect its real columns dynamically so STEP 21 does not replace
-- or hardcode a second entitlement table.
-- Required semantic columns: user_id + product_id.
-- Optional existing columns are filled when present.
-- ------------------------------------------------------------

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
  v_has_expires boolean;
  v_has_created boolean;
  v_has_updated boolean;
  v_exists boolean;
  v_sql text;
begin
  if p_user_id is null then
    raise exception 'Paid product delivery requires a member user_id';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='member_access'
      and column_name='user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='member_access'
      and column_name='product_id'
  ) then
    raise exception 'member_access must contain user_id and product_id';
  end if;

  select exists(
    select 1 from public.member_access
    where user_id=p_user_id and product_id=p_product_id
  ) into v_exists;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='member_access' and column_name='status'
  ) into v_has_status;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='member_access' and column_name='expires_at'
  ) into v_has_expires;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='member_access' and column_name='created_at'
  ) into v_has_created;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='member_access' and column_name='updated_at'
  ) into v_has_updated;

  if v_exists then
    -- Preserve lifetime/longer access. Reactivate when schema has status.
    if v_has_status then
      execute format(
        'update public.member_access
         set status=%L%s
         where user_id=$1 and product_id=$2',
        'active',
        case when v_has_updated then ', updated_at=now()' else '' end
      )
      using p_user_id,p_product_id;
    end if;
    return false;
  end if;

  -- Build insert against the existing entitlement schema.
  v_sql := 'insert into public.member_access (user_id,product_id';
  if v_has_status then v_sql := v_sql || ',status'; end if;
  if v_has_expires then v_sql := v_sql || ',expires_at'; end if;
  if v_has_created then v_sql := v_sql || ',created_at'; end if;
  if v_has_updated then v_sql := v_sql || ',updated_at'; end if;

  v_sql := v_sql || ') values ($1,$2';
  if v_has_status then v_sql := v_sql || ',' || quote_literal('active'); end if;
  if v_has_expires then v_sql := v_sql || ',null'; end if;
  if v_has_created then v_sql := v_sql || ',now()'; end if;
  if v_has_updated then v_sql := v_sql || ',now()'; end if;
  v_sql := v_sql || ')';

  execute v_sql using p_user_id,p_product_id;
  return true;
end;
$$;

revoke all on function public.grant_paid_product_access(uuid,uuid,uuid) from public;

-- ------------------------------------------------------------
-- 21.5 COMMISSION INSERT COMPATIBILITY
--
-- STEP 17 already created affiliate_commissions. This function writes
-- using the known STEP 17 semantic fields while detecting optional names.
-- ------------------------------------------------------------

create or replace function public.create_order_item_commission(
  p_order public.orders,
  p_item public.order_items
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_amount numeric(18,2);
  v_base numeric(18,2);
  v_sql text;
  v_cols text := '';
  v_vals text := '';
  v_has_order_id boolean;
  v_has_order_item_id boolean;
begin
  if p_order.affiliate_id is null
     or not p_order.affiliate_eligible_snapshot
     or not p_item.affiliate_eligible_snapshot
     or p_item.commission_percent_snapshot is null
     or p_item.commission_percent_snapshot <= 0 then
    return false;
  end if;

  if exists (
    select 1
    from public.affiliate_commissions
    where commerce_order_item_id=p_item.id
  ) then
    return false;
  end if;

  -- Commission base is the item's net paid value after coupon allocation.
  v_base := p_item.line_total;
  v_amount := round(
    v_base * p_item.commission_percent_snapshot / 100.0,
    2
  );

  if v_amount <= 0 then
    return false;
  end if;

  -- Core STEP 17 columns must exist.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='affiliate_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='status'
  ) then
    raise exception 'affiliate_commissions STEP 17 schema is incompatible';
  end if;

  -- Build dynamically to remain compatible with the exact STEP 17 column
  -- naming for monetary fields.
  v_cols := 'affiliate_id,status,commerce_order_id,commerce_order_item_id';
  v_vals := '$1,''pending'',$2,$3';

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='commission_amount'
  ) then
    v_cols := v_cols || ',commission_amount';
    v_vals := v_vals || ',$4';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='amount'
  ) then
    v_cols := v_cols || ',amount';
    v_vals := v_vals || ',$4';
  else
    raise exception 'affiliate_commissions requires amount/commission_amount';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='commission_percent'
  ) then
    v_cols := v_cols || ',commission_percent';
    v_vals := v_vals || ',$5';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='base_amount'
  ) then
    v_cols := v_cols || ',base_amount';
    v_vals := v_vals || ',$6';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='product_id'
  ) then
    v_cols := v_cols || ',product_id';
    v_vals := v_vals || ',$7';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='order_id'
  ) then
    v_cols := v_cols || ',order_id';
    v_vals := v_vals || ',$8';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='affiliate_commissions'
      and column_name='created_at'
  ) then
    v_cols := v_cols || ',created_at';
    v_vals := v_vals || ',now()';
  end if;

  v_sql := format(
    'insert into public.affiliate_commissions (%s) values (%s)',
    v_cols,v_vals
  );

  execute v_sql using
    p_order.affiliate_id,
    p_order.id,
    p_item.id,
    v_amount,
    p_item.commission_percent_snapshot,
    v_base,
    p_item.product_id,
    p_order.id;

  return true;
end;
$$;

revoke all on function public.create_order_item_commission(
  public.orders,public.order_items
) from public;

-- ------------------------------------------------------------
-- 21.6 CANONICAL IDEMPOTENT SETTLEMENT
-- ------------------------------------------------------------

create or replace function public.settle_paid_order(
  p_order_id uuid,
  p_source text default 'automatic'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_paid_tx uuid;
  v_access_count integer := 0;
  v_commission_count integer := 0;
  v_commission_total numeric(18,2) := 0;
  v_created boolean;
  v_existing public.order_settlements%rowtype;
begin
  -- Lock the order: concurrent trigger/admin/webhook attempts serialize here.
  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Idempotency: one settlement row per canonical order.
  select * into v_existing
  from public.order_settlements
  where order_id=v_order.id;

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'already_settled',true,
      'access_grants_count',v_existing.access_grants_count,
      'commissions_count',v_existing.commissions_count,
      'commission_total',v_existing.commission_total,
      'settled_at',v_existing.settled_at
    );
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Order is not paid';
  end if;

  select id into v_paid_tx
  from public.payment_transactions
  where order_id=v_order.id and status='paid'
  order by verified_at desc nulls last, created_at desc
  limit 1;

  if v_paid_tx is null then
    raise exception 'Paid order has no paid payment transaction';
  end if;

  if v_order.buyer_user_id is null then
    raise exception 'Paid order cannot deliver product without buyer_user_id';
  end if;

  -- Product delivery + affiliate commission from immutable item snapshots.
  for v_item in
    select *
    from public.order_items
    where order_id=v_order.id
    order by created_at,id
  loop
    v_created := public.grant_paid_product_access(
      v_order.buyer_user_id,
      v_item.product_id,
      v_order.id
    );

    if v_created then
      v_access_count := v_access_count + 1;
    end if;

    v_created := public.create_order_item_commission(v_order,v_item);

    if v_created then
      v_commission_count := v_commission_count + 1;
      v_commission_total :=
        v_commission_total
        + round(
            v_item.line_total
            * v_item.commission_percent_snapshot
            / 100.0,
            2
          );
    end if;
  end loop;

  -- Coupon reservation becomes consumed only after paid settlement.
  update public.coupon_redemptions
  set status='consumed'
  where commerce_order_id=v_order.id
    and status='reserved';

  -- Record settlement before final order state.
  insert into public.order_settlements (
    order_id,
    payment_transaction_id,
    access_grants_count,
    commissions_count,
    commission_total,
    settled_at,
    settled_by,
    settlement_source
  )
  values (
    v_order.id,
    v_paid_tx,
    v_access_count,
    v_commission_count,
    v_commission_total,
    now(),
    auth.uid(),
    left(coalesce(nullif(trim(p_source),''),'automatic'),100)
  );

  update public.orders
  set status='completed',
      completed_at=coalesce(completed_at,now())
  where id=v_order.id;

  return jsonb_build_object(
    'order_id',v_order.id,
    'already_settled',false,
    'access_grants_count',v_access_count,
    'commissions_count',v_commission_count,
    'commission_total',v_commission_total,
    'settled_at',now()
  );
end;
$$;

revoke all on function public.settle_paid_order(uuid,text) from public;
grant execute on function public.settle_paid_order(uuid,text) to service_role;

-- ------------------------------------------------------------
-- 21.7 AUTOMATIC SETTLEMENT TRIGGER
--
-- STEP 20 manual approval and gateway result both update orders to PAID.
-- This trigger means both paths automatically use the same settlement engine.
-- ------------------------------------------------------------

create or replace function public.trigger_settle_paid_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.payment_status='paid'
     and (
       old.payment_status is distinct from new.payment_status
       or old.status is distinct from new.status
     )
     and new.status='paid' then
    perform public.settle_paid_order(new.id,'payment_status_trigger');

    -- settle_paid_order updates the same row to completed.
    -- Keep this trigger's returned row aligned with the final state so the
    -- outer STEP 20 update cannot overwrite completed back to paid.
    new.status := 'completed';
    new.completed_at := coalesce(new.completed_at,now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_auto_settlement on public.orders;
create trigger trg_orders_auto_settlement
after update of payment_status,status on public.orders
for each row
when (new.payment_status='paid' and new.status='paid')
execute function public.trigger_settle_paid_order();

-- ------------------------------------------------------------
-- 21.8 ADMIN RETRY SETTLEMENT
-- Safe because settle_paid_order itself is idempotent.
-- ------------------------------------------------------------

create or replace function public.admin_settle_paid_order(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return public.settle_paid_order(p_order_id,'admin_manual_retry');
end;
$$;

revoke all on function public.admin_settle_paid_order(uuid) from public;
grant execute on function public.admin_settle_paid_order(uuid)
to authenticated;

-- ------------------------------------------------------------
-- 21.9 RLS / READ ACCESS
-- ------------------------------------------------------------

alter table public.order_settlements enable row level security;

drop policy if exists "order_settlements_admin_read" on public.order_settlements;
drop policy if exists "order_settlements_buyer_read" on public.order_settlements;

create policy "order_settlements_admin_read"
on public.order_settlements
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "order_settlements_buyer_read"
on public.order_settlements
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id=order_settlements.order_id
      and o.buyer_user_id=auth.uid()
  )
);

revoke all on public.order_settlements from anon,authenticated;
grant select on public.order_settlements to authenticated;

-- Direct writes to settlement records/commission linkage stay forbidden.
revoke insert,update,delete on public.order_settlements
from anon,authenticated;

-- ------------------------------------------------------------
-- 21.10 SETTLEMENT SUMMARY
-- ------------------------------------------------------------

create or replace view public.admin_settlement_summary
with (security_invoker=true)
as
select
  count(*)::bigint as settled_orders,
  coalesce(sum(access_grants_count),0)::bigint as access_grants,
  coalesce(sum(commissions_count),0)::bigint as commissions_created,
  coalesce(sum(commission_total),0)::numeric(18,2) as commission_total
from public.order_settlements
where public.is_imerssupa_admin();

grant select on public.admin_settlement_summary to authenticated;

-- ------------------------------------------------------------
-- 21.11 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.order_settlements') is null then
    raise exception 'STEP 21 failed: order_settlements missing';
  end if;

  if to_regprocedure('public.grant_paid_product_access(uuid,uuid,uuid)') is null then
    raise exception 'STEP 21 failed: access delivery function missing';
  end if;

  if to_regprocedure('public.settle_paid_order(uuid,text)') is null then
    raise exception 'STEP 21 failed: settlement function missing';
  end if;

  if to_regprocedure('public.admin_settle_paid_order(uuid)') is null then
    raise exception 'STEP 21 failed: admin settlement RPC missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 21 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 21 Order Settlement & Product Delivery
--
-- NEXT:
-- iMersSUPA - 22 Refund Cancel & Reversal
-- ============================================================


-- ===== SOURCE STEP 22: 22-refund-cancel-reversal.sql =====
-- ============================================================
-- iMersSUPA - 22 Refund Cancel & Reversal
-- Requires: STEP 17-21
--
-- Scope:
-- - Safe cancellation of unpaid orders
-- - Full paid-order refund/reversal
-- - Revoke access granted by the refunded order only when safe
-- - Reverse affiliate commissions
-- - Release/retain coupon redemption correctly
-- - Reverse payment transaction state
-- - Immutable reversal audit
-- - Idempotent operations
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 22.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.order_settlements') is null
     or to_regclass('public.member_access') is null
     or to_regclass('public.affiliate_commissions') is null
     or to_regclass('public.coupon_redemptions') is null then
    raise exception 'STEP 22 requires STEP 17-21';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 22.2 REVERSAL AUDIT
-- ------------------------------------------------------------

create table if not exists public.order_reversals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id) on delete cascade,

  reversal_type text not null
    check (reversal_type in ('cancel','refund')),

  reason text,
  access_revoked_count integer not null default 0
    check (access_revoked_count >= 0),
  commissions_reversed_count integer not null default 0
    check (commissions_reversed_count >= 0),
  commission_reversed_total numeric(18,2) not null default 0
    check (commission_reversed_total >= 0),

  reversed_by uuid references public.profiles(id) on delete set null,
  reversed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique(order_id, reversal_type)
);

create index if not exists order_reversals_reversed_at_idx
  on public.order_reversals(reversed_at desc);

-- ------------------------------------------------------------
-- 22.3 ACCESS REVOCATION HELPER
--
-- Important:
-- Existing access is removed/deactivated only when there is no OTHER
-- completed, non-refunded paid order for the same member + product.
-- This prevents refunding one duplicate purchase from destroying access
-- that is still valid from another purchase.
-- ------------------------------------------------------------

create or replace function public.revoke_refunded_product_access(
  p_user_id uuid,
  p_product_id uuid,
  p_refunded_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_has_other_access_order boolean;
  v_has_status boolean;
  v_has_updated boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select exists(
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id=o.id
    where o.id<>p_refunded_order_id
      and o.buyer_user_id=p_user_id
      and oi.product_id=p_product_id
      and o.payment_status='paid'
      and o.status='completed'
  )
  into v_has_other_access_order;

  if v_has_other_access_order then
    return false;
  end if;

  if not exists (
    select 1 from public.member_access
    where user_id=p_user_id and product_id=p_product_id
  ) then
    return false;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='member_access'
      and column_name='status'
  ) into v_has_status;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='member_access'
      and column_name='updated_at'
  ) into v_has_updated;

  if v_has_status then
    execute format(
      'update public.member_access
       set status=%L%s
       where user_id=$1 and product_id=$2',
      'inactive',
      case when v_has_updated then ', updated_at=now()' else '' end
    )
    using p_user_id,p_product_id;
  else
    delete from public.member_access
    where user_id=p_user_id and product_id=p_product_id;
  end if;

  return true;
end;
$$;

revoke all on function public.revoke_refunded_product_access(uuid,uuid,uuid)
from public;

-- ------------------------------------------------------------
-- 22.4 COMMISSION REVERSAL HELPER
-- Uses STEP 17 statuses:
-- pending, approved, rejected, paid, cancelled
--
-- PAID commissions are deliberately NOT silently changed. A refund of
-- an already-paid affiliate commission is blocked for admin resolution,
-- preventing payout/accounting history corruption.
-- ------------------------------------------------------------

create or replace function public.reverse_order_commissions(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_paid_count integer;
  v_count integer := 0;
  v_total numeric(18,2) := 0;
  v_amount_column text;
begin
  select count(*)
  into v_paid_count
  from public.affiliate_commissions
  where commerce_order_id=p_order_id
    and status='paid';

  if v_paid_count>0 then
    raise exception
      'Refund blocked: affiliate commission has already been paid';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='affiliate_commissions'
      and column_name='commission_amount'
  ) then
    v_amount_column := 'commission_amount';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='affiliate_commissions'
      and column_name='amount'
  ) then
    v_amount_column := 'amount';
  else
    raise exception 'Affiliate commission amount column not found';
  end if;

  execute format(
    'select count(*), coalesce(sum(%I),0)
     from public.affiliate_commissions
     where commerce_order_id=$1
       and status in (''pending'',''approved'')',
    v_amount_column
  )
  into v_count,v_total
  using p_order_id;

  update public.affiliate_commissions
  set status='cancelled'
  where commerce_order_id=p_order_id
    and status in ('pending','approved');

  return jsonb_build_object(
    'count',v_count,
    'total',v_total
  );
end;
$$;

revoke all on function public.reverse_order_commissions(uuid) from public;

-- ------------------------------------------------------------
-- 22.5 CANCEL UNPAID ORDER
-- ------------------------------------------------------------

create or replace function public.cancel_unpaid_order(
  p_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_reversals%rowtype;
begin
  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  if auth.uid() is not null
     and not public.is_imerssupa_admin()
     and v_order.buyer_user_id is distinct from auth.uid() then
    raise exception 'Order access denied';
  end if;

  select * into v_existing
  from public.order_reversals
  where order_id=v_order.id and reversal_type='cancel';

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'already_cancelled',true,
      'status',v_order.status
    );
  end if;

  if v_order.payment_status='paid'
     or v_order.status in ('paid','completed','refunded') then
    raise exception 'Paid/completed order must use refund, not cancel';
  end if;

  update public.payment_transactions
  set status='cancelled'
  where order_id=v_order.id
    and status in ('pending','waiting_verification','rejected','failed');

  update public.coupon_redemptions
  set status='released'
  where commerce_order_id=v_order.id
    and status='reserved';

  update public.orders
  set status='cancelled',
      payment_status='cancelled',
      cancelled_at=coalesce(cancelled_at,now())
  where id=v_order.id;

  insert into public.order_reversals(
    order_id,reversal_type,reason,reversed_by
  )
  values(
    v_order.id,'cancel',
    nullif(left(trim(coalesce(p_reason,'')),1000),''),
    auth.uid()
  );

  return jsonb_build_object(
    'order_id',v_order.id,
    'already_cancelled',false,
    'status','cancelled'
  );
end;
$$;

revoke all on function public.cancel_unpaid_order(uuid,text) from public;
grant execute on function public.cancel_unpaid_order(uuid,text)
to authenticated;

-- Anonymous cancellation is intentionally not exposed.

-- ------------------------------------------------------------
-- 22.6 ADMIN FULL REFUND / REVERSAL
-- ------------------------------------------------------------

create or replace function public.admin_refund_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.order_reversals%rowtype;
  v_commission_result jsonb;
  v_access_count integer := 0;
  v_revoked boolean;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Refund reason is required';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  select * into v_existing
  from public.order_reversals
  where order_id=v_order.id and reversal_type='refund';

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'already_refunded',true,
      'access_revoked_count',v_existing.access_revoked_count,
      'commissions_reversed_count',v_existing.commissions_reversed_count,
      'commission_reversed_total',v_existing.commission_reversed_total
    );
  end if;

  if v_order.payment_status<>'paid'
     or v_order.status not in ('paid','completed') then
    raise exception 'Only paid/completed orders can be refunded';
  end if;

  -- Block before changing anything if affiliate money was already paid out.
  v_commission_result := public.reverse_order_commissions(v_order.id);

  -- Revoke access only when no other valid purchase still grants it.
  for v_item in
    select *
    from public.order_items
    where order_id=v_order.id
    order by created_at,id
  loop
    v_revoked := public.revoke_refunded_product_access(
      v_order.buyer_user_id,
      v_item.product_id,
      v_order.id
    );

    if v_revoked then
      v_access_count := v_access_count + 1;
    end if;
  end loop;

  update public.payment_transactions
  set status='refunded'
  where order_id=v_order.id
    and status='paid';

  -- A consumed coupon remains historical evidence of the purchase.
  -- It is released on full refund so the usage quota becomes available again.
  update public.coupon_redemptions
  set status='released'
  where commerce_order_id=v_order.id
    and status in ('reserved','consumed');

  update public.orders
  set status='refunded',
      payment_status='refunded',
      refunded_at=coalesce(refunded_at,now())
  where id=v_order.id;

  insert into public.order_reversals(
    order_id,
    reversal_type,
    reason,
    access_revoked_count,
    commissions_reversed_count,
    commission_reversed_total,
    reversed_by
  )
  values(
    v_order.id,
    'refund',
    left(trim(p_reason),1000),
    v_access_count,
    coalesce((v_commission_result->>'count')::integer,0),
    coalesce((v_commission_result->>'total')::numeric,0),
    auth.uid()
  );

  return jsonb_build_object(
    'order_id',v_order.id,
    'already_refunded',false,
    'access_revoked_count',v_access_count,
    'commissions_reversed_count',
      coalesce((v_commission_result->>'count')::integer,0),
    'commission_reversed_total',
      coalesce((v_commission_result->>'total')::numeric,0),
    'status','refunded'
  );
end;
$$;

revoke all on function public.admin_refund_order(uuid,text) from public;
grant execute on function public.admin_refund_order(uuid,text)
to authenticated;

-- ------------------------------------------------------------
-- 22.7 SERVICE-ROLE REFUND ENTRY POINT
-- For future trusted gateway refund webhook.
-- It intentionally uses a separate wrapper and still calls the same
-- canonical reversal logic by temporarily requiring admin is avoided:
-- implement the same secure transaction through a private function.
-- ------------------------------------------------------------

create or replace function public.service_refund_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.order_reversals%rowtype;
  v_commission_result jsonb;
  v_access_count integer := 0;
  v_revoked boolean;
begin
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Refund reason is required';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  select * into v_existing
  from public.order_reversals
  where order_id=v_order.id and reversal_type='refund';

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'already_refunded',true
    );
  end if;

  if v_order.payment_status<>'paid'
     or v_order.status not in ('paid','completed') then
    raise exception 'Only paid/completed orders can be refunded';
  end if;

  v_commission_result := public.reverse_order_commissions(v_order.id);

  for v_item in
    select * from public.order_items
    where order_id=v_order.id
  loop
    v_revoked := public.revoke_refunded_product_access(
      v_order.buyer_user_id,
      v_item.product_id,
      v_order.id
    );
    if v_revoked then v_access_count:=v_access_count+1; end if;
  end loop;

  update public.payment_transactions
  set status='refunded'
  where order_id=v_order.id and status='paid';

  update public.coupon_redemptions
  set status='released'
  where commerce_order_id=v_order.id
    and status in ('reserved','consumed');

  update public.orders
  set status='refunded',
      payment_status='refunded',
      refunded_at=coalesce(refunded_at,now())
  where id=v_order.id;

  insert into public.order_reversals(
    order_id,reversal_type,reason,
    access_revoked_count,
    commissions_reversed_count,
    commission_reversed_total,
    reversed_by
  )
  values(
    v_order.id,'refund',left(trim(p_reason),1000),
    v_access_count,
    coalesce((v_commission_result->>'count')::integer,0),
    coalesce((v_commission_result->>'total')::numeric,0),
    null
  );

  return jsonb_build_object(
    'order_id',v_order.id,
    'already_refunded',false,
    'access_revoked_count',v_access_count,
    'commissions_reversed_count',
      coalesce((v_commission_result->>'count')::integer,0),
    'commission_reversed_total',
      coalesce((v_commission_result->>'total')::numeric,0),
    'status','refunded'
  );
end;
$$;

revoke all on function public.service_refund_order(uuid,text) from public;
grant execute on function public.service_refund_order(uuid,text)
to service_role;

-- ------------------------------------------------------------
-- 22.8 RLS
-- ------------------------------------------------------------

alter table public.order_reversals enable row level security;

drop policy if exists "order_reversals_admin_read" on public.order_reversals;
drop policy if exists "order_reversals_buyer_read" on public.order_reversals;

create policy "order_reversals_admin_read"
on public.order_reversals
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "order_reversals_buyer_read"
on public.order_reversals
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id=order_reversals.order_id
      and o.buyer_user_id=auth.uid()
  )
);

revoke all on public.order_reversals from anon,authenticated;
grant select on public.order_reversals to authenticated;

-- ------------------------------------------------------------
-- 22.9 ADMIN REVERSAL SUMMARY
-- ------------------------------------------------------------

create or replace view public.admin_reversal_summary
with (security_invoker=true)
as
select
  count(*) filter (where reversal_type='cancel')::bigint as cancelled_orders,
  count(*) filter (where reversal_type='refund')::bigint as refunded_orders,
  coalesce(sum(access_revoked_count),0)::bigint as access_revoked,
  coalesce(sum(commissions_reversed_count),0)::bigint
    as commissions_reversed,
  coalesce(sum(commission_reversed_total),0)::numeric(18,2)
    as commission_reversed_total
from public.order_reversals
where public.is_imerssupa_admin();

grant select on public.admin_reversal_summary to authenticated;

-- ------------------------------------------------------------
-- 22.10 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.order_reversals') is null then
    raise exception 'STEP 22 failed: order_reversals missing';
  end if;

  if to_regprocedure(
    'public.revoke_refunded_product_access(uuid,uuid,uuid)'
  ) is null then
    raise exception 'STEP 22 failed: access reversal helper missing';
  end if;

  if to_regprocedure('public.cancel_unpaid_order(uuid,text)') is null then
    raise exception 'STEP 22 failed: cancel RPC missing';
  end if;

  if to_regprocedure('public.admin_refund_order(uuid,text)') is null then
    raise exception 'STEP 22 failed: refund RPC missing';
  end if;

  if to_regprocedure('public.service_refund_order(uuid,text)') is null then
    raise exception 'STEP 22 failed: service refund RPC missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 22 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 22 Refund Cancel & Reversal
--
-- NEXT:
-- iMersSUPA - 23 Checkout Security & Public RPC Hardening
-- ============================================================


-- ===== SOURCE STEP 23: 23-checkout-security-public-rpc-hardening.sql =====
-- ============================================================
-- iMersSUPA - 23 Checkout Security & Public RPC Hardening
-- Requires: STEP 17-22
--
-- Scope:
-- - Lock direct writes to commerce/payment/affiliate/coupon core
-- - Bind anonymous checkout mutations to a private checkout token
-- - Prevent order enumeration through public payment RPCs
-- - Harden idempotency keys per checkout identity
-- - Add safe public order/payment RPCs using checkout token
-- - Keep authenticated buyer/admin flows working
-- - Keep trusted service_role gateway flows working
--
-- IMPORTANT:
-- This step replaces the vulnerable anonymous mutation surface from
-- STEP 19/20. Frontend should use the *_secure RPCs created here.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 23.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.payment_methods') is null
     or to_regclass('public.payment_transactions') is null
     or to_regprocedure('public.checkout_quote_internal(jsonb,text,text,uuid)') is null
     or to_regprocedure('public.apply_affiliate_alias_attribution(text,text)') is null then
    raise exception 'STEP 23 requires STEP 17-22';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 23.2 PRIVATE CHECKOUT TOKEN ON ORDER
-- Only the hash is stored. Raw token is returned once at creation.
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists checkout_token_hash text;

create unique index if not exists orders_checkout_token_hash_uidx
  on public.orders(checkout_token_hash)
  where checkout_token_hash is not null;

-- Existing pre-STEP23 orders remain readable by authenticated owner/admin.
-- Anonymous secure mutation requires a token and therefore applies to new
-- STEP23 checkout orders.

create or replace function public.hash_checkout_token(p_token text)
returns text
language sql
immutable
strict
as $$
  select encode(digest(p_token,'sha256'),'hex')
$$;

revoke all on function public.hash_checkout_token(text) from public;

create or replace function public.checkout_token_matches(
  p_order_id uuid,
  p_token text
)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.orders o
    where o.id=p_order_id
      and o.checkout_token_hash is not null
      and o.checkout_token_hash=public.hash_checkout_token(p_token)
  )
$$;

revoke all on function public.checkout_token_matches(uuid,text) from public;

-- ------------------------------------------------------------
-- 23.3 SAFE ACCESS ASSERTION
-- ------------------------------------------------------------

create or replace function public.assert_checkout_access(
  p_order_id uuid,
  p_checkout_token text default null
)
returns public.orders
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id=p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if public.is_imerssupa_admin() then
    return v_order;
  end if;

  if auth.uid() is not null
     and v_order.buyer_user_id=auth.uid() then
    return v_order;
  end if;

  if auth.uid() is null
     and p_checkout_token is not null
     and public.checkout_token_matches(v_order.id,p_checkout_token) then
    return v_order;
  end if;

  raise exception 'Order access denied';
end;
$$;

revoke all on function public.assert_checkout_access(uuid,text) from public;

-- ------------------------------------------------------------
-- 23.4 SECURE ORDER CREATION
--
-- Client never supplies price, discount, affiliate id, commission,
-- payment state, or order state.
-- Anonymous checkout gets a cryptographically random token.
-- Authenticated checkout also receives it, but ownership remains auth.uid().
-- ------------------------------------------------------------

create or replace function public.create_checkout_order_secure(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_customer_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_order public.orders%rowtype;
  v_item jsonb;

  v_coupon_id uuid;
  v_alias_id uuid;
  v_affiliate_id uuid;
  v_attribution_id uuid;

  v_raw_token text;
  v_token_hash text;

  v_key text := trim(coalesce(p_idempotency_key,''));
  v_scoped_key text;
  v_email text := lower(trim(coalesce(p_buyer_email,'')));
  v_name text := trim(coalesce(p_buyer_name,''));
  v_phone text := nullif(trim(coalesce(p_buyer_phone,'')),'');
  v_customer_key text;
begin
  if v_name='' or length(v_name)>150 then
    raise exception 'Valid buyer name is required';
  end if;

  if v_email=''
     or length(v_email)>254
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Valid buyer email is required';
  end if;

  if v_phone is not null and length(v_phone)>50 then
    raise exception 'Buyer phone is too long';
  end if;

  if length(coalesce(p_customer_note,''))>2000 then
    raise exception 'Customer note is too long';
  end if;

  if v_key='' then
    v_key := replace(gen_random_uuid()::text,'-','');
  elsif length(v_key)>120 then
    raise exception 'Idempotency key is too long';
  end if;

  -- Scope client idempotency key to authenticated user or normalized email.
  v_scoped_key :=
    case
      when v_uid is not null
        then 'u:'||v_uid::text||':'||v_key
      else 'e:'||encode(digest(v_email,'sha256'),'hex')||':'||v_key
    end;

  select * into v_order
  from public.orders
  where idempotency_key=v_scoped_key;

  if found then
    -- Never return a previously-issued raw token. Caller must retain the
    -- token from the original successful creation response.
    return jsonb_build_object(
      'order_id',v_order.id,
      'order_number',v_order.order_number,
      'subtotal',v_order.subtotal,
      'discount_amount',v_order.discount_amount,
      'total_amount',v_order.total_amount,
      'currency',v_order.currency,
      'affiliate_name',v_order.affiliate_name_snapshot,
      'coupon_code',v_order.coupon_code_snapshot,
      'order_status',v_order.status,
      'payment_status',v_order.payment_status,
      'checkout_token',null,
      'idempotent_replay',true
    );
  end if;

  if trim(coalesce(p_coupon_code,''))<>'' then
    perform pg_advisory_xact_lock(
      hashtext('imerssupa-coupon:'||upper(trim(p_coupon_code)))
    );
  end if;

  if trim(coalesce(p_coupon_code,''))<>''
     and p_visitor_key is not null
     and trim(p_visitor_key)<>'' then
    perform *
    from public.apply_affiliate_alias_attribution(
      p_coupon_code,
      p_visitor_key
    );
  end if;

  v_quote := public.checkout_quote_internal(
    p_items,p_coupon_code,p_visitor_key,v_uid
  );

  v_coupon_id := nullif(v_quote#>>'{coupon,id}','')::uuid;
  v_alias_id := nullif(v_quote#>>'{coupon,affiliate_alias_id}','')::uuid;
  v_affiliate_id := nullif(v_quote#>>'{affiliate,id}','')::uuid;
  v_attribution_id := nullif(v_quote#>>'{affiliate,attribution_id}','')::uuid;

  v_raw_token :=
    encode(gen_random_bytes(32),'hex') ||
    replace(gen_random_uuid()::text,'-','');
  v_token_hash := public.hash_checkout_token(v_raw_token);

  insert into public.orders(
    order_number,idempotency_key,checkout_token_hash,
    buyer_user_id,buyer_name,buyer_email,buyer_phone,
    currency,subtotal,discount_amount,total_amount,
    coupon_id,coupon_code_snapshot,coupon_kind_snapshot,
    affiliate_alias_id,affiliate_id,
    affiliate_name_snapshot,affiliate_referral_code_snapshot,
    attribution_id,attribution_mode_snapshot,
    affiliate_eligible_snapshot,no_affiliate_reason,
    status,payment_status,customer_note
  )
  values(
    public.generate_order_number(),v_scoped_key,v_token_hash,
    v_uid,v_name,v_email,v_phone,
    v_quote->>'currency',
    (v_quote->>'subtotal')::numeric,
    (v_quote->>'discount_amount')::numeric,
    (v_quote->>'total_amount')::numeric,
    v_coupon_id,v_quote#>>'{coupon,code}',
    nullif(v_quote#>>'{coupon,kind}','')::public.coupon_kind,
    v_alias_id,v_affiliate_id,
    v_quote#>>'{affiliate,name}',
    v_quote#>>'{affiliate,referral_code}',
    v_attribution_id,
    nullif(v_quote#>>'{affiliate,attribution_mode}','')
      ::public.affiliate_attribution_mode,
    v_affiliate_id is not null,
    v_quote->>'no_affiliate_reason',
    'pending','unpaid',
    nullif(trim(coalesce(p_customer_note,'')),'')
  )
  returning * into v_order;

  for v_item in
    select value from jsonb_array_elements(v_quote->'items')
  loop
    insert into public.order_items(
      order_id,product_id,
      product_name_snapshot,product_slug_snapshot,
      quantity,unit_price,line_subtotal,line_discount,line_total,
      coupon_eligible_snapshot,affiliate_eligible_snapshot,
      commission_percent_snapshot
    )
    values(
      v_order.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'product_slug',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_subtotal')::numeric,
      (v_item->>'line_discount')::numeric,
      (v_item->>'line_total')::numeric,
      (v_item->>'coupon_eligible')::boolean,
      (v_item->>'affiliate_eligible')::boolean,
      nullif(v_item->>'commission_percent','')::numeric
    );
  end loop;

  if v_coupon_id is not null then
    v_customer_key :=
      case
        when v_uid is not null then 'user:'||v_uid::text
        else 'email:'||v_email
      end;

    if (
      select usage_limit_per_customer
      from public.coupons where id=v_coupon_id
    ) is not null then
      if (
        select count(*)
        from public.coupon_redemptions cr
        where cr.coupon_id=v_coupon_id
          and cr.customer_key=v_customer_key
          and cr.status in ('reserved','consumed')
      ) >= (
        select usage_limit_per_customer
        from public.coupons where id=v_coupon_id
      ) then
        raise exception 'Customer coupon usage limit reached';
      end if;
    end if;

    insert into public.coupon_redemptions(
      coupon_id,affiliate_alias_id,commerce_order_id,
      user_id,customer_key,discount_amount,status
    )
    values(
      v_coupon_id,v_alias_id,v_order.id,
      v_uid,v_customer_key,v_order.discount_amount,'reserved'
    );
  end if;

  return jsonb_build_object(
    'order_id',v_order.id,
    'order_number',v_order.order_number,
    'subtotal',v_order.subtotal,
    'discount_amount',v_order.discount_amount,
    'total_amount',v_order.total_amount,
    'currency',v_order.currency,
    'affiliate_name',v_order.affiliate_name_snapshot,
    'coupon_code',v_order.coupon_code_snapshot,
    'order_status',v_order.status,
    'payment_status',v_order.payment_status,
    'checkout_token',v_raw_token,
    'idempotent_replay',false
  );
end;
$$;

revoke all on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) from public;
grant execute on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) to anon,authenticated;

-- ------------------------------------------------------------
-- 23.5 SECURE AVAILABLE PAYMENT METHODS
-- Requires checkout ownership/token before exposing order-specific quote.
-- ------------------------------------------------------------

create or replace function public.get_available_payment_methods_secure(
  p_order_id uuid,
  p_checkout_token text default null
)
returns table(
  payment_method_id uuid,
  name text,
  code text,
  type public.payment_method_type,
  description text,
  instructions text,
  account_name text,
  account_number text,
  qris_image_url text,
  provider_name text,
  fee_amount numeric,
  amount_due numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
begin
  v_order := public.assert_checkout_access(p_order_id,p_checkout_token);

  if v_order.status in ('cancelled','expired','refunded','completed')
     or v_order.payment_status in ('paid','cancelled','expired','refunded') then
    return;
  end if;

  return query
  select
    pm.id,pm.name,pm.code,pm.type,
    pm.description,pm.instructions,
    pm.account_name,pm.account_number,pm.qris_image_url,
    pm.provider_name,
    round(pm.fee_fixed+(v_order.total_amount*pm.fee_percent/100.0),2),
    v_order.total_amount+
      round(pm.fee_fixed+(v_order.total_amount*pm.fee_percent/100.0),2)
  from public.payment_methods pm
  where pm.active=true
    and (pm.min_amount is null or v_order.total_amount>=pm.min_amount)
    and (pm.max_amount is null or v_order.total_amount<=pm.max_amount)
  order by pm.sort_order,pm.name;
end;
$$;

revoke all on function public.get_available_payment_methods_secure(uuid,text)
from public;
grant execute on function public.get_available_payment_methods_secure(uuid,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.6 SECURE SELECT PAYMENT METHOD
-- ------------------------------------------------------------

create or replace function public.select_order_payment_method_secure(
  p_order_id uuid,
  p_payment_method_id uuid,
  p_checkout_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_fee numeric(18,2);
begin
  v_order := public.assert_checkout_access(p_order_id,p_checkout_token);

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if v_order.status in ('cancelled','expired','refunded','completed')
     or v_order.payment_status='paid' then
    raise exception 'Order cannot accept a new payment method';
  end if;

  select * into v_method
  from public.payment_methods
  where id=p_payment_method_id and active=true;

  if not found then raise exception 'Payment method unavailable'; end if;

  if v_method.min_amount is not null
     and v_order.total_amount<v_method.min_amount then
    raise exception 'Order amount is below payment method minimum';
  end if;

  if v_method.max_amount is not null
     and v_order.total_amount>v_method.max_amount then
    raise exception 'Order amount exceeds payment method maximum';
  end if;

  v_fee := round(
    v_method.fee_fixed+(v_order.total_amount*v_method.fee_percent/100.0),2
  );

  update public.payment_transactions
  set status='cancelled'
  where order_id=v_order.id
    and status in ('pending','waiting_verification');

  insert into public.payment_transactions(
    order_id,payment_method_id,
    payment_method_name_snapshot,payment_method_code_snapshot,
    payment_method_type_snapshot,
    base_amount,fee_amount,amount_due,status,
    provider_name,expires_at
  )
  values(
    v_order.id,v_method.id,
    v_method.name,v_method.code,v_method.type,
    v_order.total_amount,v_fee,v_order.total_amount+v_fee,
    'pending',v_method.provider_name,v_order.expires_at
  )
  returning * into v_tx;

  update public.orders
  set selected_payment_method_id=v_method.id,
      payment_fee=v_fee,
      grand_total=v_order.total_amount+v_fee,
      status='awaiting_payment',
      payment_status='pending'
  where id=v_order.id;

  return jsonb_build_object(
    'payment_transaction_id',v_tx.id,
    'payment_method_name',v_tx.payment_method_name_snapshot,
    'payment_method_type',v_tx.payment_method_type_snapshot,
    'base_amount',v_tx.base_amount,
    'fee_amount',v_tx.fee_amount,
    'amount_due',v_tx.amount_due,
    'payment_status','pending'
  );
end;
$$;

revoke all on function public.select_order_payment_method_secure(uuid,uuid,text)
from public;
grant execute on function public.select_order_payment_method_secure(uuid,uuid,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.7 SECURE MANUAL PROOF SUBMISSION
-- ------------------------------------------------------------

create or replace function public.submit_manual_payment_proof_secure(
  p_payment_transaction_id uuid,
  p_proof_url text,
  p_checkout_token text default null,
  p_payer_name text default null,
  p_payer_account text default null,
  p_payer_note text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
begin
  if nullif(trim(coalesce(p_proof_url,'')),'') is null then
    raise exception 'Payment proof URL is required';
  end if;

  if length(p_proof_url)>2000
     or length(coalesce(p_payer_name,''))>150
     or length(coalesce(p_payer_account,''))>150
     or length(coalesce(p_payer_note,''))>1000 then
    raise exception 'Payment proof value is too long';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id
  for update;

  if not found then raise exception 'Payment transaction not found'; end if;

  v_order := public.assert_checkout_access(v_tx.order_id,p_checkout_token);

  if v_tx.payment_method_type_snapshot
     not in ('bank_transfer','ewallet','qris_static') then
    raise exception 'This payment method does not accept manual proof';
  end if;

  if v_tx.status not in ('pending','rejected') then
    raise exception 'Payment proof cannot be submitted for this transaction';
  end if;

  update public.payment_transactions
  set proof_url=trim(p_proof_url),
      payer_name=nullif(trim(coalesce(p_payer_name,'')),''),
      payer_account=nullif(trim(coalesce(p_payer_account,'')),''),
      payer_note=nullif(trim(coalesce(p_payer_note,'')),''),
      submitted_at=now(),
      status='waiting_verification',
      rejection_reason=null
  where id=v_tx.id;

  update public.orders
  set status='awaiting_payment',payment_status='pending'
  where id=v_order.id;
end;
$$;

revoke all on function public.submit_manual_payment_proof_secure(
  uuid,text,text,text,text,text
) from public;
grant execute on function public.submit_manual_payment_proof_secure(
  uuid,text,text,text,text,text
) to anon,authenticated;

-- ------------------------------------------------------------
-- 23.8 SECURE ORDER DETAIL
-- Email is no longer an anonymous secret.
-- ------------------------------------------------------------

create or replace function public.get_checkout_order_secure(
  p_order_id uuid,
  p_checkout_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
begin
  v_order := public.assert_checkout_access(p_order_id,p_checkout_token);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',oi.id,
      'product_id',oi.product_id,
      'product_name',oi.product_name_snapshot,
      'product_slug',oi.product_slug_snapshot,
      'quantity',oi.quantity,
      'unit_price',oi.unit_price,
      'line_subtotal',oi.line_subtotal,
      'line_discount',oi.line_discount,
      'line_total',oi.line_total
    )
    order by oi.created_at,oi.id
  ),'[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id=v_order.id;

  return jsonb_build_object(
    'id',v_order.id,
    'order_number',v_order.order_number,
    'buyer_name',v_order.buyer_name,
    'buyer_email',v_order.buyer_email,
    'buyer_phone',v_order.buyer_phone,
    'currency',v_order.currency,
    'subtotal',v_order.subtotal,
    'discount_amount',v_order.discount_amount,
    'total_amount',v_order.total_amount,
    'payment_fee',v_order.payment_fee,
    'grand_total',v_order.grand_total,
    'coupon_code',v_order.coupon_code_snapshot,
    'affiliate_name',v_order.affiliate_name_snapshot,
    'affiliate_referral_code',v_order.affiliate_referral_code_snapshot,
    'status',v_order.status,
    'payment_status',v_order.payment_status,
    'created_at',v_order.created_at,
    'expires_at',v_order.expires_at,
    'items',v_items
  );
end;
$$;

revoke all on function public.get_checkout_order_secure(uuid,text) from public;
grant execute on function public.get_checkout_order_secure(uuid,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.9 SECURE PAYMENT DETAIL
-- ------------------------------------------------------------

create or replace function public.get_payment_transaction_secure(
  p_payment_transaction_id uuid,
  p_checkout_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
begin
  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id;

  if not found then raise exception 'Payment transaction not found'; end if;

  v_order := public.assert_checkout_access(v_tx.order_id,p_checkout_token);

  if v_tx.payment_method_id is not null then
    select * into v_method
    from public.payment_methods
    where id=v_tx.payment_method_id;
  end if;

  return jsonb_build_object(
    'id',v_tx.id,
    'order_id',v_tx.order_id,
    'order_number',v_order.order_number,
    'payment_method_name',v_tx.payment_method_name_snapshot,
    'payment_method_code',v_tx.payment_method_code_snapshot,
    'payment_method_type',v_tx.payment_method_type_snapshot,
    'base_amount',v_tx.base_amount,
    'fee_amount',v_tx.fee_amount,
    'amount_due',v_tx.amount_due,
    'status',v_tx.status,
    'instructions',v_method.instructions,
    'account_name',v_method.account_name,
    'account_number',v_method.account_number,
    'qris_image_url',v_method.qris_image_url,
    'provider_name',v_tx.provider_name,
    'provider_reference',v_tx.provider_reference,
    'proof_url',v_tx.proof_url,
    'submitted_at',v_tx.submitted_at,
    'expires_at',v_tx.expires_at,
    'rejection_reason',v_tx.rejection_reason
  );
end;
$$;

revoke all on function public.get_payment_transaction_secure(uuid,text)
from public;
grant execute on function public.get_payment_transaction_secure(uuid,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.10 SECURE ANONYMOUS CANCEL
-- Authenticated buyer/admin works without token.
-- Anonymous buyer must possess checkout token.
-- ------------------------------------------------------------

create or replace function public.cancel_unpaid_order_secure(
  p_order_id uuid,
  p_checkout_token text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_reversals%rowtype;
begin
  v_order := public.assert_checkout_access(p_order_id,p_checkout_token);

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  select * into v_existing
  from public.order_reversals
  where order_id=v_order.id and reversal_type='cancel';

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'already_cancelled',true,
      'status',v_order.status
    );
  end if;

  if v_order.payment_status='paid'
     or v_order.status in ('paid','completed','refunded') then
    raise exception 'Paid/completed order must use refund, not cancel';
  end if;

  update public.payment_transactions
  set status='cancelled'
  where order_id=v_order.id
    and status in ('pending','waiting_verification','rejected','failed');

  update public.coupon_redemptions
  set status='released'
  where commerce_order_id=v_order.id and status='reserved';

  update public.orders
  set status='cancelled',
      payment_status='cancelled',
      cancelled_at=coalesce(cancelled_at,now())
  where id=v_order.id;

  insert into public.order_reversals(
    order_id,reversal_type,reason,reversed_by
  )
  values(
    v_order.id,'cancel',
    nullif(left(trim(coalesce(p_reason,'')),1000),''),
    auth.uid()
  );

  return jsonb_build_object(
    'order_id',v_order.id,
    'already_cancelled',false,
    'status','cancelled'
  );
end;
$$;

revoke all on function public.cancel_unpaid_order_secure(uuid,text,text)
from public;
grant execute on function public.cancel_unpaid_order_secure(uuid,text,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.11 REVOKE LEGACY PUBLIC RPC EXECUTION
--
-- These STEP19/20 RPCs used order-id/email or allowed anonymous mutation
-- without a checkout possession token. Keep definitions for migration
-- compatibility, but make them unreachable from browser roles.
-- ------------------------------------------------------------

revoke execute on function public.create_checkout_order(
  jsonb,text,text,text,text,text,text,text
) from anon,authenticated;

revoke execute on function public.get_available_payment_methods(uuid)
from anon,authenticated;

revoke execute on function public.select_order_payment_method(uuid,uuid)
from anon,authenticated;

revoke execute on function public.submit_manual_payment_proof(
  uuid,text,text,text,text
) from anon,authenticated;

revoke execute on function public.get_checkout_order(uuid,text)
from anon,authenticated;

revoke execute on function public.get_payment_transaction(uuid,text)
from anon,authenticated;

-- Old authenticated-only cancel RPC is also replaced by secure version.
revoke execute on function public.cancel_unpaid_order(uuid,text)
from authenticated;

-- ------------------------------------------------------------
-- 23.12 DIRECT TABLE MUTATION HARDENING
-- Explicitly remove browser write privileges from all commerce-sensitive
-- tables. RLS remains enabled as defense in depth.
-- ------------------------------------------------------------

revoke insert,update,delete on public.orders
from anon,authenticated;

revoke insert,update,delete on public.order_items
from anon,authenticated;

revoke insert,update,delete on public.payment_methods
from anon,authenticated;

revoke insert,update,delete on public.payment_transactions
from anon,authenticated;

revoke insert,update,delete on public.order_settlements
from anon,authenticated;

revoke insert,update,delete on public.order_reversals
from anon,authenticated;

revoke insert,update,delete on public.coupon_redemptions
from anon,authenticated;

revoke insert,update,delete on public.affiliate_commissions
from anon,authenticated;

-- ------------------------------------------------------------
-- 23.13 PUBLIC QUOTE RATE-SURFACE HARDENING
--
-- Quote stays public because checkout needs it before an order exists.
-- It returns no private config and cannot write commerce records.
-- ------------------------------------------------------------

revoke execute on function public.checkout_quote_internal(jsonb,text,text,uuid)
from anon,authenticated;

-- get_checkout_quote remains the only browser-accessible quote engine.
grant execute on function public.get_checkout_quote(jsonb,text,text)
to anon,authenticated;

-- ------------------------------------------------------------
-- 23.14 SECURITY AUDIT VIEW (ADMIN ONLY)
-- ------------------------------------------------------------

create or replace view public.admin_checkout_security_summary
with (security_invoker=true)
as
select
  count(*)::bigint as total_orders,
  count(*) filter (where checkout_token_hash is not null)::bigint
    as token_secured_orders,
  count(*) filter (
    where buyer_user_id is null and checkout_token_hash is not null
  )::bigint as secured_guest_orders,
  count(*) filter (
    where buyer_user_id is null and checkout_token_hash is null
  )::bigint as legacy_guest_orders
from public.orders
where public.is_imerssupa_admin();

grant select on public.admin_checkout_security_summary to authenticated;

-- ------------------------------------------------------------
-- 23.15 FINAL SECURITY CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regprocedure(
    'public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)'
  ) is null then
    raise exception 'STEP 23 failed: secure order creation missing';
  end if;

  if to_regprocedure(
    'public.select_order_payment_method_secure(uuid,uuid,text)'
  ) is null then
    raise exception 'STEP 23 failed: secure payment selection missing';
  end if;

  if to_regprocedure(
    'public.submit_manual_payment_proof_secure(uuid,text,text,text,text,text)'
  ) is null then
    raise exception 'STEP 23 failed: secure proof RPC missing';
  end if;

  if to_regprocedure(
    'public.get_checkout_order_secure(uuid,text)'
  ) is null then
    raise exception 'STEP 23 failed: secure order read missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.select_order_payment_method(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'STEP 23 failed: legacy anonymous payment RPC still executable';
  end if;

  if has_table_privilege('anon','public.orders','INSERT')
     or has_table_privilege('authenticated','public.orders','INSERT') then
    raise exception 'STEP 23 failed: direct order insert still granted';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 23 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 23 Checkout Security & Public RPC Hardening
--
-- FRONTEND RULE:
-- Use only:
--   get_checkout_quote
--   create_checkout_order_secure
--   get_checkout_order_secure
--   get_available_payment_methods_secure
--   select_order_payment_method_secure
--   submit_manual_payment_proof_secure
--   get_payment_transaction_secure
--   cancel_unpaid_order_secure
--
-- NEXT:
-- iMersSUPA - 24 Transaction & Admin Operations
-- ============================================================


-- ===== SOURCE STEP 24: 24-transaction-admin-operations.sql =====
-- ============================================================
-- iMersSUPA - 24 Transaction & Admin Operations
-- Requires: STEP 17-23
--
-- Scope:
-- - Admin transaction/order detail
-- - Admin order list/search/filter RPC
-- - Manual offline payment recording
-- - Admin payment verification queue
-- - Safe admin order notes
-- - Payment/order operational timeline
-- - Commerce dashboard summary
-- - No direct browser writes to canonical commerce tables
--
-- Settlement remains STEP 21 canonical engine.
-- Refund/cancel remains STEP 22 canonical engine.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 24.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.payment_methods') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.order_settlements') is null
     or to_regclass('public.order_reversals') is null
     or to_regprocedure('public.admin_review_manual_payment(uuid,boolean,text)') is null
     or to_regprocedure('public.admin_refund_order(uuid,text)') is null then
    raise exception 'STEP 24 requires STEP 17-23';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 24.2 ADMIN ORDER NOTE
-- Separate operational note so customer_note remains customer-owned data.
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists admin_note text;

-- ------------------------------------------------------------
-- 24.3 TRANSACTION EVENT LOG
-- Append-only audit for admin operations.
-- ------------------------------------------------------------

create table if not exists public.commerce_events (
  id uuid primary key default gen_random_uuid(),

  order_id uuid
    references public.orders(id) on delete cascade,

  payment_transaction_id uuid
    references public.payment_transactions(id) on delete set null,

  event_type text not null,
  event_source text not null default 'system',

  actor_user_id uuid
    references public.profiles(id) on delete set null,

  message text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint commerce_events_type_format
    check (event_type ~ '^[a-z0-9_.-]{2,80}$'),

  constraint commerce_events_source_format
    check (event_source ~ '^[a-z0-9_.-]{2,50}$')
);

create index if not exists commerce_events_order_created_idx
  on public.commerce_events(order_id,created_at desc);

create index if not exists commerce_events_payment_created_idx
  on public.commerce_events(payment_transaction_id,created_at desc);

create index if not exists commerce_events_type_created_idx
  on public.commerce_events(event_type,created_at desc);

-- ------------------------------------------------------------
-- 24.4 PRIVATE EVENT WRITER
-- ------------------------------------------------------------

create or replace function public.log_commerce_event(
  p_order_id uuid,
  p_payment_transaction_id uuid,
  p_event_type text,
  p_event_source text default 'system',
  p_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if nullif(trim(coalesce(p_event_type,'')),'') is null then
    raise exception 'Event type is required';
  end if;

  insert into public.commerce_events(
    order_id,payment_transaction_id,
    event_type,event_source,actor_user_id,
    message,metadata
  )
  values(
    p_order_id,p_payment_transaction_id,
    lower(trim(p_event_type)),
    lower(trim(coalesce(nullif(p_event_source,''),'system'))),
    auth.uid(),
    nullif(left(trim(coalesce(p_message,'')),1000),''),
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_commerce_event(
  uuid,uuid,text,text,text,jsonb
) from public;

-- ------------------------------------------------------------
-- 24.5 ADMIN ORDER LIST
-- Pagination + search + status/payment filters.
-- ------------------------------------------------------------

create or replace function public.admin_list_orders(
  p_search text default null,
  p_status public.commerce_order_status default null,
  p_payment_status public.commerce_payment_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id uuid,
  order_number text,
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  subtotal numeric,
  discount_amount numeric,
  payment_fee numeric,
  grand_total numeric,
  currency text,
  status public.commerce_order_status,
  payment_status public.commerce_payment_status,
  coupon_code text,
  affiliate_name text,
  created_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  total_rows bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit,50),1),200);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_search text := nullif(trim(coalesce(p_search,'')),'');
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    o.id,o.order_number,o.buyer_name,o.buyer_email,o.buyer_phone,
    o.subtotal,o.discount_amount,o.payment_fee,o.grand_total,o.currency,
    o.status,o.payment_status,
    o.coupon_code_snapshot,
    o.affiliate_name_snapshot,
    o.created_at,o.paid_at,o.completed_at,
    count(*) over() as total_rows
  from public.orders o
  where (p_status is null or o.status=p_status)
    and (p_payment_status is null or o.payment_status=p_payment_status)
    and (
      v_search is null
      or o.order_number ilike '%'||v_search||'%'
      or o.buyer_name ilike '%'||v_search||'%'
      or o.buyer_email ilike '%'||v_search||'%'
      or coalesce(o.buyer_phone,'') ilike '%'||v_search||'%'
      or coalesce(o.coupon_code_snapshot,'') ilike '%'||v_search||'%'
      or coalesce(o.affiliate_name_snapshot,'') ilike '%'||v_search||'%'
    )
  order by o.created_at desc,o.id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_list_orders(
  text,public.commerce_order_status,public.commerce_payment_status,integer,integer
) from public;
grant execute on function public.admin_list_orders(
  text,public.commerce_order_status,public.commerce_payment_status,integer,integer
) to authenticated;

-- ------------------------------------------------------------
-- 24.6 ADMIN ORDER DETAIL
-- One RPC for transaction drawer/detail page.
-- ------------------------------------------------------------

create or replace function public.admin_get_order_detail(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_items jsonb;
  v_payments jsonb;
  v_settlement jsonb;
  v_reversals jsonb;
  v_events jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id;

  if not found then raise exception 'Order not found'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',oi.id,
      'product_id',oi.product_id,
      'product_name',oi.product_name_snapshot,
      'product_slug',oi.product_slug_snapshot,
      'quantity',oi.quantity,
      'unit_price',oi.unit_price,
      'line_subtotal',oi.line_subtotal,
      'line_discount',oi.line_discount,
      'line_total',oi.line_total,
      'coupon_eligible',oi.coupon_eligible_snapshot,
      'affiliate_eligible',oi.affiliate_eligible_snapshot,
      'commission_percent',oi.commission_percent_snapshot
    )
    order by oi.created_at,oi.id
  ),'[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id=v_order.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',pt.id,
      'payment_method_name',pt.payment_method_name_snapshot,
      'payment_method_code',pt.payment_method_code_snapshot,
      'payment_method_type',pt.payment_method_type_snapshot,
      'base_amount',pt.base_amount,
      'fee_amount',pt.fee_amount,
      'amount_due',pt.amount_due,
      'status',pt.status,
      'provider_name',pt.provider_name,
      'provider_reference',pt.provider_reference,
      'proof_url',pt.proof_url,
      'payer_name',pt.payer_name,
      'payer_account',pt.payer_account,
      'payer_note',pt.payer_note,
      'submitted_at',pt.submitted_at,
      'verified_at',pt.verified_at,
      'rejection_reason',pt.rejection_reason,
      'created_at',pt.created_at
    )
    order by pt.created_at desc,pt.id desc
  ),'[]'::jsonb)
  into v_payments
  from public.payment_transactions pt
  where pt.order_id=v_order.id;

  select to_jsonb(os)
  into v_settlement
  from public.order_settlements os
  where os.order_id=v_order.id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.reversed_at desc),'[]'::jsonb)
  into v_reversals
  from public.order_reversals r
  where r.order_id=v_order.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',e.id,
      'event_type',e.event_type,
      'event_source',e.event_source,
      'actor_user_id',e.actor_user_id,
      'message',e.message,
      'metadata',e.metadata,
      'created_at',e.created_at
    )
    order by e.created_at desc,e.id desc
  ),'[]'::jsonb)
  into v_events
  from public.commerce_events e
  where e.order_id=v_order.id;

  return jsonb_build_object(
    'order',jsonb_build_object(
      'id',v_order.id,
      'order_number',v_order.order_number,
      'buyer_user_id',v_order.buyer_user_id,
      'buyer_name',v_order.buyer_name,
      'buyer_email',v_order.buyer_email,
      'buyer_phone',v_order.buyer_phone,
      'currency',v_order.currency,
      'subtotal',v_order.subtotal,
      'discount_amount',v_order.discount_amount,
      'total_amount',v_order.total_amount,
      'payment_fee',v_order.payment_fee,
      'grand_total',v_order.grand_total,
      'coupon_code',v_order.coupon_code_snapshot,
      'coupon_kind',v_order.coupon_kind_snapshot,
      'affiliate_id',v_order.affiliate_id,
      'affiliate_name',v_order.affiliate_name_snapshot,
      'affiliate_referral_code',v_order.affiliate_referral_code_snapshot,
      'affiliate_eligible',v_order.affiliate_eligible_snapshot,
      'no_affiliate_reason',v_order.no_affiliate_reason,
      'status',v_order.status,
      'payment_status',v_order.payment_status,
      'customer_note',v_order.customer_note,
      'admin_note',v_order.admin_note,
      'expires_at',v_order.expires_at,
      'paid_at',v_order.paid_at,
      'completed_at',v_order.completed_at,
      'cancelled_at',v_order.cancelled_at,
      'refunded_at',v_order.refunded_at,
      'created_at',v_order.created_at,
      'updated_at',v_order.updated_at
    ),
    'items',v_items,
    'payments',v_payments,
    'settlement',v_settlement,
    'reversals',v_reversals,
    'events',v_events
  );
end;
$$;

revoke all on function public.admin_get_order_detail(uuid) from public;
grant execute on function public.admin_get_order_detail(uuid)
to authenticated;

-- ------------------------------------------------------------
-- 24.7 ADMIN PAYMENT VERIFICATION QUEUE
-- ------------------------------------------------------------

create or replace function public.admin_list_payment_verification_queue(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  payment_transaction_id uuid,
  order_id uuid,
  order_number text,
  buyer_name text,
  buyer_email text,
  payment_method_name text,
  amount_due numeric,
  proof_url text,
  payer_name text,
  payer_account text,
  payer_note text,
  submitted_at timestamptz,
  total_rows bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit,50),1),200);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    pt.id,o.id,o.order_number,o.buyer_name,o.buyer_email,
    pt.payment_method_name_snapshot,pt.amount_due,
    pt.proof_url,pt.payer_name,pt.payer_account,pt.payer_note,
    pt.submitted_at,
    count(*) over() as total_rows
  from public.payment_transactions pt
  join public.orders o on o.id=pt.order_id
  where pt.status='waiting_verification'
  order by pt.submitted_at asc nulls last,pt.created_at asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.admin_list_payment_verification_queue(integer,integer)
from public;
grant execute on function public.admin_list_payment_verification_queue(integer,integer)
to authenticated;

-- ------------------------------------------------------------
-- 24.8 ADMIN REVIEW PAYMENT + EVENT
-- Canonical STEP20 verification function is reused.
-- STEP21 settlement trigger remains the only settlement path.
-- ------------------------------------------------------------

create or replace function public.admin_review_payment_operation(
  p_payment_transaction_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id;

  if not found then raise exception 'Payment transaction not found'; end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id;

  perform public.admin_review_manual_payment(
    p_payment_transaction_id,p_approve,p_note
  );

  perform public.log_commerce_event(
    v_order.id,
    v_tx.id,
    case when p_approve then 'payment.approved' else 'payment.rejected' end,
    'admin',
    case
      when p_approve then 'Manual payment approved'
      else coalesce(nullif(trim(coalesce(p_note,'')),''),'Manual payment rejected')
    end,
    jsonb_build_object('approved',p_approve)
  );

  return public.admin_get_order_detail(v_order.id);
end;
$$;

revoke all on function public.admin_review_payment_operation(uuid,boolean,text)
from public;
grant execute on function public.admin_review_payment_operation(uuid,boolean,text)
to authenticated;

-- ------------------------------------------------------------
-- 24.9 ADMIN MANUAL/OFFLINE PAYMENT RECORD
--
-- Useful when admin receives cash/manual transfer outside normal upload flow.
-- Creates a canonical paid payment transaction and updates the order.
-- STEP21 auto-settlement trigger then grants product/commission exactly once.
-- ------------------------------------------------------------

create or replace function public.admin_record_offline_payment(
  p_order_id uuid,
  p_payment_method_id uuid,
  p_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_tx public.payment_transactions%rowtype;
  v_fee numeric(18,2);
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;

  if v_order.payment_status='paid'
     or v_order.status in ('completed','refunded') then
    raise exception 'Order is already paid/completed/refunded';
  end if;

  if v_order.status in ('cancelled','expired') then
    raise exception 'Cancelled/expired order cannot be paid';
  end if;

  select * into v_method
  from public.payment_methods
  where id=p_payment_method_id;

  if not found then raise exception 'Payment method not found'; end if;

  v_fee := round(
    v_method.fee_fixed+(v_order.total_amount*v_method.fee_percent/100.0),2
  );

  update public.payment_transactions
  set status='cancelled'
  where order_id=v_order.id
    and status in ('pending','waiting_verification','rejected','failed');

  insert into public.payment_transactions(
    order_id,payment_method_id,
    payment_method_name_snapshot,payment_method_code_snapshot,
    payment_method_type_snapshot,
    base_amount,fee_amount,amount_due,
    status,provider_name,provider_reference,
    payer_note,verified_at,verified_by,expires_at
  )
  values(
    v_order.id,v_method.id,
    v_method.name,v_method.code,v_method.type,
    v_order.total_amount,v_fee,v_order.total_amount+v_fee,
    'paid',v_method.provider_name,
    nullif(trim(coalesce(p_reference,'')),''),
    nullif(left(trim(coalesce(p_note,'')),1000),''),
    now(),auth.uid(),v_order.expires_at
  )
  returning * into v_tx;

  update public.orders
  set selected_payment_method_id=v_method.id,
      payment_fee=v_fee,
      grand_total=v_order.total_amount+v_fee,
      payment_status='paid',
      status='paid',
      paid_at=coalesce(paid_at,now())
  where id=v_order.id;

  perform public.log_commerce_event(
    v_order.id,v_tx.id,
    'payment.offline_recorded','admin',
    'Offline/manual payment recorded by admin',
    jsonb_build_object(
      'payment_method',v_method.code,
      'reference',nullif(trim(coalesce(p_reference,'')),'')
    )
  );

  return public.admin_get_order_detail(v_order.id);
end;
$$;

revoke all on function public.admin_record_offline_payment(uuid,uuid,text,text)
from public;
grant execute on function public.admin_record_offline_payment(uuid,uuid,text,text)
to authenticated;

-- ------------------------------------------------------------
-- 24.10 ADMIN NOTE
-- ------------------------------------------------------------

create or replace function public.admin_update_order_note(
  p_order_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if length(coalesce(p_note,''))>5000 then
    raise exception 'Admin note is too long';
  end if;

  update public.orders
  set admin_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_order_id;

  if not found then raise exception 'Order not found'; end if;

  perform public.log_commerce_event(
    p_order_id,null,
    'order.admin_note_updated','admin',
    'Admin note updated',
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_update_order_note(uuid,text) from public;
grant execute on function public.admin_update_order_note(uuid,text)
to authenticated;

-- ------------------------------------------------------------
-- 24.11 ADMIN CANCEL WRAPPER + EVENT
-- Reuses STEP22 canonical cancellation.
-- ------------------------------------------------------------

create or replace function public.admin_cancel_order_operation(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  v_result := public.cancel_unpaid_order_secure(
    p_order_id,null,p_reason
  );

  perform public.log_commerce_event(
    p_order_id,null,
    'order.cancelled','admin',
    coalesce(nullif(trim(coalesce(p_reason,'')),''),'Order cancelled by admin'),
    '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.admin_cancel_order_operation(uuid,text) from public;
grant execute on function public.admin_cancel_order_operation(uuid,text)
to authenticated;

-- ------------------------------------------------------------
-- 24.12 ADMIN REFUND WRAPPER + EVENT
-- Reuses STEP22 canonical refund.
-- ------------------------------------------------------------

create or replace function public.admin_refund_order_operation(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  v_result := public.admin_refund_order(p_order_id,p_reason);

  perform public.log_commerce_event(
    p_order_id,null,
    'order.refunded','admin',
    p_reason,
    '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.admin_refund_order_operation(uuid,text) from public;
grant execute on function public.admin_refund_order_operation(uuid,text)
to authenticated;

-- ------------------------------------------------------------
-- 24.13 ADMIN COMMERCE DASHBOARD
-- ------------------------------------------------------------

create or replace function public.admin_commerce_dashboard(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_from timestamptz := coalesce(p_from,date_trunc('month',now()));
  v_to timestamptz := coalesce(p_to,now());
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if v_to<v_from then
    raise exception 'Invalid dashboard date range';
  end if;

  select jsonb_build_object(
    'from',v_from,
    'to',v_to,
    'orders',count(*),
    'paid_orders',count(*) filter (
      where o.payment_status='paid'
    ),
    'pending_orders',count(*) filter (
      where o.payment_status in ('unpaid','pending')
    ),
    'completed_orders',count(*) filter (
      where o.status='completed'
    ),
    'cancelled_orders',count(*) filter (
      where o.status='cancelled'
    ),
    'refunded_orders',count(*) filter (
      where o.status='refunded'
    ),
    'gross_sales',coalesce(sum(o.grand_total) filter (
      where o.payment_status='paid'
        and o.status in ('paid','completed')
    ),0),
    'discounts',coalesce(sum(o.discount_amount) filter (
      where o.payment_status='paid'
        and o.status in ('paid','completed')
    ),0),
    'payment_fees',coalesce(sum(o.payment_fee) filter (
      where o.payment_status='paid'
        and o.status in ('paid','completed')
    ),0),
    'waiting_payment_verification',(
      select count(*)
      from public.payment_transactions pt
      where pt.status='waiting_verification'
        and pt.created_at between v_from and v_to
    )
  )
  into v_result
  from public.orders o
  where o.created_at between v_from and v_to;

  return v_result;
end;
$$;

revoke all on function public.admin_commerce_dashboard(timestamptz,timestamptz)
from public;
grant execute on function public.admin_commerce_dashboard(timestamptz,timestamptz)
to authenticated;

-- ------------------------------------------------------------
-- 24.14 RLS FOR EVENT LOG
-- ------------------------------------------------------------

alter table public.commerce_events enable row level security;

drop policy if exists "commerce_events_admin_read" on public.commerce_events;
drop policy if exists "commerce_events_buyer_read" on public.commerce_events;

create policy "commerce_events_admin_read"
on public.commerce_events
for select
to authenticated
using (public.is_imerssupa_admin());

create policy "commerce_events_buyer_read"
on public.commerce_events
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id=commerce_events.order_id
      and o.buyer_user_id=auth.uid()
  )
);

revoke all on public.commerce_events from anon,authenticated;
grant select on public.commerce_events to authenticated;

-- ------------------------------------------------------------
-- 24.15 DIRECT WRITE HARDENING
-- ------------------------------------------------------------

revoke insert,update,delete on public.commerce_events
from anon,authenticated;

revoke insert,update,delete on public.orders
from anon,authenticated;

revoke insert,update,delete on public.payment_transactions
from anon,authenticated;

-- ------------------------------------------------------------
-- 24.16 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.commerce_events') is null then
    raise exception 'STEP 24 failed: commerce_events missing';
  end if;

  if to_regprocedure(
    'public.admin_list_orders(text,commerce_order_status,commerce_payment_status,integer,integer)'
  ) is null then
    raise exception 'STEP 24 failed: admin order list missing';
  end if;

  if to_regprocedure('public.admin_get_order_detail(uuid)') is null then
    raise exception 'STEP 24 failed: admin order detail missing';
  end if;

  if to_regprocedure(
    'public.admin_record_offline_payment(uuid,uuid,text,text)'
  ) is null then
    raise exception 'STEP 24 failed: offline payment RPC missing';
  end if;

  if to_regprocedure(
    'public.admin_review_payment_operation(uuid,boolean,text)'
  ) is null then
    raise exception 'STEP 24 failed: payment review operation missing';
  end if;

  if to_regprocedure(
    'public.admin_commerce_dashboard(timestamptz,timestamptz)'
  ) is null then
    raise exception 'STEP 24 failed: commerce dashboard missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 24 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 24 Transaction & Admin Operations
--
-- NEXT:
-- iMersSUPA - 25 Notification Core
-- ============================================================


-- ===== SOURCE STEP 25: 25-notification-core.sql =====
-- ============================================================
-- iMersSUPA - 25 Notification Core
-- Requires: STEP 17-24
--
-- Scope:
-- - In-app notification inbox
-- - Email / WhatsApp / in-app channel preferences
-- - Dynamic notification templates
-- - Durable outbound notification queue
-- - Commerce event -> notification automation
-- - Admin template/queue operations
-- - BYOK delivery remains provider-neutral
--
-- IMPORTANT:
-- This step does NOT call an external email/WA provider from SQL.
-- Trusted server/Edge Function/worker consumes notification_outbox.
-- Provider configuration is handled in STEP 26.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 25.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.orders') is null
     or to_regclass('public.commerce_events') is null
     or to_regprocedure('public.is_imerssupa_admin()') is null then
    raise exception 'STEP 25 requires STEP 17-24';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 25.2 ENUMS
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type where typname='notification_channel'
  ) then
    create type public.notification_channel as enum (
      'in_app','email','whatsapp'
    );
  end if;

  if not exists (
    select 1 from pg_type where typname='notification_outbox_status'
  ) then
    create type public.notification_outbox_status as enum (
      'queued','processing','sent','failed','cancelled'
    );
  end if;
end
$$;

-- ------------------------------------------------------------
-- 25.3 NOTIFICATION TEMPLATES
-- ------------------------------------------------------------

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),

  event_key text not null,
  channel public.notification_channel not null,

  name text not null,
  subject_template text,
  body_template text not null,

  active boolean not null default true,
  sort_order integer not null default 0,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(event_key,channel),

  constraint notification_templates_event_key_format
    check (event_key ~ '^[a-z0-9_.-]{2,100}$')
);

-- ------------------------------------------------------------
-- 25.4 MEMBER CHANNEL PREFERENCES
-- Transactional in-app notifications remain allowed even if outbound
-- channels are disabled.
-- ------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key
    references public.profiles(id) on delete cascade,

  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,

  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 25.5 IN-APP NOTIFICATIONS
-- ------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  order_id uuid
    references public.orders(id) on delete set null,

  event_key text not null,
  title text not null,
  body text not null,

  action_url text,
  metadata jsonb not null default '{}'::jsonb,

  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_event_key_format
    check (event_key ~ '^[a-z0-9_.-]{2,100}$')
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id,created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id,created_at desc)
  where read_at is null;

-- ------------------------------------------------------------
-- 25.6 OUTBOUND QUEUE
-- Snapshot rendered content at queue time so later template edits do not
-- mutate messages already queued.
-- ------------------------------------------------------------

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id) on delete set null,

  order_id uuid
    references public.orders(id) on delete set null,

  event_key text not null,
  channel public.notification_channel not null
    check (channel in ('email','whatsapp')),

  recipient text not null,
  subject text,
  body text not null,

  status public.notification_outbox_status not null default 'queued',

  provider_name text,
  provider_message_id text,

  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),

  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,

  last_error text,
  sent_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_outbox_event_key_format
    check (event_key ~ '^[a-z0-9_.-]{2,100}$')
);

create index if not exists notification_outbox_worker_idx
  on public.notification_outbox(status,next_attempt_at,created_at)
  where status in ('queued','failed');

create index if not exists notification_outbox_order_idx
  on public.notification_outbox(order_id,created_at desc);

-- ------------------------------------------------------------
-- 25.7 UPDATED_AT TRIGGERS
-- ------------------------------------------------------------

drop trigger if exists trg_notification_templates_updated_at
on public.notification_templates;

create trigger trg_notification_templates_updated_at
before update on public.notification_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_updated_at
on public.notification_preferences;

create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_outbox_updated_at
on public.notification_outbox;

create trigger trg_notification_outbox_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 25.8 SIMPLE TEMPLATE RENDERER
-- Supported placeholders are supplied by JSON context.
-- Example: {{name}}, {{order_number}}, {{amount}}
-- ------------------------------------------------------------

create or replace function public.render_notification_template(
  p_template text,
  p_context jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_result text := coalesce(p_template,'');
  v_key text;
  v_value text;
begin
  for v_key,v_value in
    select key,value
    from jsonb_each_text(coalesce(p_context,'{}'::jsonb))
  loop
    v_result := replace(
      v_result,
      '{{'||v_key||'}}',
      coalesce(v_value,'')
    );
  end loop;

  return v_result;
end;
$$;

revoke all on function public.render_notification_template(text,jsonb)
from public;

-- ------------------------------------------------------------
-- 25.9 SEED DEFAULT TRANSACTIONAL TEMPLATES
-- Admin can edit these later; no provider is hardcoded.
-- ------------------------------------------------------------

insert into public.notification_templates(
  event_key,channel,name,subject_template,body_template,active,sort_order
)
values
(
  'order.created','in_app','Order Created',null,
  'Pesanan {{order_number}} berhasil dibuat. Total pembayaran {{grand_total}} {{currency}}.',
  true,10
),
(
  'payment.waiting_verification','in_app','Payment Waiting Verification',null,
  'Bukti pembayaran untuk pesanan {{order_number}} sudah diterima dan sedang menunggu verifikasi.',
  true,20
),
(
  'payment.approved','in_app','Payment Approved',null,
  'Pembayaran pesanan {{order_number}} sudah dikonfirmasi.',
  true,30
),
(
  'payment.rejected','in_app','Payment Rejected',null,
  'Pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',
  true,40
),
(
  'order.completed','in_app','Order Completed',null,
  'Pesanan {{order_number}} selesai. Produk sudah tersedia di member area.',
  true,50
),
(
  'order.cancelled','in_app','Order Cancelled',null,
  'Pesanan {{order_number}} telah dibatalkan.',
  true,60
),
(
  'order.refunded','in_app','Order Refunded',null,
  'Pesanan {{order_number}} telah direfund.',
  true,70
),
(
  'order.completed','email','Order Completed Email',
  'Akses produk {{order_number}} sudah aktif',
  'Halo {{name}}, pembayaran pesanan {{order_number}} sudah selesai dan produk Anda sudah tersedia di member area.',
  true,80
),
(
  'order.completed','whatsapp','Order Completed WhatsApp',null,
  'Halo {{name}}, pembayaran pesanan {{order_number}} sudah selesai. Produk Anda sudah tersedia di member area.',
  true,90
)
on conflict(event_key,channel) do nothing;

-- ------------------------------------------------------------
-- 25.10 PRIVATE NOTIFICATION DISPATCHER
-- Builds in-app + outbound queue from one event.
-- ------------------------------------------------------------

create or replace function public.queue_user_notification(
  p_user_id uuid,
  p_order_id uuid,
  p_event_key text,
  p_context jsonb default '{}'::jsonb,
  p_action_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pref public.notification_preferences%rowtype;
  v_template public.notification_templates%rowtype;
  v_title text;
  v_body text;
  v_email text;
  v_phone text;
  v_in_app_count integer := 0;
  v_outbox_count integer := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('in_app',0,'outbox',0);
  end if;

  select * into v_profile
  from public.profiles
  where id=p_user_id;

  if not found then
    return jsonb_build_object('in_app',0,'outbox',0);
  end if;

  insert into public.notification_preferences(user_id)
  values(p_user_id)
  on conflict(user_id) do nothing;

  select * into v_pref
  from public.notification_preferences
  where user_id=p_user_id;

  -- Resolve email/phone from profile if those columns exist.
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='email'
  ) then
    execute 'select email from public.profiles where id=$1'
    into v_email using p_user_id;
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='phone'
  ) then
    execute 'select phone from public.profiles where id=$1'
    into v_phone using p_user_id;
  end if;

  -- Fallback recipient data from order snapshot.
  if p_order_id is not null then
    select
      coalesce(v_email,o.buyer_email),
      coalesce(v_phone,o.buyer_phone)
    into v_email,v_phone
    from public.orders o
    where o.id=p_order_id;
  end if;

  for v_template in
    select *
    from public.notification_templates
    where event_key=p_event_key
      and active=true
    order by sort_order,id
  loop
    v_title := public.render_notification_template(
      coalesce(v_template.subject_template,v_template.name),
      p_context
    );
    v_body := public.render_notification_template(
      v_template.body_template,p_context
    );

    if v_template.channel='in_app' and v_pref.in_app_enabled then
      insert into public.notifications(
        user_id,order_id,event_key,title,body,action_url,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,
        v_title,v_body,p_action_url,coalesce(p_context,'{}'::jsonb)
      );
      v_in_app_count:=v_in_app_count+1;

    elsif v_template.channel='email'
          and v_pref.email_enabled
          and nullif(trim(coalesce(v_email,'')),'') is not null then
      insert into public.notification_outbox(
        user_id,order_id,event_key,channel,
        recipient,subject,body,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,'email',
        lower(trim(v_email)),v_title,v_body,coalesce(p_context,'{}'::jsonb)
      );
      v_outbox_count:=v_outbox_count+1;

    elsif v_template.channel='whatsapp'
          and v_pref.whatsapp_enabled
          and nullif(trim(coalesce(v_phone,'')),'') is not null then
      insert into public.notification_outbox(
        user_id,order_id,event_key,channel,
        recipient,subject,body,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,'whatsapp',
        trim(v_phone),null,v_body,coalesce(p_context,'{}'::jsonb)
      );
      v_outbox_count:=v_outbox_count+1;
    end if;
  end loop;

  return jsonb_build_object(
    'in_app',v_in_app_count,
    'outbox',v_outbox_count
  );
end;
$$;

revoke all on function public.queue_user_notification(
  uuid,uuid,text,jsonb,text
) from public;

-- ------------------------------------------------------------
-- 25.11 COMMERCE EVENT -> MEMBER NOTIFICATION
-- ------------------------------------------------------------

create or replace function public.notify_from_commerce_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_event_key text;
  v_context jsonb;
begin
  if new.order_id is null then
    return new;
  end if;

  select * into v_order
  from public.orders
  where id=new.order_id;

  if not found or v_order.buyer_user_id is null then
    return new;
  end if;

  v_event_key :=
    case new.event_type
      when 'payment.approved' then 'payment.approved'
      when 'payment.rejected' then 'payment.rejected'
      when 'order.cancelled' then 'order.cancelled'
      when 'order.refunded' then 'order.refunded'
      else null
    end;

  if v_event_key is null then
    return new;
  end if;

  v_context := jsonb_build_object(
    'name',v_order.buyer_name,
    'order_number',v_order.order_number,
    'grand_total',v_order.grand_total::text,
    'currency',v_order.currency,
    'message',coalesce(new.message,'')
  );

  perform public.queue_user_notification(
    v_order.buyer_user_id,
    v_order.id,
    v_event_key,
    v_context,
    '/member'
  );

  return new;
end;
$$;

drop trigger if exists trg_commerce_event_notification
on public.commerce_events;

create trigger trg_commerce_event_notification
after insert on public.commerce_events
for each row execute function public.notify_from_commerce_event();

-- ------------------------------------------------------------
-- 25.12 ORDER COMPLETION -> NOTIFICATION
-- STEP21 settlement changes order to completed. This trigger catches it
-- independently of admin/manual/gateway payment path.
-- ------------------------------------------------------------

create or replace function public.notify_order_completed()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_context jsonb;
begin
  if old.status is distinct from new.status
     and new.status='completed'
     and new.buyer_user_id is not null then

    v_context := jsonb_build_object(
      'name',new.buyer_name,
      'order_number',new.order_number,
      'grand_total',new.grand_total::text,
      'currency',new.currency
    );

    perform public.queue_user_notification(
      new.buyer_user_id,
      new.id,
      'order.completed',
      v_context,
      '/member'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_completed_notification
on public.orders;

create trigger trg_order_completed_notification
after update of status on public.orders
for each row
when (new.status='completed')
execute function public.notify_order_completed();

-- ------------------------------------------------------------
-- 25.13 MEMBER NOTIFICATION RPCs
-- ------------------------------------------------------------

create or replace function public.get_my_notifications(
  p_limit integer default 30,
  p_offset integer default 0,
  p_unread_only boolean default false
)
returns table(
  id uuid,
  event_key text,
  title text,
  body text,
  action_url text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz,
  total_rows bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),100);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    n.id,n.event_key,n.title,n.body,n.action_url,n.metadata,
    n.read_at,n.created_at,
    count(*) over() as total_rows
  from public.notifications n
  where n.user_id=auth.uid()
    and (not p_unread_only or n.read_at is null)
  order by n.created_at desc,n.id desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_my_notifications(integer,integer,boolean)
from public;
grant execute on function public.get_my_notifications(integer,integer,boolean)
to authenticated;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id
    and user_id=auth.uid();

  if not found then
    raise exception 'Notification not found';
  end if;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid)
to authenticated;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
  set read_at=now()
  where user_id=auth.uid()
    and read_at is null;

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read()
to authenticated;

create or replace function public.update_my_notification_preferences(
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_whatsapp_enabled boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notification_preferences(
    user_id,in_app_enabled,email_enabled,whatsapp_enabled
  )
  values(
    auth.uid(),
    coalesce(p_in_app_enabled,true),
    coalesce(p_email_enabled,true),
    coalesce(p_whatsapp_enabled,false)
  )
  on conflict(user_id) do update
  set in_app_enabled=excluded.in_app_enabled,
      email_enabled=excluded.email_enabled,
      whatsapp_enabled=excluded.whatsapp_enabled;
end;
$$;

revoke all on function public.update_my_notification_preferences(
  boolean,boolean,boolean
) from public;
grant execute on function public.update_my_notification_preferences(
  boolean,boolean,boolean
) to authenticated;

-- ------------------------------------------------------------
-- 25.14 ADMIN TEMPLATE UPSERT
-- ------------------------------------------------------------

create or replace function public.admin_upsert_notification_template(
  p_id uuid,
  p_event_key text,
  p_channel public.notification_channel,
  p_name text,
  p_subject_template text,
  p_body_template text,
  p_active boolean default true,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(coalesce(p_event_key,'')),'') is null
     or nullif(trim(coalesce(p_name,'')),'') is null
     or nullif(trim(coalesce(p_body_template,'')),'') is null then
    raise exception 'Event key, name and body template are required';
  end if;

  if p_id is null then
    insert into public.notification_templates(
      event_key,channel,name,subject_template,body_template,
      active,sort_order,created_by
    )
    values(
      lower(trim(p_event_key)),p_channel,trim(p_name),
      nullif(p_subject_template,''),p_body_template,
      coalesce(p_active,true),coalesce(p_sort_order,0),auth.uid()
    )
    returning id into v_id;
  else
    update public.notification_templates
    set event_key=lower(trim(p_event_key)),
        channel=p_channel,
        name=trim(p_name),
        subject_template=nullif(p_subject_template,''),
        body_template=p_body_template,
        active=coalesce(p_active,true),
        sort_order=coalesce(p_sort_order,0)
    where id=p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Notification template not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_notification_template(
  uuid,text,public.notification_channel,text,text,text,boolean,integer
) from public;
grant execute on function public.admin_upsert_notification_template(
  uuid,text,public.notification_channel,text,text,text,boolean,integer
) to authenticated;

-- ------------------------------------------------------------
-- 25.15 TRUSTED OUTBOX WORKER RPCs
-- service_role only
-- ------------------------------------------------------------

create or replace function public.claim_notification_outbox(
  p_worker_id text,
  p_limit integer default 20
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,20),1),100);
begin
  if nullif(trim(coalesce(p_worker_id,'')),'') is null then
    raise exception 'Worker id is required';
  end if;

  return query
  with picked as (
    select id
    from public.notification_outbox
    where status in ('queued','failed')
      and next_attempt_at<=now()
      and attempt_count<max_attempts
      and (
        locked_at is null
        or locked_at < now()-interval '15 minutes'
      )
    order by next_attempt_at,created_at
    for update skip locked
    limit v_limit
  )
  update public.notification_outbox o
  set status='processing',
      locked_at=now(),
      locked_by=left(trim(p_worker_id),100),
      attempt_count=o.attempt_count+1
  from picked
  where o.id=picked.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_outbox(text,integer)
from public;
grant execute on function public.claim_notification_outbox(text,integer)
to service_role;

create or replace function public.complete_notification_outbox(
  p_outbox_id uuid,
  p_success boolean,
  p_provider_name text default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_retry_after_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.notification_outbox%rowtype;
begin
  select * into v_row
  from public.notification_outbox
  where id=p_outbox_id
  for update;

  if not found then
    raise exception 'Outbox message not found';
  end if;

  if p_success then
    update public.notification_outbox
    set status='sent',
        provider_name=nullif(trim(coalesce(p_provider_name,'')),''),
        provider_message_id=nullif(trim(coalesce(p_provider_message_id,'')),''),
        last_error=null,
        sent_at=now(),
        locked_at=null,
        locked_by=null
    where id=p_outbox_id;
  else
    update public.notification_outbox
    set status=case
          when attempt_count>=max_attempts then 'failed'
          else 'failed'
        end,
        provider_name=coalesce(
          nullif(trim(coalesce(p_provider_name,'')),''),
          provider_name
        ),
        last_error=left(coalesce(p_error,'Unknown provider error'),2000),
        next_attempt_at=case
          when attempt_count>=max_attempts then next_attempt_at
          else now()+make_interval(
            secs=>least(greatest(coalesce(p_retry_after_seconds,300),60),86400)
          )
        end,
        locked_at=null,
        locked_by=null
    where id=p_outbox_id;
  end if;
end;
$$;

revoke all on function public.complete_notification_outbox(
  uuid,boolean,text,text,text,integer
) from public;
grant execute on function public.complete_notification_outbox(
  uuid,boolean,text,text,text,integer
) to service_role;

-- ------------------------------------------------------------
-- 25.16 ADMIN OUTBOX RETRY
-- ------------------------------------------------------------

create or replace function public.admin_retry_notification(
  p_outbox_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  update public.notification_outbox
  set status='queued',
      next_attempt_at=now(),
      locked_at=null,
      locked_by=null,
      last_error=null
  where id=p_outbox_id
    and status in ('failed','cancelled');

  if not found then
    raise exception 'Notification cannot be retried';
  end if;
end;
$$;

revoke all on function public.admin_retry_notification(uuid) from public;
grant execute on function public.admin_retry_notification(uuid)
to authenticated;

-- ------------------------------------------------------------
-- 25.17 RLS
-- ------------------------------------------------------------

alter table public.notification_templates enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists "notification_templates_admin_read"
on public.notification_templates;
drop policy if exists "notification_preferences_owner_read"
on public.notification_preferences;
drop policy if exists "notification_preferences_admin_read"
on public.notification_preferences;
drop policy if exists "notifications_owner_read"
on public.notifications;
drop policy if exists "notifications_admin_read"
on public.notifications;
drop policy if exists "notification_outbox_admin_read"
on public.notification_outbox;

create policy "notification_templates_admin_read"
on public.notification_templates
for select to authenticated
using (public.is_imerssupa_admin());

create policy "notification_preferences_owner_read"
on public.notification_preferences
for select to authenticated
using (user_id=auth.uid());

create policy "notification_preferences_admin_read"
on public.notification_preferences
for select to authenticated
using (public.is_imerssupa_admin());

create policy "notifications_owner_read"
on public.notifications
for select to authenticated
using (user_id=auth.uid());

create policy "notifications_admin_read"
on public.notifications
for select to authenticated
using (public.is_imerssupa_admin());

create policy "notification_outbox_admin_read"
on public.notification_outbox
for select to authenticated
using (public.is_imerssupa_admin());

revoke all on public.notification_templates from anon,authenticated;
revoke all on public.notification_preferences from anon,authenticated;
revoke all on public.notifications from anon,authenticated;
revoke all on public.notification_outbox from anon,authenticated;

grant select on public.notification_templates to authenticated;
grant select on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant select on public.notification_outbox to authenticated;

-- ------------------------------------------------------------
-- 25.18 ADMIN SUMMARY
-- ------------------------------------------------------------

create or replace view public.admin_notification_summary
with (security_invoker=true)
as
select
  (select count(*) from public.notifications)::bigint
    as total_in_app,
  (select count(*) from public.notifications where read_at is null)::bigint
    as unread_in_app,
  (select count(*) from public.notification_outbox where status='queued')::bigint
    as queued_outbound,
  (select count(*) from public.notification_outbox where status='processing')::bigint
    as processing_outbound,
  (select count(*) from public.notification_outbox where status='failed')::bigint
    as failed_outbound,
  (select count(*) from public.notification_outbox where status='sent')::bigint
    as sent_outbound
where public.is_imerssupa_admin();

grant select on public.admin_notification_summary to authenticated;

-- ------------------------------------------------------------
-- 25.19 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.notification_templates') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.notification_outbox') is null then
    raise exception 'STEP 25 failed: notification tables missing';
  end if;

  if to_regprocedure(
    'public.queue_user_notification(uuid,uuid,text,jsonb,text)'
  ) is null then
    raise exception 'STEP 25 failed: queue dispatcher missing';
  end if;

  if to_regprocedure(
    'public.get_my_notifications(integer,integer,boolean)'
  ) is null then
    raise exception 'STEP 25 failed: member notification RPC missing';
  end if;

  if to_regprocedure(
    'public.claim_notification_outbox(text,integer)'
  ) is null then
    raise exception 'STEP 25 failed: outbox worker RPC missing';
  end if;

  if has_table_privilege(
    'authenticated','public.notification_outbox','INSERT'
  ) then
    raise exception 'STEP 25 failed: direct outbox insert still granted';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 25 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 25 Notification Core
--
-- NEXT:
-- iMersSUPA - 26 Platform Commerce Settings
-- ============================================================


-- ===== SOURCE STEP 26: 26-platform-commerce-settings.sql =====
-- ============================================================
-- iMersSUPA - 26 Platform Commerce Settings
-- Requires: STEP 17-25
--
-- Scope:
-- - Central commerce/checkout configuration
-- - Provider-neutral Email & WhatsApp BYOK configuration
-- - Secrets isolated from browser-readable settings
-- - Public-safe checkout configuration RPC
-- - Admin settings RPCs
-- - Trusted service_role provider configuration RPC
-- - Order expiry defaults for new checkout orders
--
-- IMPORTANT:
-- Secret credentials are NEVER returned to anon/authenticated clients.
-- STEP 25 outbox worker remains the delivery queue.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 26.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.notification_outbox') is null
     or to_regclass('public.platform_settings') is null
     or to_regprocedure('public.is_imerssupa_admin()') is null
     or to_regprocedure(
       'public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)'
     ) is null then
    raise exception 'STEP 26 requires STEP 17-25';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 26.2 COMMERCE SETTINGS
-- Singleton row. Public fields are exposed only through a safe RPC.
-- ------------------------------------------------------------

create table if not exists public.commerce_settings (
  id smallint primary key default 1 check (id=1),

  commerce_enabled boolean not null default true,
  checkout_enabled boolean not null default true,

  currency text not null default 'IDR',
  order_expiry_minutes integer not null default 1440
    check (order_expiry_minutes between 5 and 10080),

  require_buyer_phone boolean not null default false,
  allow_guest_checkout boolean not null default true,

  checkout_title text not null default 'Checkout',
  checkout_description text,
  checkout_success_message text
    not null default 'Pembayaran berhasil. Produk Anda siap diakses.',

  support_email text,
  support_whatsapp text,

  terms_url text,
  privacy_url text,

  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.commerce_settings(id)
values(1)
on conflict(id) do nothing;

-- ------------------------------------------------------------
-- 26.3 PROVIDER CONFIG
--
-- public_config: non-secret operational metadata.
-- secret_config: tokens/API keys/passwords, service_role only.
-- No browser role gets SELECT on this table.
-- ------------------------------------------------------------

create table if not exists public.communication_providers (
  id uuid primary key default gen_random_uuid(),

  channel public.notification_channel not null
    check (channel in ('email','whatsapp')),

  provider_code text not null,
  provider_name text not null,

  active boolean not null default false,
  is_default boolean not null default false,

  public_config jsonb not null default '{}'::jsonb,
  secret_config jsonb not null default '{}'::jsonb,

  sender_name text,
  sender_address text,

  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(channel,provider_code),

  constraint communication_providers_code_format
    check (
      provider_code=lower(provider_code)
      and provider_code ~ '^[a-z0-9_-]{2,50}$'
    )
);

create unique index if not exists communication_providers_one_default_idx
  on public.communication_providers(channel)
  where is_default=true and active=true;

create index if not exists communication_providers_channel_active_idx
  on public.communication_providers(channel,active);

-- ------------------------------------------------------------
-- 26.4 UPDATED_AT
-- ------------------------------------------------------------

drop trigger if exists trg_commerce_settings_updated_at
on public.commerce_settings;

create trigger trg_commerce_settings_updated_at
before update on public.commerce_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_communication_providers_updated_at
on public.communication_providers;

create trigger trg_communication_providers_updated_at
before update on public.communication_providers
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 26.5 PROVIDER NORMALIZATION
-- ------------------------------------------------------------

create or replace function public.normalize_communication_provider()
returns trigger
language plpgsql
as $$
begin
  new.provider_code:=lower(trim(new.provider_code));
  new.provider_name:=trim(new.provider_name);

  if new.provider_name='' then
    raise exception 'Provider name is required';
  end if;

  if new.is_default and not new.active then
    raise exception 'Default provider must be active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_communication_provider
on public.communication_providers;

create trigger trg_normalize_communication_provider
before insert or update on public.communication_providers
for each row execute function public.normalize_communication_provider();

-- ------------------------------------------------------------
-- 26.6 PUBLIC SAFE COMMERCE SETTINGS
-- ------------------------------------------------------------

create or replace function public.get_public_commerce_settings()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.commerce_settings%rowtype;
begin
  select * into v
  from public.commerce_settings
  where id=1;

  return jsonb_build_object(
    'commerce_enabled',v.commerce_enabled,
    'checkout_enabled',v.checkout_enabled,
    'currency',v.currency,
    'order_expiry_minutes',v.order_expiry_minutes,
    'require_buyer_phone',v.require_buyer_phone,
    'allow_guest_checkout',v.allow_guest_checkout,
    'checkout_title',v.checkout_title,
    'checkout_description',v.checkout_description,
    'checkout_success_message',v.checkout_success_message,
    'support_email',v.support_email,
    'support_whatsapp',v.support_whatsapp,
    'terms_url',v.terms_url,
    'privacy_url',v.privacy_url
  );
end;
$$;

revoke all on function public.get_public_commerce_settings() from public;
grant execute on function public.get_public_commerce_settings()
to anon,authenticated;

-- ------------------------------------------------------------
-- 26.7 ADMIN COMMERCE SETTINGS
-- ------------------------------------------------------------

create or replace function public.admin_update_commerce_settings(
  p_commerce_enabled boolean,
  p_checkout_enabled boolean,
  p_currency text,
  p_order_expiry_minutes integer,
  p_require_buyer_phone boolean,
  p_allow_guest_checkout boolean,
  p_checkout_title text,
  p_checkout_description text,
  p_checkout_success_message text,
  p_support_email text,
  p_support_whatsapp text,
  p_terms_url text,
  p_privacy_url text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.commerce_settings%rowtype;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(trim(coalesce(p_currency,'')),'') is null
     or length(trim(p_currency))>10 then
    raise exception 'Invalid currency';
  end if;

  if p_order_expiry_minutes<5 or p_order_expiry_minutes>10080 then
    raise exception 'Order expiry must be between 5 and 10080 minutes';
  end if;

  if nullif(trim(coalesce(p_checkout_title,'')),'') is null then
    raise exception 'Checkout title is required';
  end if;

  update public.commerce_settings
  set commerce_enabled=coalesce(p_commerce_enabled,true),
      checkout_enabled=coalesce(p_checkout_enabled,true),
      currency=upper(trim(p_currency)),
      order_expiry_minutes=p_order_expiry_minutes,
      require_buyer_phone=coalesce(p_require_buyer_phone,false),
      allow_guest_checkout=coalesce(p_allow_guest_checkout,true),
      checkout_title=left(trim(p_checkout_title),200),
      checkout_description=nullif(left(trim(coalesce(p_checkout_description,'')),2000),''),
      checkout_success_message=left(
        coalesce(nullif(trim(coalesce(p_checkout_success_message,'')),''),
                 'Pembayaran berhasil. Produk Anda siap diakses.'),
        2000
      ),
      support_email=nullif(left(trim(coalesce(p_support_email,'')),254),''),
      support_whatsapp=nullif(left(trim(coalesce(p_support_whatsapp,'')),50),''),
      terms_url=nullif(left(trim(coalesce(p_terms_url,'')),2000),''),
      privacy_url=nullif(left(trim(coalesce(p_privacy_url,'')),2000),''),
      updated_by=auth.uid()
  where id=1
  returning * into v;

  return public.get_public_commerce_settings();
end;
$$;

revoke all on function public.admin_update_commerce_settings(
  boolean,boolean,text,integer,boolean,boolean,text,text,text,text,text,text,text
) from public;
grant execute on function public.admin_update_commerce_settings(
  boolean,boolean,text,integer,boolean,boolean,text,text,text,text,text,text,text
) to authenticated;

-- ------------------------------------------------------------
-- 26.8 ADMIN PROVIDER UPSERT
--
-- Admin browser may create/update provider metadata but MUST NOT receive
-- stored secret_config. Secret input can be supplied to this RPC and is
-- written server-side; output only reports whether a secret exists.
-- Empty/null secret preserves the existing secret on update.
-- ------------------------------------------------------------

create or replace function public.admin_upsert_communication_provider(
  p_id uuid,
  p_channel public.notification_channel,
  p_provider_code text,
  p_provider_name text,
  p_active boolean,
  p_is_default boolean,
  p_public_config jsonb default '{}'::jsonb,
  p_secret_config jsonb default null,
  p_sender_name text default null,
  p_sender_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_secret jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if p_channel not in ('email','whatsapp') then
    raise exception 'Only email/whatsapp providers are supported';
  end if;

  if nullif(trim(coalesce(p_provider_code,'')),'') is null
     or nullif(trim(coalesce(p_provider_name,'')),'') is null then
    raise exception 'Provider code and name are required';
  end if;

  if coalesce(p_is_default,false) and not coalesce(p_active,false) then
    raise exception 'Default provider must be active';
  end if;

  if coalesce(p_is_default,false) then
    update public.communication_providers
    set is_default=false,
        updated_by=auth.uid()
    where channel=p_channel
      and is_default=true
      and (p_id is null or id<>p_id);
  end if;

  if p_id is null then
    insert into public.communication_providers(
      channel,provider_code,provider_name,
      active,is_default,public_config,secret_config,
      sender_name,sender_address,created_by,updated_by
    )
    values(
      p_channel,lower(trim(p_provider_code)),trim(p_provider_name),
      coalesce(p_active,false),coalesce(p_is_default,false),
      coalesce(p_public_config,'{}'::jsonb),
      coalesce(p_secret_config,'{}'::jsonb),
      nullif(trim(coalesce(p_sender_name,'')),''),
      nullif(trim(coalesce(p_sender_address,'')),''),
      auth.uid(),auth.uid()
    )
    returning id into v_id;
  else
    select secret_config into v_secret
    from public.communication_providers
    where id=p_id;

    if not found then
      raise exception 'Provider not found';
    end if;

    update public.communication_providers
    set channel=p_channel,
        provider_code=lower(trim(p_provider_code)),
        provider_name=trim(p_provider_name),
        active=coalesce(p_active,false),
        is_default=coalesce(p_is_default,false),
        public_config=coalesce(p_public_config,'{}'::jsonb),
        secret_config=case
          when p_secret_config is null then coalesce(v_secret,'{}'::jsonb)
          else p_secret_config
        end,
        sender_name=nullif(trim(coalesce(p_sender_name,'')),''),
        sender_address=nullif(trim(coalesce(p_sender_address,'')),''),
        updated_by=auth.uid()
    where id=p_id
    returning id into v_id;
  end if;

  return (
    select jsonb_build_object(
      'id',cp.id,
      'channel',cp.channel,
      'provider_code',cp.provider_code,
      'provider_name',cp.provider_name,
      'active',cp.active,
      'is_default',cp.is_default,
      'public_config',cp.public_config,
      'sender_name',cp.sender_name,
      'sender_address',cp.sender_address,
      'has_secret',cp.secret_config<>'{}'::jsonb,
      'created_at',cp.created_at,
      'updated_at',cp.updated_at
    )
    from public.communication_providers cp
    where cp.id=v_id
  );
end;
$$;

revoke all on function public.admin_upsert_communication_provider(
  uuid,public.notification_channel,text,text,boolean,boolean,jsonb,jsonb,text,text
) from public;
grant execute on function public.admin_upsert_communication_provider(
  uuid,public.notification_channel,text,text,boolean,boolean,jsonb,jsonb,text,text
) to authenticated;

-- ------------------------------------------------------------
-- 26.9 ADMIN SAFE PROVIDER LIST
-- Never exposes secret_config.
-- ------------------------------------------------------------

create or replace function public.admin_list_communication_providers()
returns table(
  id uuid,
  channel public.notification_channel,
  provider_code text,
  provider_name text,
  active boolean,
  is_default boolean,
  public_config jsonb,
  sender_name text,
  sender_address text,
  has_secret boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    cp.id,cp.channel,cp.provider_code,cp.provider_name,
    cp.active,cp.is_default,cp.public_config,
    cp.sender_name,cp.sender_address,
    cp.secret_config<>'{}'::jsonb,
    cp.created_at,cp.updated_at
  from public.communication_providers cp
  order by cp.channel,cp.is_default desc,cp.provider_name;
end;
$$;

revoke all on function public.admin_list_communication_providers() from public;
grant execute on function public.admin_list_communication_providers()
to authenticated;

-- ------------------------------------------------------------
-- 26.10 TRUSTED PROVIDER RESOLUTION
-- service_role worker gets the active default config including secret.
-- Browser roles have no EXECUTE permission.
-- ------------------------------------------------------------

create or replace function public.get_default_communication_provider(
  p_channel public.notification_channel
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.communication_providers%rowtype;
begin
  if p_channel not in ('email','whatsapp') then
    raise exception 'Unsupported provider channel';
  end if;

  select * into v
  from public.communication_providers
  where channel=p_channel
    and active=true
  order by is_default desc,updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',v.id,
    'channel',v.channel,
    'provider_code',v.provider_code,
    'provider_name',v.provider_name,
    'public_config',v.public_config,
    'secret_config',v.secret_config,
    'sender_name',v.sender_name,
    'sender_address',v.sender_address
  );
end;
$$;

revoke all on function public.get_default_communication_provider(
  public.notification_channel
) from public;
grant execute on function public.get_default_communication_provider(
  public.notification_channel
) to service_role;

-- ------------------------------------------------------------
-- 26.11 CHECKOUT POLICY VALIDATOR
-- Frontend can call public settings, but secure order creation also needs
-- server-side enforcement. This helper is private.
-- ------------------------------------------------------------

create or replace function public.assert_commerce_checkout_allowed(
  p_buyer_phone text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.commerce_settings%rowtype;
begin
  select * into v
  from public.commerce_settings
  where id=1;

  if not v.commerce_enabled or not v.checkout_enabled then
    raise exception 'Checkout is currently disabled';
  end if;

  if auth.uid() is null and not v.allow_guest_checkout then
    raise exception 'Guest checkout is disabled';
  end if;

  if v.require_buyer_phone
     and nullif(trim(coalesce(p_buyer_phone,'')),'') is null then
    raise exception 'Buyer phone is required';
  end if;
end;
$$;

revoke all on function public.assert_commerce_checkout_allowed(text)
from public;

-- ------------------------------------------------------------
-- 26.12 WRAP SECURE ORDER CREATION WITH COMMERCE SETTINGS
--
-- Rename STEP23 implementation once, then recreate the public signature
-- as a policy-enforcing wrapper. Existing frontend RPC name stays stable.
-- ------------------------------------------------------------

do $$
begin
  if to_regprocedure(
    'public.create_checkout_order_secure_core(jsonb,text,text,text,text,text,text,text)'
  ) is null then
    alter function public.create_checkout_order_secure(
      jsonb,text,text,text,text,text,text,text
    ) rename to create_checkout_order_secure_core;
  end if;
end
$$;

revoke all on function public.create_checkout_order_secure_core(
  jsonb,text,text,text,text,text,text,text
) from public;

create or replace function public.create_checkout_order_secure(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_customer_note text default null,
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
begin
  perform public.assert_commerce_checkout_allowed(p_buyer_phone);

  v_result:=public.create_checkout_order_secure_core(
    p_items,p_buyer_name,p_buyer_email,p_buyer_phone,
    p_coupon_code,p_visitor_key,p_customer_note,p_idempotency_key
  );

  v_order_id:=nullif(v_result->>'order_id','')::uuid;

  -- Do not reset expiry on an idempotent replay.
  if v_order_id is not null
     and coalesce((v_result->>'idempotent_replay')::boolean,false)=false then
    select order_expiry_minutes into v_expiry
    from public.commerce_settings where id=1;

    update public.orders
    set expires_at=now()+make_interval(mins=>v_expiry)
    where id=v_order_id
      and payment_status in ('unpaid','pending');
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) from public;
grant execute on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) to anon,authenticated;

-- ------------------------------------------------------------
-- 26.13 RLS + PRIVILEGE HARDENING
-- ------------------------------------------------------------

alter table public.commerce_settings enable row level security;
alter table public.communication_providers enable row level security;

drop policy if exists "commerce_settings_admin_read"
on public.commerce_settings;

create policy "commerce_settings_admin_read"
on public.commerce_settings
for select to authenticated
using (public.is_imerssupa_admin());

-- No SELECT policy at all for communication_providers:
-- browser roles use safe RPCs only.
revoke all on public.commerce_settings from anon,authenticated;
revoke all on public.communication_providers from anon,authenticated;

grant select on public.commerce_settings to authenticated;

-- ------------------------------------------------------------
-- 26.14 ADMIN PROVIDER SUMMARY
-- Safe view: no public_config and absolutely no secret_config.
-- ------------------------------------------------------------

create or replace view public.admin_communication_provider_summary
with (security_invoker=true)
as
select
  cp.channel,
  count(*)::bigint as provider_count,
  count(*) filter (where cp.active)::bigint as active_count,
  count(*) filter (where cp.active and cp.is_default)::bigint
    as default_count
from public.communication_providers cp
where public.is_imerssupa_admin()
group by cp.channel;

-- View uses security_invoker; direct table SELECT is intentionally absent.
-- Therefore prefer admin_list_communication_providers() for UI data.
revoke all on public.admin_communication_provider_summary
from anon,authenticated;

-- ------------------------------------------------------------
-- 26.15 FINAL CHECK
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.commerce_settings') is null
     or to_regclass('public.communication_providers') is null then
    raise exception 'STEP 26 failed: settings/provider tables missing';
  end if;

  if to_regprocedure('public.get_public_commerce_settings()') is null then
    raise exception 'STEP 26 failed: public commerce settings RPC missing';
  end if;

  if to_regprocedure(
    'public.admin_upsert_communication_provider(uuid,notification_channel,text,text,boolean,boolean,jsonb,jsonb,text,text)'
  ) is null then
    raise exception 'STEP 26 failed: provider admin RPC missing';
  end if;

  if to_regprocedure(
    'public.get_default_communication_provider(notification_channel)'
  ) is null then
    raise exception 'STEP 26 failed: trusted provider resolver missing';
  end if;

  if has_table_privilege(
    'authenticated','public.communication_providers','SELECT'
  ) or has_table_privilege(
    'anon','public.communication_providers','SELECT'
  ) then
    raise exception 'STEP 26 failed: provider secret table is browser-readable';
  end if;

  if not has_function_privilege(
    'anon',
    'public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'STEP 26 failed: secure checkout wrapper not executable';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 26 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 26 Platform Commerce Settings
--
-- NEXT:
-- iMersSUPA - 27 Audit Cleanup & Security Hardening
-- ============================================================


-- ===== SOURCE STEP 27: 27-audit-cleanup-security-hardening.sql =====
-- ============================================================
-- iMersSUPA - 27 Audit Cleanup & Security Hardening
-- Requires: STEP 17-26
--
-- Final hardening before STEP 28 verification:
-- - Expire stale unpaid orders safely
-- - Release stale coupon reservations
-- - Cancel stale payment attempts
-- - Recover abandoned notification worker locks
-- - Security audit log
-- - Admin operational audit RPC
-- - Revoke legacy browser RPCs / direct writes
-- - Normalize SECURITY DEFINER search_path
-- - Add useful maintenance indexes
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 27.1 PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.coupon_redemptions') is null
     or to_regclass('public.notification_outbox') is null
     or to_regclass('public.communication_providers') is null
     or to_regprocedure('public.is_imerssupa_admin()') is null then
    raise exception 'STEP 27 requires STEP 17-26';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 27.2 SECURITY AUDIT LOG
-- ------------------------------------------------------------

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_key text not null,
  target_type text,
  target_id text,
  severity text not null default 'info'
    check (severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_event_format
    check (event_key ~ '^[a-z0-9_.-]{2,100}$')
);

create index if not exists security_audit_log_created_idx
  on public.security_audit_log(created_at desc);

create index if not exists security_audit_log_event_idx
  on public.security_audit_log(event_key,created_at desc);

create or replace function public.write_security_audit(
  p_event_key text,
  p_target_type text default null,
  p_target_id text default null,
  p_severity text default 'info',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if p_severity not in ('info','warning','critical') then
    raise exception 'Invalid audit severity';
  end if;

  insert into public.security_audit_log(
    actor_user_id,event_key,target_type,target_id,severity,metadata
  )
  values(
    auth.uid(),lower(trim(p_event_key)),
    nullif(trim(coalesce(p_target_type,'')),''),
    nullif(trim(coalesce(p_target_id,'')),''),
    p_severity,coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_security_audit(
  text,text,text,text,jsonb
) from public;

-- ------------------------------------------------------------
-- 27.3 EXPIRE STALE ORDERS
-- Idempotent. No cron dependency: can be called by trusted worker/admin.
-- ------------------------------------------------------------

create or replace function public.expire_stale_orders(
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit,500),1),2000);
  v_ids uuid[];
  v_count integer := 0;
begin
  select coalesce(array_agg(id),'{}'::uuid[])
  into v_ids
  from (
    select o.id
    from public.orders o
    where o.expires_at is not null
      and o.expires_at<=now()
      and o.payment_status in ('unpaid','pending')
      and o.status in ('pending','awaiting_payment')
    order by o.expires_at,o.id
    for update skip locked
    limit v_limit
  ) q;

  if coalesce(array_length(v_ids,1),0)=0 then
    return jsonb_build_object('expired_orders',0);
  end if;

  update public.payment_transactions
  set status='expired'
  where order_id=any(v_ids)
    and status in ('pending','waiting_verification');

  update public.coupon_redemptions
  set status='released'
  where commerce_order_id=any(v_ids)
    and status='reserved';

  update public.orders
  set status='expired',
      payment_status='expired'
  where id=any(v_ids);

  get diagnostics v_count=row_count;

  return jsonb_build_object('expired_orders',v_count);
end;
$$;

revoke all on function public.expire_stale_orders(integer) from public;
grant execute on function public.expire_stale_orders(integer)
to service_role;

-- Admin can run cleanup manually from future maintenance UI.
create or replace function public.admin_expire_stale_orders(
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  v_result:=public.expire_stale_orders(p_limit);

  perform public.write_security_audit(
    'maintenance.expire_stale_orders',
    'orders',null,'info',v_result
  );

  return v_result;
end;
$$;

revoke all on function public.admin_expire_stale_orders(integer) from public;
grant execute on function public.admin_expire_stale_orders(integer)
to authenticated;

-- ------------------------------------------------------------
-- 27.4 RECOVER ABANDONED NOTIFICATION LOCKS
-- ------------------------------------------------------------

create or replace function public.recover_notification_outbox_locks(
  p_older_than_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_minutes integer :=
    least(greatest(coalesce(p_older_than_minutes,15),5),1440);
  v_count integer;
begin
  update public.notification_outbox
  set status='failed',
      locked_at=null,
      locked_by=null,
      last_error=coalesce(last_error,'Worker lock expired'),
      next_attempt_at=now()
  where status='processing'
    and locked_at < now()-make_interval(mins=>v_minutes);

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.recover_notification_outbox_locks(integer)
from public;
grant execute on function public.recover_notification_outbox_locks(integer)
to service_role;

-- ------------------------------------------------------------
-- 27.5 MAINTENANCE INDEXES
-- ------------------------------------------------------------

create index if not exists orders_expiry_cleanup_idx
  on public.orders(expires_at)
  where payment_status in ('unpaid','pending')
    and status in ('pending','awaiting_payment');

create index if not exists coupon_redemptions_reserved_order_idx
  on public.coupon_redemptions(commerce_order_id)
  where status='reserved';

create index if not exists payment_transactions_order_status_idx
  on public.payment_transactions(order_id,status);

create index if not exists member_access_user_product_idx
  on public.member_access(user_id,product_id);

-- ------------------------------------------------------------
-- 27.6 LEGACY RPC LOCKDOWN
-- Keep definitions for migration history but remove browser execution.
-- ------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'create_checkout_order',
        'get_checkout_order',
        'get_available_payment_methods',
        'select_order_payment_method',
        'submit_manual_payment_proof',
        'get_payment_transaction',
        'cancel_unpaid_order'
      )
  loop
    execute format(
      'revoke execute on function %s from anon, authenticated',
      r.signature
    );
  end loop;
end
$$;

-- ------------------------------------------------------------
-- 27.7 DIRECT WRITE LOCKDOWN
-- Canonical mutations remain RPC/service-role only.
-- ------------------------------------------------------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'orders',
    'order_items',
    'payment_transactions',
    'order_settlements',
    'order_reversals',
    'coupon_redemptions',
    'affiliate_commissions',
    'notification_outbox',
    'commerce_events',
    'security_audit_log',
    'communication_providers'
  ]
  loop
    if to_regclass('public.'||v_table) is not null then
      execute format(
        'revoke insert,update,delete on public.%I from anon,authenticated',
        v_table
      );
    end if;
  end loop;
end
$$;

-- ------------------------------------------------------------
-- 27.8 SECURITY DEFINER SEARCH_PATH HARDENING
-- Normalize all public SECURITY DEFINER functions created by iMersSUPA.
-- This avoids object-shadowing through mutable search_path.
-- ------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef=true
  loop
    execute format(
      'alter function %s set search_path = public',
      r.signature
    );
  end loop;
end
$$;

-- ------------------------------------------------------------
-- 27.9 ADMIN SECURITY / OPERATIONS AUDIT
-- Returns concrete findings rather than silently claiming safety.
-- ------------------------------------------------------------

create or replace function public.admin_backend_security_audit()
returns table(
  check_key text,
  status text,
  detail text
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    'provider_table_browser_select',
    case
      when has_table_privilege(
        'anon','public.communication_providers','SELECT'
      ) or has_table_privilege(
        'authenticated','public.communication_providers','SELECT'
      ) then 'FAIL' else 'PASS'
    end,
    'Communication provider secrets must not be browser-readable';

  return query
  select
    'orders_direct_insert',
    case
      when has_table_privilege('anon','public.orders','INSERT')
        or has_table_privilege('authenticated','public.orders','INSERT')
      then 'FAIL' else 'PASS'
    end,
    'Orders must be created through secure RPC only';

  return query
  select
    'payment_direct_update',
    case
      when has_table_privilege(
        'anon','public.payment_transactions','UPDATE'
      ) or has_table_privilege(
        'authenticated','public.payment_transactions','UPDATE'
      ) then 'FAIL' else 'PASS'
    end,
    'Payment state must not be directly writable by browser roles';

  return query
  select
    'secure_checkout_rpc',
    case
      when has_function_privilege(
        'anon',
        'public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)',
        'EXECUTE'
      ) then 'PASS' else 'FAIL'
    end,
    'Secure checkout RPC must remain available';

  return query
  select
    'provider_service_resolver',
    case
      when has_function_privilege(
        'service_role',
        'public.get_default_communication_provider(notification_channel)',
        'EXECUTE'
      ) then 'PASS' else 'FAIL'
    end,
    'Trusted notification worker must resolve BYOK provider';

  return query
  select
    'legacy_guest_orders',
    case
      when exists(
        select 1 from public.orders
        where buyer_user_id is null
          and checkout_token_hash is null
      ) then 'WARN' else 'PASS'
    end,
    'Pre-STEP23 guest orders without checkout token are legacy records';

  return query
  select
    'stale_orders',
    case
      when exists(
        select 1 from public.orders
        where expires_at<=now()
          and payment_status in ('unpaid','pending')
          and status in ('pending','awaiting_payment')
      ) then 'WARN' else 'PASS'
    end,
    'Expired unpaid orders can be cleaned with admin_expire_stale_orders()';

  return query
  select
    'stuck_notification_workers',
    case
      when exists(
        select 1 from public.notification_outbox
        where status='processing'
          and locked_at < now()-interval '15 minutes'
      ) then 'WARN' else 'PASS'
    end,
    'Stale outbox locks can be recovered by trusted maintenance worker';
end;
$$;

revoke all on function public.admin_backend_security_audit() from public;
grant execute on function public.admin_backend_security_audit()
to authenticated;

-- ------------------------------------------------------------
-- 27.10 ADMIN SECURITY AUDIT VIEW
-- ------------------------------------------------------------

create or replace view public.admin_security_audit_summary
with (security_invoker=true)
as
select
  count(*)::bigint as total_events,
  count(*) filter (
    where severity='warning'
  )::bigint as warning_events,
  count(*) filter (
    where severity='critical'
  )::bigint as critical_events,
  max(created_at) as last_event_at
from public.security_audit_log
where public.is_imerssupa_admin();

-- ------------------------------------------------------------
-- 27.11 RLS
-- ------------------------------------------------------------

alter table public.security_audit_log enable row level security;

drop policy if exists "security_audit_admin_read"
on public.security_audit_log;

create policy "security_audit_admin_read"
on public.security_audit_log
for select
to authenticated
using (public.is_imerssupa_admin());

revoke all on public.security_audit_log from anon,authenticated;
grant select on public.security_audit_log to authenticated;
grant select on public.admin_security_audit_summary to authenticated;

-- ------------------------------------------------------------
-- 27.12 FINAL HARDENING ASSERTIONS
-- ------------------------------------------------------------

do $$
begin
  if has_table_privilege(
    'authenticated','public.communication_providers','SELECT'
  ) or has_table_privilege(
    'anon','public.communication_providers','SELECT'
  ) then
    raise exception
      'STEP 27 failed: communication provider secrets exposed';
  end if;

  if has_table_privilege('authenticated','public.orders','INSERT')
     or has_table_privilege('anon','public.orders','INSERT') then
    raise exception 'STEP 27 failed: direct order INSERT exposed';
  end if;

  if has_table_privilege(
    'authenticated','public.payment_transactions','UPDATE'
  ) or has_table_privilege(
    'anon','public.payment_transactions','UPDATE'
  ) then
    raise exception 'STEP 27 failed: direct payment UPDATE exposed';
  end if;

  if to_regprocedure(
    'public.admin_backend_security_audit()'
  ) is null then
    raise exception 'STEP 27 failed: security audit RPC missing';
  end if;

  if to_regprocedure(
    'public.expire_stale_orders(integer)'
  ) is null then
    raise exception 'STEP 27 failed: expiry maintenance missing';
  end if;
end
$$;

commit;

-- ============================================================
-- STEP 27 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 27 Audit Cleanup & Security Hardening
--
-- NEXT:
-- iMersSUPA - 28 FINAL BACKEND VERIFICATION
-- ============================================================


-- ===== SOURCE STEP 29: 29-notification-schema-fix-demo-seed.sql =====
-- ============================================================
-- iMersSUPA - Notification Templates + Safe Demo Data
-- Compatible with STEP 25 schema.
-- Safe to re-run: templates use ON CONFLICT update; demo rows are
-- deleted/recreated by metadata.demo_seed before insertion.
-- ============================================================

begin;

-- 1) COMPLETE TEMPLATE MATRIX: 7 transactional events x 3 channels = 21
insert into public.notification_templates
(event_key, channel, name, subject_template, body_template, active, sort_order)
values
('order.created','in_app','Order Created',null,'Pesanan {{order_number}} berhasil dibuat. Total pembayaran {{grand_total}} {{currency}}.',true,10),
('order.created','email','Order Created Email','Pesanan {{order_number}} berhasil dibuat','Halo {{name}}, pesanan {{order_number}} berhasil dibuat dengan total {{grand_total}} {{currency}}. Silakan lanjutkan pembayaran.',true,11),
('order.created','whatsapp','Order Created WhatsApp',null,'Halo {{name}}, pesanan {{order_number}} berhasil dibuat. Total: {{grand_total}} {{currency}}. Silakan lanjutkan pembayaran.',true,12),

('payment.waiting_verification','in_app','Payment Waiting Verification',null,'Bukti pembayaran untuk pesanan {{order_number}} sudah diterima dan sedang menunggu verifikasi.',true,20),
('payment.waiting_verification','email','Payment Waiting Verification Email','Pembayaran {{order_number}} sedang diverifikasi','Halo {{name}}, bukti pembayaran pesanan {{order_number}} sudah kami terima dan sedang diverifikasi.',true,21),
('payment.waiting_verification','whatsapp','Payment Waiting Verification WhatsApp',null,'Halo {{name}}, bukti pembayaran pesanan {{order_number}} sudah diterima dan sedang menunggu verifikasi admin.',true,22),

('payment.approved','in_app','Payment Approved',null,'Pembayaran pesanan {{order_number}} sudah dikonfirmasi.',true,30),
('payment.approved','email','Payment Approved Email','Pembayaran {{order_number}} berhasil dikonfirmasi','Halo {{name}}, pembayaran pesanan {{order_number}} sebesar {{grand_total}} {{currency}} sudah dikonfirmasi.',true,31),
('payment.approved','whatsapp','Payment Approved WhatsApp',null,'Halo {{name}}, pembayaran pesanan {{order_number}} sudah dikonfirmasi. Terima kasih.',true,32),

('payment.rejected','in_app','Payment Rejected',null,'Pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,40),
('payment.rejected','email','Payment Rejected Email','Pembayaran {{order_number}} perlu diperiksa kembali','Halo {{name}}, pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,41),
('payment.rejected','whatsapp','Payment Rejected WhatsApp',null,'Halo {{name}}, pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,42),

('order.completed','in_app','Order Completed',null,'Pesanan {{order_number}} selesai. Produk sudah tersedia di member area.',true,50),
('order.completed','email','Order Completed Email','Akses produk {{order_number}} sudah aktif','Halo {{name}}, pembayaran pesanan {{order_number}} selesai dan produk Anda sudah tersedia di member area.',true,51),
('order.completed','whatsapp','Order Completed WhatsApp',null,'Halo {{name}}, pesanan {{order_number}} selesai. Produk Anda sudah tersedia di member area.',true,52),

('order.cancelled','in_app','Order Cancelled',null,'Pesanan {{order_number}} telah dibatalkan.',true,60),
('order.cancelled','email','Order Cancelled Email','Pesanan {{order_number}} dibatalkan','Halo {{name}}, pesanan {{order_number}} telah dibatalkan. Jika membutuhkan bantuan silakan hubungi support.',true,61),
('order.cancelled','whatsapp','Order Cancelled WhatsApp',null,'Halo {{name}}, pesanan {{order_number}} telah dibatalkan.',true,62),

('order.refunded','in_app','Order Refunded',null,'Pesanan {{order_number}} telah direfund.',true,70),
('order.refunded','email','Order Refunded Email','Refund pesanan {{order_number}} diproses','Halo {{name}}, pesanan {{order_number}} telah direfund. Silakan hubungi support bila memerlukan informasi tambahan.',true,71),
('order.refunded','whatsapp','Order Refunded WhatsApp',null,'Halo {{name}}, pesanan {{order_number}} telah direfund.',true,72)
on conflict (event_key, channel) do update
set name=excluded.name,
    subject_template=excluded.subject_template,
    body_template=excluded.body_template,
    active=excluded.active,
    sort_order=excluded.sort_order,
    updated_at=now();

-- 2) DEMO OUTBOX INTENTIONALLY OMITTED
-- Fresh client installs must not contain fake recipients, demo
-- messages, or synthetic notification history.

commit;

-- Verification
select event_key, channel, name, active, sort_order
from public.notification_templates
order by sort_order, channel;



-- ===== SOURCE STEP 30: 30-notification-template-editor-demo-cleanup.sql =====
-- ============================================================
-- iMersSUPA - 30 Notification Template Editor & Demo Cleanup
-- Requires: STEP 01-29
--
-- PURPOSE
-- 1. Keep the 21 default notification templates as editable defaults.
-- 2. Remove ONLY demo notification_outbox rows created by STEP 29.
-- 3. Add a safe admin RPC to edit template copywriting.
-- 4. Keep event_key + channel as immutable trigger identity.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 30.1 CLEAN UP STEP 29 DEMO OUTBOX ONLY
-- Default notification_templates are NOT deleted.
-- ------------------------------------------------------------

delete from public.notification_outbox
where metadata->>'demo_seed' = 'imerssupa_notification_demo_v1';

-- ------------------------------------------------------------
-- 30.2 ADMIN TEMPLATE UPDATE RPC
--
-- Editable:
-- - name
-- - subject_template
-- - body_template
-- - active
--
-- Immutable identity:
-- - event_key
-- - channel
-- ------------------------------------------------------------

create or replace function public.admin_update_notification_template(
  p_event_key text,
  p_channel text,
  p_name text,
  p_subject_template text,
  p_body_template text,
  p_active boolean
)
returns public.notification_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.notification_templates%rowtype;
  v_channel public.notification_channel;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if nullif(btrim(coalesce(p_event_key, '')), '') is null then
    raise exception 'event_key is required';
  end if;

  if nullif(btrim(coalesce(p_channel, '')), '') is null then
    raise exception 'channel is required';
  end if;

  begin
    v_channel := lower(btrim(p_channel))::public.notification_channel;
  exception
    when invalid_text_representation then
      raise exception 'Invalid notification channel: %', p_channel;
  end;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Template name is required';
  end if;

  if nullif(btrim(coalesce(p_body_template, '')), '') is null then
    raise exception 'Template body is required';
  end if;

  update public.notification_templates nt
  set
    name = btrim(p_name),
    subject_template = case
      when v_channel = 'email'::public.notification_channel
        then nullif(btrim(coalesce(p_subject_template, '')), '')
      else nullif(btrim(coalesce(p_subject_template, '')), '')
    end,
    body_template = p_body_template,
    active = coalesce(p_active, true),
    updated_at = now()
  where nt.event_key = btrim(p_event_key)
    and nt.channel = v_channel
  returning nt.* into v_template;

  if not found then
    raise exception 'Notification template not found: % / %',
      p_event_key, p_channel;
  end if;

  return v_template;
end;
$$;

revoke all on function public.admin_update_notification_template(
  text,text,text,text,text,boolean
) from public;

grant execute on function public.admin_update_notification_template(
  text,text,text,text,text,boolean
) to authenticated;

-- ------------------------------------------------------------
-- 30.3 ADMIN TEMPLATE LIST RPC
-- Frontend should use this instead of assuming alternate column names.
-- ------------------------------------------------------------

create or replace function public.admin_list_notification_templates()
returns table(
  id uuid,
  event_key text,
  channel public.notification_channel,
  name text,
  subject_template text,
  body_template text,
  active boolean,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    nt.id,
    nt.event_key,
    nt.channel,
    nt.name,
    nt.subject_template,
    nt.body_template,
    nt.active,
    nt.sort_order,
    nt.created_at,
    nt.updated_at
  from public.notification_templates nt
  order by nt.sort_order asc, nt.channel asc, nt.event_key asc;
end;
$$;

revoke all on function public.admin_list_notification_templates()
from public;

grant execute on function public.admin_list_notification_templates()
to authenticated;

-- ------------------------------------------------------------
-- 30.4 DIRECT WRITE HARDENING
-- Editing goes through admin RPC, not browser table mutation.
-- ------------------------------------------------------------

revoke insert, update, delete on public.notification_templates
from anon, authenticated;

-- Read is still allowed according to existing STEP 25 RLS/grants.
-- No RLS policy is replaced here.

-- ------------------------------------------------------------
-- 30.5 VERIFICATION
-- ------------------------------------------------------------

do $$
declare
  v_template_count bigint;
  v_demo_count bigint;
  v_duplicate_count bigint;
begin
  select count(*)
  into v_template_count
  from public.notification_templates;

  select count(*)
  into v_demo_count
  from public.notification_outbox
  where metadata->>'demo_seed' = 'imerssupa_notification_demo_v1';

  select count(*)
  into v_duplicate_count
  from (
    select event_key, channel
    from public.notification_templates
    group by event_key, channel
    having count(*) > 1
  ) d;

  if v_template_count < 21 then
    raise exception
      'STEP 30 failed: expected at least 21 notification templates, found %',
      v_template_count;
  end if;

  if v_demo_count <> 0 then
    raise exception
      'STEP 30 failed: % STEP 29 demo outbox rows still exist',
      v_demo_count;
  end if;

  if v_duplicate_count <> 0 then
    raise exception
      'STEP 30 failed: % duplicate event_key/channel template pairs found',
      v_duplicate_count;
  end if;

  if to_regprocedure(
    'public.admin_update_notification_template(text,text,text,text,text,boolean)'
  ) is null then
    raise exception 'STEP 30 failed: template update RPC missing';
  end if;

  if to_regprocedure(
    'public.admin_list_notification_templates()'
  ) is null then
    raise exception 'STEP 30 failed: template list RPC missing';
  end if;
end
$$;

commit;

-- ------------------------------------------------------------
-- RESULT CHECK
-- Expected:
-- - 21+ default templates remain
-- - 0 STEP 29 demo outbox rows
-- - 0 duplicate event_key/channel pairs
-- ------------------------------------------------------------

select
  (select count(*) from public.notification_templates) as template_count,
  (select count(*)
   from public.notification_outbox
   where metadata->>'demo_seed'='imerssupa_notification_demo_v1') as demo_outbox_count,
  (select count(*)
   from (
     select event_key, channel
     from public.notification_templates
     group by event_key, channel
     having count(*) > 1
   ) d) as duplicate_template_pairs;

-- ============================================================
-- STEP 30 COMPLETE
--
-- Supabase query name:
-- iMersSUPA - 30 Notification Template Editor & Demo Cleanup
-- ============================================================


-- ===== SOURCE STEP 31: 31-product-admin-operations.sql =====
-- iMersSUPA - 31 Product Admin Operations
-- Safe admin-only CRUD bridge for the Products frontend.
-- Does not reopen direct INSERT/UPDATE/DELETE privileges on public.products.

begin;

create or replace function public.admin_create_product_basic(
  p_name text,
  p_slug text,
  p_price numeric default 0,
  p_status text default 'draft'
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  p_name := nullif(btrim(p_name),'');
  p_slug := lower(nullif(btrim(p_slug),''));

  if p_name is null or p_slug is null then
    raise exception 'Product name and slug are required';
  end if;

  if p_price is null or p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if p_status not in ('draft','published','archived') then
    raise exception 'Invalid product status';
  end if;

  insert into public.products(name,slug,price,status)
  values (p_name,p_slug,p_price,p_status)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_update_product_basic(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_price numeric default 0,
  p_status text default 'draft'
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  p_name := nullif(btrim(p_name),'');
  p_slug := lower(nullif(btrim(p_slug),''));

  if p_product_id is null or p_name is null or p_slug is null then
    raise exception 'Product id, name and slug are required';
  end if;

  if p_price is null or p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if p_status not in ('draft','published','archived') then
    raise exception 'Invalid product status';
  end if;

  update public.products
     set name = p_name,
         slug = p_slug,
         price = p_price,
         status = p_status,
         updated_at = now()
   where id = p_product_id
   returning * into v_row;

  if v_row.id is null then raise exception 'Product not found'; end if;
  return v_row;
end;
$$;

create or replace function public.admin_delete_product_safe(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if exists(select 1 from public.order_items where product_id=p_product_id) then
    raise exception 'Product already has order history and cannot be deleted. Archive it instead.';
  end if;

  delete from public.products where id=p_product_id;
  if not found then raise exception 'Product not found'; end if;
  return true;
end;
$$;

revoke all on function public.admin_create_product_basic(text,text,numeric,text) from public;
revoke all on function public.admin_update_product_basic(uuid,text,text,numeric,text) from public;
revoke all on function public.admin_delete_product_safe(uuid) from public;

grant execute on function public.admin_create_product_basic(text,text,numeric,text) to authenticated;
grant execute on function public.admin_update_product_basic(uuid,text,text,numeric,text) to authenticated;
grant execute on function public.admin_delete_product_safe(uuid) to authenticated;

commit;

select
  to_regprocedure('public.admin_create_product_basic(text,text,numeric,text)') is not null as create_rpc,
  to_regprocedure('public.admin_update_product_basic(uuid,text,text,numeric,text)') is not null as update_rpc,
  to_regprocedure('public.admin_delete_product_safe(uuid)') is not null as delete_rpc;


-- ===== SOURCE STEP 32: 32-product-categories-media-gallery.sql =====
-- iMersSUPA - 32 Product Categories & Media Gallery
-- Dynamic product categories + max 9 images + optional product video.
-- Admin writes stay behind SECURITY DEFINER RPCs.

begin;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category_id uuid references public.product_categories(id) on delete restrict;

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_media_url_not_blank check (length(btrim(media_url)) > 0)
);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_product_categories_active_sort on public.product_categories(is_active,sort_order,name);
create index if not exists idx_product_media_product_sort on public.product_media(product_id,sort_order);

create unique index if not exists uq_product_media_one_video
  on public.product_media(product_id) where media_type='video';

create unique index if not exists uq_product_media_one_primary_image
  on public.product_media(product_id) where media_type='image' and is_primary=true;

alter table public.product_categories enable row level security;
alter table public.product_media enable row level security;

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read on public.product_categories
for select using (is_active = true or public.is_imerssupa_admin());

drop policy if exists product_media_public_read on public.product_media;
create policy product_media_public_read on public.product_media
for select using (
  public.is_imerssupa_admin()
  or exists (
    select 1 from public.products p
    where p.id = product_media.product_id and p.status = 'published'
  )
);

revoke insert, update, delete on public.product_categories from anon, authenticated;
revoke insert, update, delete on public.product_media from anon, authenticated;

create or replace function public.admin_upsert_product_category(
  p_category_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns public.product_categories
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.product_categories;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  p_name := nullif(btrim(p_name),'');
  p_slug := lower(nullif(btrim(p_slug),''));
  if p_name is null or p_slug is null then raise exception 'Category name and slug are required'; end if;

  if p_category_id is null then
    insert into public.product_categories(name,slug,description,is_active,sort_order)
    values(p_name,p_slug,nullif(btrim(p_description),''),coalesce(p_is_active,true),coalesce(p_sort_order,0))
    returning * into v_row;
  else
    update public.product_categories
       set name=p_name, slug=p_slug, description=nullif(btrim(p_description),''),
           is_active=coalesce(p_is_active,true), sort_order=coalesce(p_sort_order,0), updated_at=now()
     where id=p_category_id returning * into v_row;
    if v_row.id is null then raise exception 'Category not found'; end if;
  end if;
  return v_row;
end $$;

create or replace function public.admin_delete_product_category_safe(p_category_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if exists(select 1 from public.products where category_id=p_category_id) then
    raise exception 'Category is still used by one or more products';
  end if;
  delete from public.product_categories where id=p_category_id;
  if not found then raise exception 'Category not found'; end if;
  return true;
end $$;

create or replace function public.replace_product_media_internal(
  p_product_id uuid,
  p_image_urls text[],
  p_video_url text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_url text;
  v_index integer := 0;
  v_images text[] := array[]::text[];
begin
  if p_image_urls is not null then
    foreach v_url in array p_image_urls loop
      v_url := nullif(btrim(v_url),'');
      if v_url is not null then v_images := array_append(v_images,v_url); end if;
    end loop;
  end if;

  if coalesce(array_length(v_images,1),0) > 9 then
    raise exception 'Maximum 9 product images';
  end if;

  delete from public.product_media where product_id=p_product_id;

  if coalesce(array_length(v_images,1),0) > 0 then
    foreach v_url in array v_images loop
      v_index := v_index + 1;
      insert into public.product_media(product_id,media_type,media_url,sort_order,is_primary)
      values(p_product_id,'image',v_url,v_index,v_index=1);
    end loop;
  end if;

  p_video_url := nullif(btrim(p_video_url),'');
  if p_video_url is not null then
    insert into public.product_media(product_id,media_type,media_url,sort_order,is_primary)
    values(p_product_id,'video',p_video_url,100,false);
  end if;
end $$;

create or replace function public.admin_create_product_with_media(
  p_name text,
  p_slug text,
  p_price numeric default 0,
  p_status text default 'draft',
  p_category_id uuid default null,
  p_video_url text default null,
  p_image_urls text[] default array[]::text[]
)
returns public.products
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.products;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  p_name:=nullif(btrim(p_name),''); p_slug:=lower(nullif(btrim(p_slug),''));
  if p_name is null or p_slug is null then raise exception 'Product name and slug are required'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price cannot be negative'; end if;
  if p_status not in ('draft','published','archived') then raise exception 'Invalid product status'; end if;
  if p_category_id is not null and not exists(select 1 from public.product_categories where id=p_category_id) then raise exception 'Category not found'; end if;

  insert into public.products(name,slug,price,status,category_id)
  values(p_name,p_slug,p_price,p_status,p_category_id)
  returning * into v_row;

  perform public.replace_product_media_internal(v_row.id,p_image_urls,p_video_url);
  return v_row;
end $$;

create or replace function public.admin_update_product_with_media(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_price numeric default 0,
  p_status text default 'draft',
  p_category_id uuid default null,
  p_video_url text default null,
  p_image_urls text[] default array[]::text[]
)
returns public.products
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.products;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  p_name:=nullif(btrim(p_name),''); p_slug:=lower(nullif(btrim(p_slug),''));
  if p_product_id is null or p_name is null or p_slug is null then raise exception 'Product id, name and slug are required'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price cannot be negative'; end if;
  if p_status not in ('draft','published','archived') then raise exception 'Invalid product status'; end if;
  if p_category_id is not null and not exists(select 1 from public.product_categories where id=p_category_id) then raise exception 'Category not found'; end if;

  update public.products
     set name=p_name,slug=p_slug,price=p_price,status=p_status,category_id=p_category_id,updated_at=now()
   where id=p_product_id returning * into v_row;
  if v_row.id is null then raise exception 'Product not found'; end if;

  perform public.replace_product_media_internal(v_row.id,p_image_urls,p_video_url);
  return v_row;
end $$;

revoke all on function public.replace_product_media_internal(uuid,text[],text) from public, anon, authenticated;
revoke all on function public.admin_upsert_product_category(uuid,text,text,text,boolean,integer) from public;
revoke all on function public.admin_delete_product_category_safe(uuid) from public;
revoke all on function public.admin_create_product_with_media(text,text,numeric,text,uuid,text,text[]) from public;
revoke all on function public.admin_update_product_with_media(uuid,text,text,numeric,text,uuid,text,text[]) from public;

grant execute on function public.admin_upsert_product_category(uuid,text,text,text,boolean,integer) to authenticated;
grant execute on function public.admin_delete_product_category_safe(uuid) to authenticated;
grant execute on function public.admin_create_product_with_media(text,text,numeric,text,uuid,text,text[]) to authenticated;
grant execute on function public.admin_update_product_with_media(uuid,text,text,numeric,text,uuid,text,text[]) to authenticated;

commit;

select
  to_regclass('public.product_categories') is not null as categories_table,
  to_regclass('public.product_media') is not null as media_table,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='category_id') as category_column,
  to_regprocedure('public.admin_create_product_with_media(text,text,numeric,text,uuid,text,text[])') is not null as create_rpc,
  to_regprocedure('public.admin_update_product_with_media(uuid,text,text,numeric,text,uuid,text,text[])') is not null as update_rpc;


-- ===== SOURCE STEP 33: 33-product-categories-media-read-permission-fix.sql =====
-- iMersSUPA - 33 Product Categories & Media Read Permission Fix
-- STEP 32 intentionally revoked write privileges, but SELECT grants were missing.
-- RLS policies remain the actual row-level gate. This only restores SELECT for browser clients.

begin;

grant select on table public.product_categories to anon, authenticated;
grant select on table public.product_media to anon, authenticated;

commit;

-- Verification: all four rows below should return true.
select
  has_table_privilege('authenticated', 'public.product_categories', 'SELECT') as authenticated_categories_select,
  has_table_privilege('authenticated', 'public.product_media', 'SELECT') as authenticated_media_select,
  has_table_privilege('anon', 'public.product_categories', 'SELECT') as anon_categories_select,
  has_table_privilege('anon', 'public.product_media', 'SELECT') as anon_media_select;


-- ===== SOURCE STEP 34: 34-content-admin-operations.sql =====
-- iMersSUPA - 34 Content Admin Operations
-- Admin-only safe CRUD for product_sections and product_contents.

begin;

create or replace function public.admin_create_product_section(p_product_id uuid,p_title text,p_sort_order integer default 0)
returns public.product_sections language plpgsql security definer set search_path=public as $$
declare v public.product_sections;
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 p_title:=nullif(btrim(p_title),''); if p_title is null then raise exception 'Section title required'; end if;
 insert into public.product_sections(product_id,title,sort_order) values(p_product_id,p_title,coalesce(p_sort_order,0)) returning * into v; return v;
end $$;

create or replace function public.admin_delete_product_section_safe(p_section_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 if exists(select 1 from public.product_contents where section_id=p_section_id) then raise exception 'Section still contains content'; end if;
 delete from public.product_sections where id=p_section_id; if not found then raise exception 'Section not found'; end if; return true;
end $$;

create or replace function public.admin_create_product_content(
 p_product_id uuid,p_section_id uuid,p_title text,p_content_type text,p_content_text text default null,p_external_url text default null,
 p_sort_order integer default 0,p_is_published boolean default true,p_is_preview boolean default false)
returns public.product_contents language plpgsql security definer set search_path=public as $$
declare v public.product_contents;
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 p_title:=nullif(btrim(p_title),''); if p_title is null then raise exception 'Content title required'; end if;
 if p_content_type not in ('text','html','video','external_url') then raise exception 'Invalid content type'; end if;
 if p_section_id is not null and not exists(select 1 from public.product_sections where id=p_section_id and product_id=p_product_id) then raise exception 'Section does not belong to product'; end if;
 insert into public.product_contents(product_id,section_id,title,content_type,content_text,external_url,sort_order,is_published,is_preview)
 values(p_product_id,p_section_id,p_title,p_content_type,nullif(btrim(p_content_text),''),nullif(btrim(p_external_url),''),coalesce(p_sort_order,0),coalesce(p_is_published,true),coalesce(p_is_preview,false))
 returning * into v; return v;
end $$;

create or replace function public.admin_update_product_content(
 p_content_id uuid,p_product_id uuid,p_section_id uuid,p_title text,p_content_type text,p_content_text text default null,p_external_url text default null,
 p_sort_order integer default 0,p_is_published boolean default true,p_is_preview boolean default false)
returns public.product_contents language plpgsql security definer set search_path=public as $$
declare v public.product_contents;
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 p_title:=nullif(btrim(p_title),''); if p_title is null then raise exception 'Content title required'; end if;
 if p_content_type not in ('text','html','video','external_url') then raise exception 'Invalid content type'; end if;
 if p_section_id is not null and not exists(select 1 from public.product_sections where id=p_section_id and product_id=p_product_id) then raise exception 'Section does not belong to product'; end if;
 update public.product_contents set product_id=p_product_id,section_id=p_section_id,title=p_title,content_type=p_content_type,
 content_text=nullif(btrim(p_content_text),''),external_url=nullif(btrim(p_external_url),''),sort_order=coalesce(p_sort_order,0),
 is_published=coalesce(p_is_published,true),is_preview=coalesce(p_is_preview,false),updated_at=now()
 where id=p_content_id returning * into v; if v.id is null then raise exception 'Content not found'; end if; return v;
end $$;

create or replace function public.admin_delete_product_content_safe(p_content_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 delete from public.product_contents where id=p_content_id; if not found then raise exception 'Content not found'; end if; return true;
end $$;

revoke all on function public.admin_create_product_section(uuid,text,integer) from public;
revoke all on function public.admin_delete_product_section_safe(uuid) from public;
revoke all on function public.admin_create_product_content(uuid,uuid,text,text,text,text,integer,boolean,boolean) from public;
revoke all on function public.admin_update_product_content(uuid,uuid,uuid,text,text,text,text,integer,boolean,boolean) from public;
revoke all on function public.admin_delete_product_content_safe(uuid) from public;
grant execute on function public.admin_create_product_section(uuid,text,integer) to authenticated;
grant execute on function public.admin_delete_product_section_safe(uuid) to authenticated;
grant execute on function public.admin_create_product_content(uuid,uuid,text,text,text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.admin_update_product_content(uuid,uuid,uuid,text,text,text,text,integer,boolean,boolean) to authenticated;
grant execute on function public.admin_delete_product_content_safe(uuid) to authenticated;

commit;

select
 to_regprocedure('public.admin_create_product_section(uuid,text,integer)') is not null as section_create_rpc,
 to_regprocedure('public.admin_delete_product_section_safe(uuid)') is not null as section_delete_rpc,
 to_regprocedure('public.admin_create_product_content(uuid,uuid,text,text,text,text,integer,boolean,boolean)') is not null as content_create_rpc,
 to_regprocedure('public.admin_update_product_content(uuid,uuid,uuid,text,text,text,text,integer,boolean,boolean)') is not null as content_update_rpc,
 to_regprocedure('public.admin_delete_product_content_safe(uuid)') is not null as content_delete_rpc;


-- ===== SOURCE STEP 35: 35-member-access-admin-operations.sql =====
-- iMersSUPA - 35 Member Access Admin Operations
-- Safe admin entitlement CRUD without reopening direct writes.

begin;

create or replace function public.admin_grant_member_access(p_user_id uuid,p_product_id uuid,p_expires_at timestamptz default null)
returns public.member_access language plpgsql security definer set search_path=public as $$
declare v public.member_access;
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role='member') then raise exception 'Member not found'; end if;
 if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
 select * into v from public.member_access where user_id=p_user_id and product_id=p_product_id limit 1;
 if v.id is null then
   insert into public.member_access(user_id,product_id,access_status,expires_at) values(p_user_id,p_product_id,'active',p_expires_at) returning * into v;
 else
   update public.member_access set access_status='active',expires_at=p_expires_at,updated_at=now() where id=v.id returning * into v;
 end if;
 return v;
end $$;

create or replace function public.admin_revoke_member_access(p_access_id uuid)
returns public.member_access language plpgsql security definer set search_path=public as $$
declare v public.member_access;
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 update public.member_access set access_status='revoked',updated_at=now() where id=p_access_id returning * into v;
 if v.id is null then raise exception 'Access not found'; end if; return v;
end $$;

create or replace function public.admin_delete_member_access_safe(p_access_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
 delete from public.member_access where id=p_access_id;
 if not found then raise exception 'Access not found'; end if; return true;
end $$;

revoke all on function public.admin_grant_member_access(uuid,uuid,timestamptz) from public;
revoke all on function public.admin_revoke_member_access(uuid) from public;
revoke all on function public.admin_delete_member_access_safe(uuid) from public;
grant execute on function public.admin_grant_member_access(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.admin_revoke_member_access(uuid) to authenticated;
grant execute on function public.admin_delete_member_access_safe(uuid) to authenticated;

commit;

select
 to_regprocedure('public.admin_grant_member_access(uuid,uuid,timestamptz)') is not null as grant_rpc,
 to_regprocedure('public.admin_revoke_member_access(uuid)') is not null as revoke_rpc,
 to_regprocedure('public.admin_delete_member_access_safe(uuid)') is not null as delete_rpc;


-- ===== SOURCE STEP 36: 36-admin-learning-progress.sql =====
-- iMersSUPA - 36 Admin Learning Progress
-- Read-only admin reporting RPC for member_content_progress.
-- No browser write access is opened.

begin;

create or replace function public.admin_list_member_progress()
returns table(
  id uuid,
  user_id uuid,
  content_id uuid,
  progress_percent integer,
  completed boolean,
  last_position text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz,
  member_name text,
  member_phone text,
  content_title text,
  content_type text,
  product_id uuid,
  product_name text,
  section_title text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    mcp.id,
    mcp.user_id,
    mcp.content_id,
    coalesce(mcp.progress_percent, 0)::integer,
    coalesce(mcp.completed, false),
    mcp.last_position::text,
    mcp.started_at,
    mcp.completed_at,
    mcp.updated_at,
    coalesce(nullif(btrim(pf.full_name), ''), 'Member')::text,
    pf.phone::text,
    pc.title::text,
    pc.content_type::text,
    pc.product_id,
    pr.name::text,
    ps.title::text
  from public.member_content_progress mcp
  join public.profiles pf on pf.id = mcp.user_id
  join public.product_contents pc on pc.id = mcp.content_id
  join public.products pr on pr.id = pc.product_id
  left join public.product_sections ps on ps.id = pc.section_id
  order by mcp.updated_at desc nulls last, mcp.id;
end;
$$;

revoke all on function public.admin_list_member_progress() from public;
grant execute on function public.admin_list_member_progress() to authenticated;

commit;

select
  to_regprocedure('public.admin_list_member_progress()') is not null as progress_rpc;


-- ===== SOURCE STEP 37: 37-product-resources-admin-operations.sql =====
-- ============================================================
-- iMersSUPA - 37 Product Resources Admin Operations
-- Normalizes product_files into a stable resource library.
-- Direct browser writes remain closed; Admin writes use RPC only.
-- ============================================================

begin;

alter table public.product_files add column if not exists title text;
alter table public.product_files add column if not exists description text;
alter table public.product_files add column if not exists file_url text;
alter table public.product_files add column if not exists file_type text not null default 'download';
alter table public.product_files add column if not exists sort_order integer not null default 0;
alter table public.product_files add column if not exists is_published boolean not null default true;
alter table public.product_files add column if not exists created_at timestamptz not null default now();
alter table public.product_files add column if not exists updated_at timestamptz not null default now();

create or replace function public.admin_list_product_resources()
returns table(
  id uuid, product_id uuid, title text, description text, file_url text,
  file_type text, sort_order integer, is_published boolean,
  created_at timestamptz, updated_at timestamptz, product_name text
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  return query
  select f.id,f.product_id,coalesce(f.title,'Resource')::text,f.description,f.file_url,
         coalesce(f.file_type,'download')::text,coalesce(f.sort_order,0),
         coalesce(f.is_published,true),f.created_at,f.updated_at,p.name::text
  from public.product_files f
  join public.products p on p.id=f.product_id
  order by f.sort_order asc,f.created_at desc;
end $$;

create or replace function public.admin_create_product_resource(
  p_product_id uuid,p_title text,p_description text,p_file_url text,
  p_file_type text default 'download',p_sort_order integer default 0,p_is_published boolean default true
)
returns public.product_files language plpgsql security definer set search_path=public as $$
declare v public.product_files;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Title is required'; end if;
  if p_file_url !~* '^https://.+' then raise exception 'Resource URL must use HTTPS'; end if;
  insert into public.product_files(product_id,title,description,file_url,file_type,sort_order,is_published,created_at,updated_at)
  values(p_product_id,btrim(p_title),nullif(btrim(p_description),''),btrim(p_file_url),coalesce(nullif(btrim(p_file_type),''),'download'),greatest(coalesce(p_sort_order,0),0),coalesce(p_is_published,true),now(),now())
  returning * into v;
  return v;
end $$;

create or replace function public.admin_update_product_resource(
  p_resource_id uuid,p_product_id uuid,p_title text,p_description text,p_file_url text,
  p_file_type text default 'download',p_sort_order integer default 0,p_is_published boolean default true
)
returns public.product_files language plpgsql security definer set search_path=public as $$
declare v public.product_files;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Title is required'; end if;
  if p_file_url !~* '^https://.+' then raise exception 'Resource URL must use HTTPS'; end if;
  update public.product_files set product_id=p_product_id,title=btrim(p_title),
    description=nullif(btrim(p_description),''),file_url=btrim(p_file_url),
    file_type=coalesce(nullif(btrim(p_file_type),''),'download'),
    sort_order=greatest(coalesce(p_sort_order,0),0),is_published=coalesce(p_is_published,true),updated_at=now()
  where id=p_resource_id returning * into v;
  if v.id is null then raise exception 'Resource not found'; end if;
  return v;
end $$;

create or replace function public.admin_delete_product_resource(p_resource_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  delete from public.product_files where id=p_resource_id;
  if not found then raise exception 'Resource not found'; end if;
  return true;
end $$;

revoke all on function public.admin_list_product_resources() from public;
revoke all on function public.admin_create_product_resource(uuid,text,text,text,text,integer,boolean) from public;
revoke all on function public.admin_update_product_resource(uuid,uuid,text,text,text,text,integer,boolean) from public;
revoke all on function public.admin_delete_product_resource(uuid) from public;
grant execute on function public.admin_list_product_resources() to authenticated;
grant execute on function public.admin_create_product_resource(uuid,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.admin_update_product_resource(uuid,uuid,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.admin_delete_product_resource(uuid) to authenticated;

commit;

select
 to_regprocedure('public.admin_list_product_resources()') is not null as list_rpc,
 to_regprocedure('public.admin_create_product_resource(uuid,text,text,text,text,integer,boolean)') is not null as create_rpc,
 to_regprocedure('public.admin_update_product_resource(uuid,uuid,text,text,text,text,integer,boolean)') is not null as update_rpc,
 to_regprocedure('public.admin_delete_product_resource(uuid)') is not null as delete_rpc;


-- ===== SOURCE STEP 38: 38-administrator-management.sql =====
-- ============================================================
-- iMersSUPA - 38 Administrator Management
-- Super Admin only.
-- Existing registered accounts can be promoted to Admin/Super Admin.
-- Auth users are NOT created/deleted from browser SQL RPCs.
-- ============================================================

begin;

create or replace function public.is_imerssupa_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='super_admin' and status='active'
  );
$$;

create or replace function public.super_admin_list_administrators()
returns setof public.profiles language sql stable security definer set search_path=public as $$
  select p.* from public.profiles p
  where public.is_imerssupa_super_admin()
    and p.role in ('admin','super_admin')
  order by case when p.role='super_admin' then 0 else 1 end,p.created_at asc;
$$;

create or replace function public.super_admin_list_admin_candidates()
returns setof public.profiles language sql stable security definer set search_path=public as $$
  select p.* from public.profiles p
  where public.is_imerssupa_super_admin()
    and p.role='member'
    and p.status='active'
  order by p.full_name asc nulls last,p.created_at asc;
$$;

create or replace function public.super_admin_upsert_administrator(
  p_user_id uuid,p_full_name text,p_phone text,p_role text,p_status text
)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v public.profiles; v_super_count integer;
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_role not in ('admin','super_admin') then raise exception 'Invalid administrator role'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'Invalid status'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'User profile not found'; end if;

  if p_user_id=auth.uid() and (p_role<>'super_admin' or p_status<>'active') then
    raise exception 'You cannot demote or deactivate your current Super Admin account';
  end if;

  if exists(select 1 from public.profiles where id=p_user_id and role='super_admin' and (p_role<>'super_admin' or p_status<>'active')) then
    select count(*) into v_super_count from public.profiles where role='super_admin' and status='active';
    if v_super_count<=1 then raise exception 'At least one active Super Admin must remain'; end if;
  end if;

  update public.profiles
  set full_name=nullif(btrim(p_full_name),''),
      phone=nullif(btrim(p_phone),''),
      role=p_role,status=p_status,updated_at=now()
  where id=p_user_id returning * into v;
  return v;
end $$;

create or replace function public.super_admin_deactivate_administrator(p_user_id uuid)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v public.profiles; v_super_count integer;
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_user_id=auth.uid() then raise exception 'You cannot deactivate your current Super Admin account'; end if;
  if exists(select 1 from public.profiles where id=p_user_id and role='super_admin' and status='active') then
    select count(*) into v_super_count from public.profiles where role='super_admin' and status='active';
    if v_super_count<=1 then raise exception 'At least one active Super Admin must remain'; end if;
  end if;
  update public.profiles set status='inactive',updated_at=now()
  where id=p_user_id and role in ('admin','super_admin') returning * into v;
  if v.id is null then raise exception 'Administrator not found'; end if;
  return v;
end $$;

revoke all on function public.is_imerssupa_super_admin() from public;
revoke all on function public.super_admin_list_administrators() from public;
revoke all on function public.super_admin_list_admin_candidates() from public;
revoke all on function public.super_admin_upsert_administrator(uuid,text,text,text,text) from public;
revoke all on function public.super_admin_deactivate_administrator(uuid) from public;

grant execute on function public.is_imerssupa_super_admin() to authenticated;
grant execute on function public.super_admin_list_administrators() to authenticated;
grant execute on function public.super_admin_list_admin_candidates() to authenticated;
grant execute on function public.super_admin_upsert_administrator(uuid,text,text,text,text) to authenticated;
grant execute on function public.super_admin_deactivate_administrator(uuid) to authenticated;

commit;

select
 to_regprocedure('public.is_imerssupa_super_admin()') is not null as super_admin_check,
 to_regprocedure('public.super_admin_list_administrators()') is not null as list_rpc,
 to_regprocedure('public.super_admin_list_admin_candidates()') is not null as candidate_rpc,
 to_regprocedure('public.super_admin_upsert_administrator(uuid,text,text,text,text)') is not null as save_rpc,
 to_regprocedure('public.super_admin_deactivate_administrator(uuid)') is not null as deactivate_rpc;


-- ===== SOURCE STEP 39: 39-agency-engine-foundation.sql =====
-- ============================================================
-- iMersSUPA - 39 Agency Engine Foundation
-- Product-scoped Agency model.
-- Agency is NOT an Admin and does NOT inherit global product rights.
-- ============================================================

begin;

-- 39.1 ROLE: add agency safely to existing profiles role check.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.profiles'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I',r.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin','admin','agency','member'));

-- 39.2 Per-product Agency availability.
create table if not exists public.product_agency_settings(
  product_id uuid primary key references public.products(id) on delete cascade,
  agency_enabled boolean not null default false,
  default_slot_limit integer not null default 20 check(default_slot_limit>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 39.3 Agency entitlement: which Agency owns rights to which product.
create table if not exists public.agency_product_entitlements(
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  slot_limit integer not null check(slot_limit>0),
  status text not null default 'active' check(status in ('active','inactive','suspended','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(agency_user_id,product_id)
);

-- 39.4 Ownership link. Agency can only manage members linked to itself.
create table if not exists public.agency_members(
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(agency_user_id,member_user_id),
  unique(member_user_id),
  check(agency_user_id<>member_user_id)
);

-- 39.5 Audit each product access granted by an Agency.
create table if not exists public.agency_member_grants(
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  member_access_id uuid references public.member_access(id) on delete set null,
  status text not null default 'active' check(status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(agency_user_id,member_user_id,product_id)
);

create index if not exists agency_entitlements_agency_idx on public.agency_product_entitlements(agency_user_id,status);
create index if not exists agency_members_agency_idx on public.agency_members(agency_user_id);
create index if not exists agency_grants_agency_idx on public.agency_member_grants(agency_user_id,status);

alter table public.product_agency_settings enable row level security;
alter table public.agency_product_entitlements enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_member_grants enable row level security;

revoke insert,update,delete on public.product_agency_settings from anon,authenticated;
revoke insert,update,delete on public.agency_product_entitlements from anon,authenticated;
revoke insert,update,delete on public.agency_members from anon,authenticated;
revoke insert,update,delete on public.agency_member_grants from anon,authenticated;

-- Admin product settings.
create or replace function public.admin_list_product_agency_settings()
returns table(product_id uuid,agency_enabled boolean,default_slot_limit integer)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  return query
  select p.id,coalesce(s.agency_enabled,false),coalesce(s.default_slot_limit,20)
  from public.products p left join public.product_agency_settings s on s.product_id=p.id
  order by p.created_at desc;
end $$;

create or replace function public.admin_set_product_agency_settings(
  p_product_id uuid,p_agency_enabled boolean,p_default_slot_limit integer
)
returns public.product_agency_settings
language plpgsql security definer set search_path=public as $$
declare v public.product_agency_settings;
begin
  if not public.is_imerssupa_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found'; end if;
  if coalesce(p_default_slot_limit,0)<1 then raise exception 'Agency slot limit must be at least 1'; end if;
  insert into public.product_agency_settings(product_id,agency_enabled,default_slot_limit,updated_at)
  values(p_product_id,coalesce(p_agency_enabled,false),p_default_slot_limit,now())
  on conflict(product_id) do update set agency_enabled=excluded.agency_enabled,default_slot_limit=excluded.default_slot_limit,updated_at=now()
  returning * into v;
  return v;
end $$;

-- Super Admin assigns Agency rights to an eligible product.
create or replace function public.super_admin_set_agency_entitlement(
  p_agency_user_id uuid,p_product_id uuid,p_slot_limit integer,p_status text default 'active',p_expires_at timestamptz default null
)
returns public.agency_product_entitlements
language plpgsql security definer set search_path=public as $$
declare v public.agency_product_entitlements;
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  if not exists(select 1 from public.profiles where id=p_agency_user_id and role='agency') then raise exception 'Agency account not found'; end if;
  if not exists(select 1 from public.product_agency_settings where product_id=p_product_id and agency_enabled=true) then raise exception 'Agency Program is disabled for this product'; end if;
  if coalesce(p_slot_limit,0)<1 then raise exception 'Slot limit must be at least 1'; end if;
  if p_status not in ('active','inactive','suspended','expired') then raise exception 'Invalid entitlement status'; end if;

  insert into public.agency_product_entitlements(agency_user_id,product_id,slot_limit,status,expires_at,updated_at)
  values(p_agency_user_id,p_product_id,p_slot_limit,p_status,p_expires_at,now())
  on conflict(agency_user_id,product_id) do update
    set slot_limit=excluded.slot_limit,status=excluded.status,expires_at=excluded.expires_at,updated_at=now()
  returning * into v;
  return v;
end $$;

-- Agency dashboard-safe entitlement read with live slot usage.
create or replace function public.get_my_agency_entitlements()
returns table(
  entitlement_id uuid,product_id uuid,product_name text,slot_limit integer,used_slots bigint,
  remaining_slots bigint,status text,expires_at timestamptz
)
language sql stable security definer set search_path=public as $$
  select e.id,e.product_id,p.name::text,e.slot_limit,
    count(g.id) filter(where g.status='active') as used_slots,
    greatest(e.slot_limit-count(g.id) filter(where g.status='active'),0)::bigint as remaining_slots,
    e.status,e.expires_at
  from public.agency_product_entitlements e
  join public.products p on p.id=e.product_id
  left join public.agency_member_grants g
    on g.agency_user_id=e.agency_user_id and g.product_id=e.product_id and g.status='active'
  where e.agency_user_id=auth.uid()
    and exists(select 1 from public.profiles x where x.id=auth.uid() and x.role='agency' and x.status='active')
  group by e.id,p.name;
$$;

revoke all on function public.admin_list_product_agency_settings() from public;
revoke all on function public.admin_set_product_agency_settings(uuid,boolean,integer) from public;
revoke all on function public.super_admin_set_agency_entitlement(uuid,uuid,integer,text,timestamptz) from public;
revoke all on function public.get_my_agency_entitlements() from public;

grant execute on function public.admin_list_product_agency_settings() to authenticated;
grant execute on function public.admin_set_product_agency_settings(uuid,boolean,integer) to authenticated;
grant execute on function public.super_admin_set_agency_entitlement(uuid,uuid,integer,text,timestamptz) to authenticated;
grant execute on function public.get_my_agency_entitlements() to authenticated;

commit;

select
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='product_agency_settings') as product_settings,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='agency_product_entitlements') as entitlements,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='agency_members') as agency_members,
  exists(select 1 from information_schema.tables where table_schema='public' and table_name='agency_member_grants') as agency_grants,
  to_regprocedure('public.admin_set_product_agency_settings(uuid,boolean,integer)') is not null as product_rpc,
  to_regprocedure('public.super_admin_set_agency_entitlement(uuid,uuid,integer,text,timestamptz)') is not null as entitlement_rpc,
  to_regprocedure('public.get_my_agency_entitlements()') is not null as agency_read_rpc;


-- ===== SOURCE STEP 40: 40-agency-management.sql =====
-- ============================================================
-- iMersSUPA - 40 Agency Management
-- Super Admin management for Agency accounts and product entitlements.
-- Requires STEP 39.
-- ============================================================

begin;

create or replace function public.super_admin_list_agencies()
returns table(
  id uuid, full_name text, phone text, status text, created_at timestamptz,
  product_count bigint, total_slots bigint, used_slots bigint
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  return query
  select p.id,p.full_name::text,p.phone::text,p.status::text,p.created_at,
    count(distinct e.product_id) filter(where e.status='active') as product_count,
    coalesce(sum(e.slot_limit) filter(where e.status='active'),0)::bigint as total_slots,
    count(g.id) filter(where g.status='active') as used_slots
  from public.profiles p
  left join public.agency_product_entitlements e on e.agency_user_id=p.id
  left join public.agency_member_grants g on g.agency_user_id=p.id and g.product_id=e.product_id and g.status='active'
  where p.role='agency'
  group by p.id,p.full_name,p.phone,p.status,p.created_at
  order by p.created_at desc;
end $$;

create or replace function public.super_admin_list_agency_candidates()
returns table(id uuid,full_name text,phone text,status text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  return query select p.id,p.full_name::text,p.phone::text,p.status::text,p.created_at
  from public.profiles p where p.role='member' and p.status='active'
  order by p.full_name asc nulls last,p.created_at asc;
end $$;

create or replace function public.super_admin_promote_agency(p_user_id uuid)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v public.profiles;
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  update public.profiles set role='agency',status='active',updated_at=now()
  where id=p_user_id and role='member' returning * into v;
  if v.id is null then raise exception 'Eligible member account not found'; end if;
  return v;
end $$;

create or replace function public.super_admin_list_agency_entitlements(p_agency_user_id uuid default null)
returns table(
  id uuid,agency_user_id uuid,agency_name text,product_id uuid,product_name text,
  slot_limit integer,used_slots bigint,remaining_slots bigint,status text,expires_at timestamptz,updated_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  return query
  select e.id,e.agency_user_id,coalesce(pf.full_name,'Agency')::text,e.product_id,pr.name::text,e.slot_limit,
    count(g.id) filter(where g.status='active') as used_slots,
    greatest(e.slot_limit-count(g.id) filter(where g.status='active'),0)::bigint as remaining_slots,
    e.status::text,e.expires_at,e.updated_at
  from public.agency_product_entitlements e
  join public.profiles pf on pf.id=e.agency_user_id
  join public.products pr on pr.id=e.product_id
  left join public.agency_member_grants g on g.agency_user_id=e.agency_user_id and g.product_id=e.product_id and g.status='active'
  where p_agency_user_id is null or e.agency_user_id=p_agency_user_id
  group by e.id,pf.full_name,pr.name
  order by pf.full_name asc nulls last,pr.name asc;
end $$;

create or replace function public.super_admin_remove_agency_entitlement(p_entitlement_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  if exists(select 1 from public.agency_member_grants g join public.agency_product_entitlements e
            on e.agency_user_id=g.agency_user_id and e.product_id=g.product_id
            where e.id=p_entitlement_id and g.status='active') then
    raise exception 'Entitlement still has active member grants. Suspend it instead of deleting it.';
  end if;
  delete from public.agency_product_entitlements where id=p_entitlement_id;
  if not found then raise exception 'Entitlement not found'; end if;
  return true;
end $$;

create or replace function public.super_admin_set_agency_status(p_agency_user_id uuid,p_status text)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare v public.profiles;
begin
  if not public.is_imerssupa_super_admin() then raise exception 'Super Admin access required'; end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'Invalid Agency status'; end if;
  update public.profiles set status=p_status,updated_at=now() where id=p_agency_user_id and role='agency' returning * into v;
  if v.id is null then raise exception 'Agency not found'; end if;
  return v;
end $$;

revoke all on function public.super_admin_list_agencies() from public;
revoke all on function public.super_admin_list_agency_candidates() from public;
revoke all on function public.super_admin_promote_agency(uuid) from public;
revoke all on function public.super_admin_list_agency_entitlements(uuid) from public;
revoke all on function public.super_admin_remove_agency_entitlement(uuid) from public;
revoke all on function public.super_admin_set_agency_status(uuid,text) from public;
grant execute on function public.super_admin_list_agencies() to authenticated;
grant execute on function public.super_admin_list_agency_candidates() to authenticated;
grant execute on function public.super_admin_promote_agency(uuid) to authenticated;
grant execute on function public.super_admin_list_agency_entitlements(uuid) to authenticated;
grant execute on function public.super_admin_remove_agency_entitlement(uuid) to authenticated;
grant execute on function public.super_admin_set_agency_status(uuid,text) to authenticated;

commit;

select
 to_regprocedure('public.super_admin_list_agencies()') is not null as agencies_rpc,
 to_regprocedure('public.super_admin_list_agency_candidates()') is not null as candidates_rpc,
 to_regprocedure('public.super_admin_promote_agency(uuid)') is not null as promote_rpc,
 to_regprocedure('public.super_admin_list_agency_entitlements(uuid)') is not null as entitlement_list_rpc,
 to_regprocedure('public.super_admin_set_agency_entitlement(uuid,uuid,integer,text,timestamptz)') is not null as entitlement_save_rpc,
 to_regprocedure('public.super_admin_remove_agency_entitlement(uuid)') is not null as entitlement_delete_rpc,
 to_regprocedure('public.super_admin_set_agency_status(uuid,text)') is not null as agency_status_rpc;


-- ===== SOURCE STEP 41: 41-role-permission-matrix-agency-isolation.sql =====
-- ============================================================
-- iMersSUPA - 41 Role Permission Matrix & Agency Isolation
-- Locks the four platform roles:
-- super_admin / admin / agency / member
-- ============================================================

begin;

-- Canonical role helpers. These are intentionally small and reusable by RLS/RPC.
create or replace function public.is_imerssupa_super_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='super_admin' and status='active'
  );
$$;

create or replace function public.is_imerssupa_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid()
      and role in ('super_admin','admin')
      and status='active'
  );
$$;

create or replace function public.is_imerssupa_agency()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='agency' and status='active'
  );
$$;

create or replace function public.is_imerssupa_member()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='member' and status='active'
  );
$$;

-- Browser roles may call helpers, but helpers only reveal booleans.
revoke all on function public.is_imerssupa_super_admin() from public;
revoke all on function public.is_imerssupa_admin() from public;
revoke all on function public.is_imerssupa_agency() from public;
revoke all on function public.is_imerssupa_member() from public;
grant execute on function public.is_imerssupa_super_admin() to authenticated;
grant execute on function public.is_imerssupa_admin() to authenticated;
grant execute on function public.is_imerssupa_agency() to authenticated;
grant execute on function public.is_imerssupa_member() to authenticated;

-- Agency-owned tables remain RPC controlled. No direct browser mutation.
revoke insert,update,delete on public.product_agency_settings from anon,authenticated;
revoke insert,update,delete on public.agency_product_entitlements from anon,authenticated;
revoke insert,update,delete on public.agency_members from anon,authenticated;
revoke insert,update,delete on public.agency_member_grants from anon,authenticated;

-- Security audit is Super Admin only from this point onward.
drop policy if exists "security_audit_admin_read" on public.security_audit_log;
drop policy if exists "security_audit_super_admin_read" on public.security_audit_log;
create policy "security_audit_super_admin_read"
on public.security_audit_log
for select to authenticated
using (public.is_imerssupa_super_admin());

create or replace view public.admin_security_audit_summary
with (security_invoker=true)
as
select
  count(*)::bigint as total_events,
  count(*) filter(where severity='warning')::bigint as warning_events,
  count(*) filter(where severity='critical')::bigint as critical_events,
  max(created_at) as last_event_at
from public.security_audit_log
where public.is_imerssupa_super_admin();

create or replace function public.admin_backend_security_audit()
returns table(check_key text,status text,detail text)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_imerssupa_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  return query select 'role_super_admin_helper',
    case when public.is_imerssupa_super_admin() then 'PASS' else 'FAIL' end,
    'Current account must be an active Super Admin';

  return query select 'agency_direct_entitlement_write',
    case when has_table_privilege('authenticated','public.agency_product_entitlements','INSERT')
           or has_table_privilege('authenticated','public.agency_product_entitlements','UPDATE')
           or has_table_privilege('authenticated','public.agency_product_entitlements','DELETE')
         then 'FAIL' else 'PASS' end,
    'Agency entitlement mutations must remain RPC-controlled';

  return query select 'agency_direct_member_link_write',
    case when has_table_privilege('authenticated','public.agency_members','INSERT')
           or has_table_privilege('authenticated','public.agency_members','UPDATE')
           or has_table_privilege('authenticated','public.agency_members','DELETE')
         then 'FAIL' else 'PASS' end,
    'Agency-member ownership links must remain RPC-controlled';

  return query select 'agency_direct_grant_write',
    case when has_table_privilege('authenticated','public.agency_member_grants','INSERT')
           or has_table_privilege('authenticated','public.agency_member_grants','UPDATE')
           or has_table_privilege('authenticated','public.agency_member_grants','DELETE')
         then 'FAIL' else 'PASS' end,
    'Agency product grants must remain RPC-controlled';

  return query select 'provider_table_browser_select',
    case when has_table_privilege('anon','public.communication_providers','SELECT')
           or has_table_privilege('authenticated','public.communication_providers','SELECT')
         then 'FAIL' else 'PASS' end,
    'Communication provider secrets must not be browser-readable';

  return query select 'orders_direct_insert',
    case when has_table_privilege('anon','public.orders','INSERT')
           or has_table_privilege('authenticated','public.orders','INSERT')
         then 'FAIL' else 'PASS' end,
    'Orders must be created through secure RPC only';

  return query select 'payment_direct_update',
    case when has_table_privilege('anon','public.payment_transactions','UPDATE')
           or has_table_privilege('authenticated','public.payment_transactions','UPDATE')
         then 'FAIL' else 'PASS' end,
    'Payment state must not be directly writable by browser roles';

  return query select 'security_log_super_admin_only',
    case when public.is_imerssupa_super_admin() then 'PASS' else 'FAIL' end,
    'Security/Audit UI and log are reserved for Super Admin';
end;
$$;

revoke all on function public.admin_backend_security_audit() from public;
grant execute on function public.admin_backend_security_audit() to authenticated;

commit;

select
  to_regprocedure('public.is_imerssupa_super_admin()') is not null as super_admin_helper,
  to_regprocedure('public.is_imerssupa_admin()') is not null as admin_helper,
  to_regprocedure('public.is_imerssupa_agency()') is not null as agency_helper,
  to_regprocedure('public.is_imerssupa_member()') is not null as member_helper,
  to_regprocedure('public.admin_backend_security_audit()') is not null as audit_rpc,
  not has_table_privilege('authenticated','public.agency_product_entitlements','INSERT') as entitlement_write_locked,
  not has_table_privilege('authenticated','public.agency_members','INSERT') as agency_member_write_locked,
  not has_table_privilege('authenticated','public.agency_member_grants','INSERT') as agency_grant_write_locked;


-- ===== SOURCE STEP 42: 42-agency-area-operations.sql =====
-- ============================================================
-- iMersSUPA - 42 Agency Area Operations
-- Agency-safe dashboard/member/product-access RPCs.
-- Requires STEP 39-41.
-- NOTE: Auth account creation is handled server-side in the next step.
-- ============================================================

begin;

create or replace function public.agency_dashboard_summary()
returns table(
  total_products bigint,total_slots bigint,used_slots bigint,remaining_slots bigint,total_members bigint
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  return query
  select
    count(distinct e.product_id) filter(where e.status='active' and (e.expires_at is null or e.expires_at>now()))::bigint,
    coalesce(sum(e.slot_limit) filter(where e.status='active' and (e.expires_at is null or e.expires_at>now())),0)::bigint,
    count(g.id) filter(where g.status='active')::bigint,
    greatest(
      coalesce(sum(e.slot_limit) filter(where e.status='active' and (e.expires_at is null or e.expires_at>now())),0)
      - count(g.id) filter(where g.status='active'),0
    )::bigint,
    (select count(*) from public.agency_members am where am.agency_user_id=auth.uid())::bigint
  from public.agency_product_entitlements e
  left join public.agency_member_grants g
    on g.agency_user_id=e.agency_user_id and g.product_id=e.product_id and g.status='active'
  where e.agency_user_id=auth.uid();
end $$;

create or replace function public.agency_list_my_members()
returns table(
  member_user_id uuid,full_name text,phone text,status text,created_at timestamptz,
  product_count bigint
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  return query
  select p.id,p.full_name::text,p.phone::text,p.status::text,am.created_at,
    count(g.id) filter(where g.status='active')::bigint
  from public.agency_members am
  join public.profiles p on p.id=am.member_user_id
  left join public.agency_member_grants g
    on g.agency_user_id=am.agency_user_id and g.member_user_id=am.member_user_id
  where am.agency_user_id=auth.uid()
  group by p.id,p.full_name,p.phone,p.status,am.created_at
  order by am.created_at desc;
end $$;

create or replace function public.agency_attach_existing_member(p_member_user_id uuid)
returns public.agency_members
language plpgsql security definer set search_path=public as $$
declare v public.agency_members;
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  if not exists(select 1 from public.profiles where id=p_member_user_id and role='member' and status='active')
    then raise exception 'Active member account not found'; end if;
  if exists(select 1 from public.agency_members where member_user_id=p_member_user_id and agency_user_id<>auth.uid())
    then raise exception 'Member is already owned by another Agency'; end if;
  insert into public.agency_members(agency_user_id,member_user_id)
  values(auth.uid(),p_member_user_id)
  on conflict(agency_user_id,member_user_id) do update set agency_user_id=excluded.agency_user_id
  returning * into v;
  return v;
end $$;

create or replace function public.agency_grant_product_access(p_member_user_id uuid,p_product_id uuid)
returns public.agency_member_grants
language plpgsql security definer set search_path=public as $$
declare
  e public.agency_product_entitlements;
  used_count bigint;
  access_id uuid;
  v public.agency_member_grants;
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  if not exists(select 1 from public.agency_members where agency_user_id=auth.uid() and member_user_id=p_member_user_id)
    then raise exception 'This member does not belong to your Agency'; end if;

  select * into e from public.agency_product_entitlements
  where agency_user_id=auth.uid() and product_id=p_product_id
    and status='active' and (expires_at is null or expires_at>now())
  for update;
  if e.id is null then raise exception 'Active product entitlement not found'; end if;

  select count(*) into used_count from public.agency_member_grants
  where agency_user_id=auth.uid() and product_id=p_product_id and status='active'
    and not(member_user_id=p_member_user_id);

  if used_count>=e.slot_limit then raise exception 'Agency slot limit reached for this product'; end if;

  insert into public.member_access(user_id,product_id,access_status,expires_at)
  values(p_member_user_id,p_product_id,'active',e.expires_at)
  on conflict(user_id,product_id) do update
    set access_status='active',expires_at=excluded.expires_at,updated_at=now()
  returning id into access_id;

  insert into public.agency_member_grants(agency_user_id,member_user_id,product_id,member_access_id,status,revoked_at)
  values(auth.uid(),p_member_user_id,p_product_id,access_id,'active',null)
  on conflict(agency_user_id,member_user_id,product_id) do update
    set member_access_id=excluded.member_access_id,status='active',revoked_at=null
  returning * into v;
  return v;
end $$;

create or replace function public.agency_revoke_product_access(p_member_user_id uuid,p_product_id uuid)
returns boolean
language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  select member_access_id into aid from public.agency_member_grants
  where agency_user_id=auth.uid() and member_user_id=p_member_user_id and product_id=p_product_id and status='active';
  if aid is null then raise exception 'Active Agency grant not found'; end if;

  update public.agency_member_grants set status='revoked',revoked_at=now()
  where agency_user_id=auth.uid() and member_user_id=p_member_user_id and product_id=p_product_id;

  update public.member_access set access_status='inactive',updated_at=now()
  where id=aid and user_id=p_member_user_id and product_id=p_product_id;
  return true;
end $$;

create or replace function public.agency_list_my_grants()
returns table(
  member_user_id uuid,member_name text,product_id uuid,product_name text,status text,created_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_imerssupa_agency() then raise exception 'Active Agency access required'; end if;
  return query
  select g.member_user_id,pf.full_name::text,g.product_id,p.name::text,g.status::text,g.created_at
  from public.agency_member_grants g
  join public.profiles pf on pf.id=g.member_user_id
  join public.products p on p.id=g.product_id
  where g.agency_user_id=auth.uid()
  order by g.created_at desc;
end $$;

revoke all on function public.agency_dashboard_summary() from public;
revoke all on function public.agency_list_my_members() from public;
revoke all on function public.agency_attach_existing_member(uuid) from public;
revoke all on function public.agency_grant_product_access(uuid,uuid) from public;
revoke all on function public.agency_revoke_product_access(uuid,uuid) from public;
revoke all on function public.agency_list_my_grants() from public;

grant execute on function public.agency_dashboard_summary() to authenticated;
grant execute on function public.agency_list_my_members() to authenticated;
grant execute on function public.agency_attach_existing_member(uuid) to authenticated;
grant execute on function public.agency_grant_product_access(uuid,uuid) to authenticated;
grant execute on function public.agency_revoke_product_access(uuid,uuid) to authenticated;
grant execute on function public.agency_list_my_grants() to authenticated;

commit;

select
 to_regprocedure('public.agency_dashboard_summary()') is not null as summary_rpc,
 to_regprocedure('public.agency_list_my_members()') is not null as members_rpc,
 to_regprocedure('public.agency_attach_existing_member(uuid)') is not null as attach_rpc,
 to_regprocedure('public.agency_grant_product_access(uuid,uuid)') is not null as grant_rpc,
 to_regprocedure('public.agency_revoke_product_access(uuid,uuid)') is not null as revoke_rpc,
 to_regprocedure('public.agency_list_my_grants()') is not null as grants_rpc;


-- ===== SOURCE STEP 43: 43-agency-direct-create-profile-hotfix.sql =====
-- ============================================================
-- iMersSUPA - 43 Agency Direct Create Profile Hotfix
-- Secure direct Agency profile creation
-- ============================================================

begin;

create or replace function public.super_admin_create_agency_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_imerssupa_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  if p_user_id is null then
    raise exception 'Agency user id is required';
  end if;

  if nullif(btrim(coalesce(p_full_name, '')), '') is null then
    raise exception 'Agency name is required';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    role,
    status,
    updated_at
  )
  values (
    p_user_id,
    btrim(p_full_name),
    nullif(btrim(coalesce(p_phone, '')), ''),
    'agency',
    'active',
    now()
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    role = 'agency',
    status = 'active',
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all
on function public.super_admin_create_agency_profile(uuid,text,text)
from public;

grant execute
on function public.super_admin_create_agency_profile(uuid,text,text)
to authenticated;

commit;

select
  to_regprocedure(
    'public.super_admin_create_agency_profile(uuid,text,text)'
  ) is not null as agency_direct_create_profile_rpc;

-- ===== SOURCE STEP 44: 44-agency-create-member-profile.sql =====
-- ============================================================
-- iMersSUPA - 44 Agency Create Member Profile
-- Secure profile creation for Auth users created by Agency API.
-- Requires STEP 39-43.
-- ============================================================

begin;

create or replace function public.agency_create_member_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_imerssupa_agency() then
    raise exception 'Active Agency access required';
  end if;

  if p_user_id is null then
    raise exception 'Member user id is required';
  end if;

  if nullif(btrim(coalesce(p_full_name,'')),'') is null then
    raise exception 'Member name is required';
  end if;

  insert into public.profiles(id,full_name,phone,role,status,updated_at)
  values(
    p_user_id,
    btrim(p_full_name),
    nullif(btrim(coalesce(p_phone,'')),''),
    'member','active',now()
  )
  on conflict(id) do update
  set full_name=excluded.full_name,
      phone=excluded.phone,
      role='member',
      status='active',
      updated_at=now()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.agency_create_member_profile(uuid,text,text) from public;
grant execute on function public.agency_create_member_profile(uuid,text,text) to authenticated;

commit;

select
  to_regprocedure('public.agency_create_member_profile(uuid,text,text)') is not null
  as agency_create_member_profile_rpc;


-- ===== SOURCE STEP 45: 45-payment-proof-storage.sql =====
-- ============================================================
-- iMersSUPA - 45 PAYMENT PROOF STORAGE
-- Requires: STEP 20 + STEP 23
-- Query name:
-- iMersSUPA - 45 Payment Proof Storage
--
-- Purpose:
-- - Private Supabase Storage bucket for manual payment proofs
-- - Browser may upload only into its own isolated folder
-- - Authenticated users: folder = auth.uid()
-- - Guests: folder = checkout token SHA-256 hash
-- - No public read policy: proofs stay private
-- - Admin can read proofs through a signed URL server route
-- ============================================================

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imerssupa_payment_proofs_insert" on storage.objects;
drop policy if exists "imerssupa_payment_proofs_owner_select" on storage.objects;
drop policy if exists "imerssupa_payment_proofs_owner_delete" on storage.objects;
drop policy if exists "imerssupa_payment_proofs_admin_select" on storage.objects;

create policy "imerssupa_payment_proofs_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and (
    (
      auth.uid() is not null
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    or
    (
      auth.uid() is null
      and length(coalesce((storage.foldername(name))[1], '')) = 64
      and (storage.foldername(name))[1] ~ '^[0-9a-f]{64}$'
    )
  )
);

create policy "imerssupa_payment_proofs_owner_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    public.is_imerssupa_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "imerssupa_payment_proofs_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    public.is_imerssupa_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "imerssupa_payment_proofs_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_imerssupa_admin()
);

commit;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'payment-proofs';


-- ===== SOURCE STEP 46: 46-profile-avatar.sql =====
-- ============================================================
-- iMersSUPA - 46 PROFILE AVATAR & SELF PROFILE
-- Run once in Supabase SQL Editor
-- Query name: iMersSUPA - 46 Profile Avatar & Self Profile
-- ============================================================

begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'profile-avatars','profile-avatars',true,2097152,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "imerssupa_profile_avatar_insert" on storage.objects;
drop policy if exists "imerssupa_profile_avatar_update" on storage.objects;
drop policy if exists "imerssupa_profile_avatar_delete" on storage.objects;
drop policy if exists "imerssupa_profile_avatar_select" on storage.objects;

create policy "imerssupa_profile_avatar_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "imerssupa_profile_avatar_update"
on storage.objects for update to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "imerssupa_profile_avatar_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

create policy "imerssupa_profile_avatar_select"
on storage.objects for select to public
using (bucket_id='profile-avatars');

create or replace function public.update_my_profile(
  p_full_name text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set
    full_name = case when p_full_name is null then full_name else nullif(trim(p_full_name),'') end,
    avatar_url = case
      when p_avatar_url is null then avatar_url
      when trim(p_avatar_url)='' then null
      else trim(p_avatar_url)
    end
  where id=auth.uid()
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text,text) from public;
grant execute on function public.update_my_profile(text,text) to authenticated;

commit;

-- ===== CLEAN INSTALL UPDATE: PRODUCT MEDIA UPLOAD STORAGE =====
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media','product-media',true,2097152,array['image/webp','image/jpeg','image/png']::text[])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "product_media_public_read" on storage.objects;
create policy "product_media_public_read" on storage.objects for select to public
using (bucket_id='product-media');

drop policy if exists "product_media_admin_insert" on storage.objects;
create policy "product_media_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id='product-media' and public.is_imerssupa_admin());

drop policy if exists "product_media_admin_update" on storage.objects;
create policy "product_media_admin_update" on storage.objects for update to authenticated
using (bucket_id='product-media' and public.is_imerssupa_admin())
with check (bucket_id='product-media' and public.is_imerssupa_admin());

drop policy if exists "product_media_admin_delete" on storage.objects;
create policy "product_media_admin_delete" on storage.objects for delete to authenticated
using (bucket_id='product-media' and public.is_imerssupa_admin());
commit;


-- ============================================================
-- FINAL CLEAN INSTALLER HOTFIX: CHECKOUT + PAYMENT METHODS
-- ============================================================
-- iMersSUPA — FINAL CHECKOUT + PAYMENT METHODS HOTFIX
-- Version: FINAL CLEAN INSTALLER 2026-09-24
-- ============================================================
--
-- Purpose:
-- 1. Fix pgcrypto resolution for secure checkout.
-- 2. Restore the STEP 26 secure checkout wrapper/core architecture.
-- 3. Ensure new orders populate payment_fee + grand_total.
-- 4. Add safe admin payment-method upsert behavior so an edit from
--    the UI never wipes an existing private gateway config.
--
-- Safe to run after the canonical iMersSUPA SQL steps.
-- No bank account, QRIS, gateway token, or credential is hardcoded.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Verify pgcrypto functions used by secure checkout.
-- ------------------------------------------------------------

do $$
begin
  if to_regprocedure('extensions.digest(text,text)') is null then
    raise exception
      'FINAL HOTFIX FAILED: extensions.digest(text,text) is unavailable. Enable pgcrypto in Supabase first.';
  end if;

  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception
      'FINAL HOTFIX FAILED: extensions.gen_random_bytes(integer) is unavailable. Enable pgcrypto in Supabase first.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. Secure checkout token hashing.
-- ------------------------------------------------------------

create or replace function public.hash_checkout_token(p_token text)
returns text
language sql
immutable
strict
as $$
  select encode(extensions.digest(p_token,'sha256'),'hex')
$$;

revoke all on function public.hash_checkout_token(text) from public;

-- ------------------------------------------------------------
-- 3. Restore secure checkout core.
--
-- STEP 23 implementation, corrected to explicitly use pgcrypto
-- in the extensions schema and to populate grand_total.
-- ------------------------------------------------------------

create or replace function public.create_checkout_order_secure_core(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_customer_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_order public.orders%rowtype;
  v_item jsonb;

  v_coupon_id uuid;
  v_alias_id uuid;
  v_affiliate_id uuid;
  v_attribution_id uuid;

  v_raw_token text;
  v_token_hash text;

  v_key text := trim(coalesce(p_idempotency_key,''));
  v_scoped_key text;
  v_email text := lower(trim(coalesce(p_buyer_email,'')));
  v_name text := trim(coalesce(p_buyer_name,''));
  v_phone text := nullif(trim(coalesce(p_buyer_phone,'')),'');
  v_customer_key text;
begin
  if v_name='' or length(v_name)>150 then
    raise exception 'Valid buyer name is required';
  end if;

  if v_email=''
     or length(v_email)>254
     or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Valid buyer email is required';
  end if;

  if v_phone is not null and length(v_phone)>50 then
    raise exception 'Buyer phone is too long';
  end if;

  if length(coalesce(p_customer_note,''))>2000 then
    raise exception 'Customer note is too long';
  end if;

  if v_key='' then
    v_key := replace(gen_random_uuid()::text,'-','');
  elsif length(v_key)>120 then
    raise exception 'Idempotency key is too long';
  end if;

  v_scoped_key :=
    case
      when v_uid is not null
        then 'u:'||v_uid::text||':'||v_key
      else 'e:'||encode(extensions.digest(v_email,'sha256'),'hex')||':'||v_key
    end;

  select * into v_order
  from public.orders
  where idempotency_key=v_scoped_key;

  if found then
    return jsonb_build_object(
      'order_id',v_order.id,
      'order_number',v_order.order_number,
      'subtotal',v_order.subtotal,
      'discount_amount',v_order.discount_amount,
      'total_amount',v_order.total_amount,
      'currency',v_order.currency,
      'affiliate_name',v_order.affiliate_name_snapshot,
      'coupon_code',v_order.coupon_code_snapshot,
      'order_status',v_order.status,
      'payment_status',v_order.payment_status,
      'checkout_token',null,
      'idempotent_replay',true
    );
  end if;

  if trim(coalesce(p_coupon_code,''))<>'' then
    perform pg_advisory_xact_lock(
      hashtext('imerssupa-coupon:'||upper(trim(p_coupon_code)))
    );
  end if;

  if trim(coalesce(p_coupon_code,''))<>''
     and p_visitor_key is not null
     and trim(p_visitor_key)<>'' then
    perform *
    from public.apply_affiliate_alias_attribution(
      p_coupon_code,
      p_visitor_key
    );
  end if;

  v_quote := public.checkout_quote_internal(
    p_items,p_coupon_code,p_visitor_key,v_uid
  );

  v_coupon_id := nullif(v_quote#>>'{coupon,id}','')::uuid;
  v_alias_id := nullif(v_quote#>>'{coupon,affiliate_alias_id}','')::uuid;
  v_affiliate_id := nullif(v_quote#>>'{affiliate,id}','')::uuid;
  v_attribution_id := nullif(v_quote#>>'{affiliate,attribution_id}','')::uuid;

  v_raw_token :=
    encode(extensions.gen_random_bytes(32),'hex') ||
    replace(gen_random_uuid()::text,'-','');
  v_token_hash := public.hash_checkout_token(v_raw_token);

  insert into public.orders(
    order_number,idempotency_key,checkout_token_hash,
    buyer_user_id,buyer_name,buyer_email,buyer_phone,
    currency,subtotal,discount_amount,total_amount,
    payment_fee,grand_total,
    coupon_id,coupon_code_snapshot,coupon_kind_snapshot,
    affiliate_alias_id,affiliate_id,
    affiliate_name_snapshot,affiliate_referral_code_snapshot,
    attribution_id,attribution_mode_snapshot,
    affiliate_eligible_snapshot,no_affiliate_reason,
    status,payment_status,customer_note
  )
  values(
    public.generate_order_number(),v_scoped_key,v_token_hash,
    v_uid,v_name,v_email,v_phone,
    v_quote->>'currency',
    (v_quote->>'subtotal')::numeric,
    (v_quote->>'discount_amount')::numeric,
    (v_quote->>'total_amount')::numeric,
    0,
    (v_quote->>'total_amount')::numeric,
    v_coupon_id,v_quote#>>'{coupon,code}',
    nullif(v_quote#>>'{coupon,kind}','')::public.coupon_kind,
    v_alias_id,v_affiliate_id,
    v_quote#>>'{affiliate,name}',
    v_quote#>>'{affiliate,referral_code}',
    v_attribution_id,
    nullif(v_quote#>>'{affiliate,attribution_mode}','')
      ::public.affiliate_attribution_mode,
    v_affiliate_id is not null,
    v_quote->>'no_affiliate_reason',
    'pending','unpaid',
    nullif(trim(coalesce(p_customer_note,'')),'')
  )
  returning * into v_order;

  for v_item in
    select value from jsonb_array_elements(v_quote->'items')
  loop
    insert into public.order_items(
      order_id,product_id,
      product_name_snapshot,product_slug_snapshot,
      quantity,unit_price,line_subtotal,line_discount,line_total,
      coupon_eligible_snapshot,affiliate_eligible_snapshot,
      commission_percent_snapshot
    )
    values(
      v_order.id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'product_slug',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_subtotal')::numeric,
      (v_item->>'line_discount')::numeric,
      (v_item->>'line_total')::numeric,
      (v_item->>'coupon_eligible')::boolean,
      (v_item->>'affiliate_eligible')::boolean,
      nullif(v_item->>'commission_percent','')::numeric
    );
  end loop;

  if v_coupon_id is not null then
    v_customer_key :=
      case
        when v_uid is not null then 'user:'||v_uid::text
        else 'email:'||v_email
      end;

    if (
      select usage_limit_per_customer
      from public.coupons where id=v_coupon_id
    ) is not null then
      if (
        select count(*)
        from public.coupon_redemptions cr
        where cr.coupon_id=v_coupon_id
          and cr.customer_key=v_customer_key
          and cr.status in ('reserved','consumed')
      ) >= (
        select usage_limit_per_customer
        from public.coupons where id=v_coupon_id
      ) then
        raise exception 'Customer coupon usage limit reached';
      end if;
    end if;

    insert into public.coupon_redemptions(
      coupon_id,affiliate_alias_id,commerce_order_id,
      user_id,customer_key,discount_amount,status
    )
    values(
      v_coupon_id,v_alias_id,v_order.id,
      v_uid,v_customer_key,v_order.discount_amount,'reserved'
    );
  end if;

  return jsonb_build_object(
    'order_id',v_order.id,
    'order_number',v_order.order_number,
    'subtotal',v_order.subtotal,
    'discount_amount',v_order.discount_amount,
    'total_amount',v_order.total_amount,
    'currency',v_order.currency,
    'affiliate_name',v_order.affiliate_name_snapshot,
    'coupon_code',v_order.coupon_code_snapshot,
    'order_status',v_order.status,
    'payment_status',v_order.payment_status,
    'checkout_token',v_raw_token,
    'idempotent_replay',false
  );
end;
$$;

revoke all on function public.create_checkout_order_secure_core(
  jsonb,text,text,text,text,text,text,text
) from public;

-- ------------------------------------------------------------
-- 4. Restore STEP 26 public secure-checkout wrapper.
-- ------------------------------------------------------------

create or replace function public.create_checkout_order_secure(
  p_items jsonb,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text default null,
  p_coupon_code text default null,
  p_visitor_key text default null,
  p_customer_note text default null,
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
begin
  perform public.assert_commerce_checkout_allowed(p_buyer_phone);

  v_result:=public.create_checkout_order_secure_core(
    p_items,p_buyer_name,p_buyer_email,p_buyer_phone,
    p_coupon_code,p_visitor_key,p_customer_note,p_idempotency_key
  );

  v_order_id:=nullif(v_result->>'order_id','')::uuid;

  if v_order_id is not null
     and coalesce((v_result->>'idempotent_replay')::boolean,false)=false then
    select order_expiry_minutes into v_expiry
    from public.commerce_settings where id=1;

    update public.orders
    set expires_at=now()+make_interval(mins=>v_expiry)
    where id=v_order_id
      and payment_status in ('unpaid','pending');
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) from public;

grant execute on function public.create_checkout_order_secure(
  jsonb,text,text,text,text,text,text,text
) to anon,authenticated;

-- ------------------------------------------------------------
-- 5. Safe Payment Method admin upsert.
-- ------------------------------------------------------------
--
-- When p_config_private is NULL (as used by the UI), preserve the
-- existing private gateway configuration instead of overwriting it.
-- New methods still receive an empty JSON object when no private
-- config is supplied.
-- ------------------------------------------------------------

create or replace function public.admin_upsert_payment_method(
  p_id uuid,
  p_name text,
  p_code text,
  p_type public.payment_method_type,
  p_description text default null,
  p_instructions text default null,
  p_account_name text default null,
  p_account_number text default null,
  p_qris_image_url text default null,
  p_provider_name text default null,
  p_config_private jsonb default null,
  p_fee_fixed numeric default 0,
  p_fee_percent numeric default 0,
  p_min_amount numeric default null,
  p_max_amount numeric default null,
  p_sort_order integer default 0,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  if p_fee_fixed < 0 or p_fee_percent < 0 or p_fee_percent > 100 then
    raise exception 'Invalid payment fee';
  end if;

  if p_min_amount is not null and p_min_amount < 0 then
    raise exception 'Invalid minimum amount';
  end if;

  if p_max_amount is not null and p_max_amount < 0 then
    raise exception 'Invalid maximum amount';
  end if;

  if p_min_amount is not null and p_max_amount is not null
     and p_max_amount < p_min_amount then
    raise exception 'Maximum amount must be >= minimum amount';
  end if;

  if p_id is null then
    insert into public.payment_methods (
      name,code,type,description,instructions,
      account_name,account_number,qris_image_url,
      provider_name,config_private,
      fee_fixed,fee_percent,min_amount,max_amount,
      sort_order,active,created_by
    )
    values (
      p_name,upper(trim(p_code)),p_type,p_description,p_instructions,
      p_account_name,p_account_number,p_qris_image_url,
      p_provider_name,coalesce(p_config_private,'{}'::jsonb),
      p_fee_fixed,p_fee_percent,p_min_amount,p_max_amount,
      p_sort_order,p_active,auth.uid()
    )
    returning id into v_id;
  else
    update public.payment_methods
    set name=p_name,
        code=upper(trim(p_code)),
        type=p_type,
        description=p_description,
        instructions=p_instructions,
        account_name=p_account_name,
        account_number=p_account_number,
        qris_image_url=p_qris_image_url,
        provider_name=p_provider_name,
        config_private=coalesce(p_config_private,config_private),
        fee_fixed=p_fee_fixed,
        fee_percent=p_fee_percent,
        min_amount=p_min_amount,
        max_amount=p_max_amount,
        sort_order=p_sort_order,
        active=p_active,
        updated_at=now()
    where id=p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Payment method not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_payment_method(
  uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,
  numeric,numeric,numeric,numeric,integer,boolean
) from public;

grant execute on function public.admin_upsert_payment_method(
  uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,
  numeric,numeric,numeric,numeric,integer,boolean
) to authenticated;

-- ------------------------------------------------------------
-- 6. Final verification.
-- ------------------------------------------------------------

do $$
begin
  if to_regprocedure(
    'public.hash_checkout_token(text)'
  ) is null then
    raise exception 'FINAL HOTFIX FAILED: hash_checkout_token is missing';
  end if;

  if to_regprocedure(
    'public.create_checkout_order_secure_core(jsonb,text,text,text,text,text,text,text)'
  ) is null then
    raise exception 'FINAL HOTFIX FAILED: secure checkout core is missing';
  end if;

  if to_regprocedure(
    'public.create_checkout_order_secure(jsonb,text,text,text,text,text,text,text)'
  ) is null then
    raise exception 'FINAL HOTFIX FAILED: secure checkout wrapper is missing';
  end if;

  if to_regprocedure(
    'public.admin_upsert_payment_method(uuid,text,text,public.payment_method_type,text,text,text,text,text,text,jsonb,numeric,numeric,numeric,numeric,integer,boolean)'
  ) is null then
    raise exception 'FINAL HOTFIX FAILED: admin payment-method upsert is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='orders'
      and column_name='grand_total'
  ) then
    raise exception 'FINAL HOTFIX FAILED: orders.grand_total column is missing';
  end if;
end
$$;

commit;

-- ============================================================
-- END OF FINAL HOTFIX
-- ============================================================



-- ============================================================
-- FINAL CLEAN INSTALLER HOTFIX: NOTIFICATION LIFECYCLE v1.1
-- ============================================================
-- iMersSUPA - NOTIFICATION LIFECYCLE HOTFIX v1.1
--
-- PURPOSE
-- - Connect ALL customer commerce lifecycle events to the
--   existing notification engine.
-- - Every transactional event queues EMAIL + WHATSAPP when a
--   recipient exists. Channel preferences no longer suppress
--   transactional email/WhatsApp.
-- - Keep provider delivery outside SQL: the existing trusted
--   worker / Edge Function consumes notification_outbox.
--
-- EVENT MATRIX
--   order.created
--   payment.waiting_verification
--   payment.approved
--   payment.rejected
--   payment.failed
--   order.completed
--   order.cancelled
--   order.expired
--   order.refunded
--
-- IMPORTANT
-- - No WA/email provider credential is hardcoded here.
-- - No payment credential is hardcoded here.
-- - Anonymous checkout is supported through orders.buyer_email /
--   orders.buyer_phone even when buyer_user_id is NULL.
-- - Existing explicit commerce-event logging is kept, but lifecycle
--   triggers become the canonical wiring so every entry path is covered.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PRE-FLIGHT
-- ------------------------------------------------------------

do $$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.payment_transactions') is null
     or to_regclass('public.commerce_events') is null
     or to_regclass('public.notification_templates') is null
     or to_regclass('public.notification_preferences') is null
     or to_regclass('public.notification_outbox') is null
     or to_regprocedure('public.log_commerce_event(uuid,uuid,text,text,text,jsonb)') is null
     or to_regprocedure('public.queue_user_notification(uuid,uuid,text,jsonb,text)') is null then
    raise exception 'NOTIFICATION HOTFIX requires commerce + notification core (STEPS 19-26)';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 2. TRANSACTIONAL TEMPLATE MATRIX
--    Upsert every lifecycle event for in-app + email + WhatsApp.
-- ------------------------------------------------------------

insert into public.notification_templates(
  event_key,channel,name,subject_template,body_template,active,sort_order
)
values
-- ORDER CREATED
('order.created','in_app','Order Created',null,
 'Pesanan {{order_number}} berhasil dibuat. Total pembayaran {{grand_total}} {{currency}}.',true,10),
('order.created','email','Order Created Email',
 'Pesanan {{order_number}} berhasil dibuat',
 'Halo {{name}}, pesanan {{order_number}} berhasil dibuat dengan total {{grand_total}} {{currency}}. Silakan lanjutkan pembayaran.',true,11),
('order.created','whatsapp','Order Created WhatsApp',null,
 'Halo {{name}}, pesanan {{order_number}} berhasil dibuat. Total: {{grand_total}} {{currency}}. Silakan lanjutkan pembayaran.',true,12),

-- PAYMENT WAITING VERIFICATION
('payment.waiting_verification','in_app','Payment Waiting Verification',null,
 'Bukti pembayaran untuk pesanan {{order_number}} sudah diterima dan sedang menunggu verifikasi.',true,20),
('payment.waiting_verification','email','Payment Waiting Verification Email',
 'Pembayaran {{order_number}} sedang diverifikasi',
 'Halo {{name}}, bukti pembayaran pesanan {{order_number}} sudah kami terima dan sedang diverifikasi.',true,21),
('payment.waiting_verification','whatsapp','Payment Waiting Verification WhatsApp',null,
 'Halo {{name}}, bukti pembayaran pesanan {{order_number}} sudah diterima dan sedang menunggu verifikasi admin.',true,22),

-- PAYMENT APPROVED
('payment.approved','in_app','Payment Approved',null,
 'Pembayaran pesanan {{order_number}} sudah dikonfirmasi.',true,30),
('payment.approved','email','Payment Approved Email',
 'Pembayaran {{order_number}} berhasil dikonfirmasi',
 'Halo {{name}}, pembayaran pesanan {{order_number}} sebesar {{grand_total}} {{currency}} sudah dikonfirmasi.',true,31),
('payment.approved','whatsapp','Payment Approved WhatsApp',null,
 'Halo {{name}}, pembayaran pesanan {{order_number}} sudah dikonfirmasi. Terima kasih.',true,32),

-- PAYMENT REJECTED
('payment.rejected','in_app','Payment Rejected',null,
 'Pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,40),
('payment.rejected','email','Payment Rejected Email',
 'Pembayaran {{order_number}} perlu diperiksa kembali',
 'Halo {{name}}, pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,41),
('payment.rejected','whatsapp','Payment Rejected WhatsApp',null,
 'Halo {{name}}, pembayaran pesanan {{order_number}} belum dapat dikonfirmasi. {{message}}',true,42),

-- PAYMENT FAILED
('payment.failed','in_app','Payment Failed',null,
 'Pembayaran pesanan {{order_number}} gagal diproses. {{message}}',true,45),
('payment.failed','email','Payment Failed Email',
 'Pembayaran {{order_number}} gagal',
 'Halo {{name}}, pembayaran pesanan {{order_number}} gagal diproses. {{message}} Silakan coba kembali.',true,46),
('payment.failed','whatsapp','Payment Failed WhatsApp',null,
 'Halo {{name}}, pembayaran pesanan {{order_number}} gagal diproses. {{message}} Silakan coba kembali.',true,47),

-- ORDER COMPLETED
('order.completed','in_app','Order Completed',null,
 'Pesanan {{order_number}} selesai. Produk sudah tersedia di member area.',true,50),
('order.completed','email','Order Completed Email',
 'Akses produk {{order_number}} sudah aktif',
 'Halo {{name}}, pembayaran pesanan {{order_number}} selesai dan produk Anda sudah tersedia di member area.',true,51),
('order.completed','whatsapp','Order Completed WhatsApp',null,
 'Halo {{name}}, pesanan {{order_number}} selesai. Produk Anda sudah tersedia di member area.',true,52),

-- ORDER CANCELLED
('order.cancelled','in_app','Order Cancelled',null,
 'Pesanan {{order_number}} telah dibatalkan. {{message}}',true,60),
('order.cancelled','email','Order Cancelled Email',
 'Pesanan {{order_number}} dibatalkan',
 'Halo {{name}}, pesanan {{order_number}} telah dibatalkan. {{message}}',true,61),
('order.cancelled','whatsapp','Order Cancelled WhatsApp',null,
 'Halo {{name}}, pesanan {{order_number}} telah dibatalkan. {{message}}',true,62),

-- ORDER EXPIRED
('order.expired','in_app','Order Expired',null,
 'Pesanan {{order_number}} telah kedaluwarsa karena belum diselesaikan dalam batas waktu pembayaran.',true,65),
('order.expired','email','Order Expired Email',
 'Pesanan {{order_number}} kedaluwarsa',
 'Halo {{name}}, pesanan {{order_number}} telah kedaluwarsa karena pembayaran belum diselesaikan dalam batas waktu yang ditentukan.',true,66),
('order.expired','whatsapp','Order Expired WhatsApp',null,
 'Halo {{name}}, pesanan {{order_number}} telah kedaluwarsa karena pembayaran belum diselesaikan dalam batas waktu yang ditentukan.',true,67),

-- ORDER REFUNDED
('order.refunded','in_app','Order Refunded',null,
 'Pesanan {{order_number}} telah direfund. {{message}}',true,70),
('order.refunded','email','Order Refunded Email',
 'Refund pesanan {{order_number}} diproses',
 'Halo {{name}}, pesanan {{order_number}} telah direfund. {{message}}',true,71),
('order.refunded','whatsapp','Order Refunded WhatsApp',null,
 'Halo {{name}}, pesanan {{order_number}} telah direfund. {{message}}',true,72)

on conflict(event_key,channel) do update
set name=excluded.name,
    subject_template=excluded.subject_template,
    body_template=excluded.body_template,
    active=excluded.active,
    sort_order=excluded.sort_order,
    updated_at=now();

-- ------------------------------------------------------------
-- 3. FORCE TRANSACTIONAL EMAIL + WHATSAPP
--
-- Preferences remain useful for in-app notifications, but they do
-- not disable transactional email/WhatsApp. This makes the commerce
-- notification contract deterministic.
-- ------------------------------------------------------------

alter table public.notification_preferences
  alter column email_enabled set default true;

alter table public.notification_preferences
  alter column whatsapp_enabled set default true;

update public.notification_preferences
set email_enabled=true,
    whatsapp_enabled=true,
    updated_at=now()
where email_enabled is distinct from true
   or whatsapp_enabled is distinct from true;

-- Existing member preference RPC: outbound transactional channels
-- are mandatory, so only in-app remains user-configurable here.
create or replace function public.update_my_notification_preferences(
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_whatsapp_enabled boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.notification_preferences(
    user_id,in_app_enabled,email_enabled,whatsapp_enabled
  )
  values(
    auth.uid(),
    coalesce(p_in_app_enabled,true),
    true,
    true
  )
  on conflict(user_id) do update
  set in_app_enabled=excluded.in_app_enabled,
      email_enabled=true,
      whatsapp_enabled=true,
      updated_at=now();
end;
$$;

revoke all on function public.update_my_notification_preferences(
  boolean,boolean,boolean
) from public;
grant execute on function public.update_my_notification_preferences(
  boolean,boolean,boolean
) to authenticated;

-- ------------------------------------------------------------
-- 4. REBUILD NOTIFICATION QUEUE DISPATCHER
--
-- Supports both authenticated members and anonymous checkout orders.
-- Email + WhatsApp are queued whenever the order has the recipient.
-- ------------------------------------------------------------

create or replace function public.queue_user_notification(
  p_user_id uuid,
  p_order_id uuid,
  p_event_key text,
  p_context jsonb default '{}'::jsonb,
  p_action_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pref public.notification_preferences%rowtype;
  v_order public.orders%rowtype;
  v_template public.notification_templates%rowtype;
  v_title text;
  v_body text;
  v_email text;
  v_phone text;
  v_in_app_count integer := 0;
  v_outbox_count integer := 0;
  v_has_user boolean := false;
begin
  -- Load order snapshot first. Anonymous checkout is allowed to have
  -- p_user_id = NULL, but still has buyer email/phone.
  if p_order_id is not null then
    select * into v_order
    from public.orders
    where id=p_order_id;

    if not found then
      return jsonb_build_object('in_app',0,'outbox',0);
    end if;
  end if;

  if p_user_id is not null then
    select * into v_profile
    from public.profiles
    where id=p_user_id;

    if found then
      v_has_user := true;
    end if;

    insert into public.notification_preferences(user_id)
    values(p_user_id)
    on conflict(user_id) do nothing;

    select * into v_pref
    from public.notification_preferences
    where user_id=p_user_id;

    -- Resolve profile email/phone where those columns exist.
    if exists(
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='profiles'
        and column_name='email'
    ) then
      execute 'select email from public.profiles where id=$1'
      into v_email using p_user_id;
    end if;

    if exists(
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='profiles'
        and column_name='phone'
    ) then
      execute 'select phone from public.profiles where id=$1'
      into v_phone using p_user_id;
    end if;
  end if;

  -- Order snapshot is authoritative fallback for transactional delivery.
  if p_order_id is not null then
    v_email := coalesce(nullif(trim(v_email),''),nullif(trim(v_order.buyer_email),''));
    v_phone := coalesce(nullif(trim(v_phone),''),nullif(trim(v_order.buyer_phone),''));
  end if;

  for v_template in
    select *
    from public.notification_templates
    where event_key=p_event_key
      and active=true
    order by sort_order,id
  loop
    v_title := public.render_notification_template(
      coalesce(v_template.subject_template,v_template.name),
      p_context
    );

    v_body := public.render_notification_template(
      v_template.body_template,
      p_context
    );

    -- In-app can still follow the user's in-app preference.
    if v_template.channel='in_app'
       and v_has_user
       and coalesce(v_pref.in_app_enabled,true) then
      insert into public.notifications(
        user_id,order_id,event_key,title,body,action_url,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,
        v_title,v_body,p_action_url,coalesce(p_context,'{}'::jsonb)
      );
      v_in_app_count:=v_in_app_count+1;

    -- Transactional email is mandatory when an email recipient exists.
    elsif v_template.channel='email'
          and nullif(trim(coalesce(v_email,'')),'') is not null then
      insert into public.notification_outbox(
        user_id,order_id,event_key,channel,
        recipient,subject,body,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,'email',
        lower(trim(v_email)),v_title,v_body,
        coalesce(p_context,'{}'::jsonb)
      );
      v_outbox_count:=v_outbox_count+1;

    -- Transactional WhatsApp is mandatory when a phone recipient exists.
    elsif v_template.channel='whatsapp'
          and nullif(trim(coalesce(v_phone,'')),'') is not null then
      insert into public.notification_outbox(
        user_id,order_id,event_key,channel,
        recipient,subject,body,metadata
      )
      values(
        p_user_id,p_order_id,p_event_key,'whatsapp',
        trim(v_phone),null,v_body,
        coalesce(p_context,'{}'::jsonb)
      );
      v_outbox_count:=v_outbox_count+1;
    end if;
  end loop;

  return jsonb_build_object(
    'in_app',v_in_app_count,
    'outbox',v_outbox_count,
    'email_recipient',nullif(trim(coalesce(v_email,'')),''),
    'whatsapp_recipient',nullif(trim(coalesce(v_phone,'')),''),
    'transactional_email',true,
    'transactional_whatsapp',true
  );
end;
$$;

revoke all on function public.queue_user_notification(
  uuid,uuid,text,jsonb,text
) from public;

-- ------------------------------------------------------------
-- 5. COMMERCE EVENT -> NOTIFICATION MAPPING
-- ------------------------------------------------------------

create or replace function public.notify_from_commerce_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_event_key text;
  v_context jsonb;
begin
  if new.order_id is null then
    return new;
  end if;

  select * into v_order
  from public.orders
  where id=new.order_id;

  if not found then
    return new;
  end if;

  v_event_key :=
    case new.event_type
      when 'order.created' then 'order.created'
      when 'payment.waiting_verification' then 'payment.waiting_verification'
      when 'payment.approved' then 'payment.approved'
      when 'payment.rejected' then 'payment.rejected'
      when 'payment.failed' then 'payment.failed'
      when 'order.completed' then 'order.completed'
      when 'order.cancelled' then 'order.cancelled'
      when 'order.expired' then 'order.expired'
      when 'order.refunded' then 'order.refunded'
      else null
    end;

  if v_event_key is null then
    return new;
  end if;

  v_context := jsonb_build_object(
    'name',v_order.buyer_name,
    'order_number',v_order.order_number,
    'grand_total',v_order.grand_total::text,
    'currency',v_order.currency,
    'message',coalesce(new.message,''),
    'event_type',new.event_type
  ) || coalesce(new.metadata,'{}'::jsonb);

  perform public.queue_user_notification(
    v_order.buyer_user_id,
    v_order.id,
    v_event_key,
    v_context,
    case
      when v_event_key='order.created' then '/checkout/order/'||v_order.id::text
      when v_event_key in ('order.cancelled','order.expired','order.refunded') then '/member/orders'
      else '/member'
    end
  );

  return new;
end;
$$;

drop trigger if exists trg_commerce_event_notification
on public.commerce_events;

create trigger trg_commerce_event_notification
after insert on public.commerce_events
for each row execute function public.notify_from_commerce_event();

-- ------------------------------------------------------------
-- 6. ORDER CREATED: AUTOMATIC EVENT FOR EVERY ORDER INSERT
-- ------------------------------------------------------------

create or replace function public.notify_order_created_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.log_commerce_event(
    new.id,
    null,
    'order.created',
    'system_trigger',
    'Order created',
    jsonb_build_object(
      'order_number',new.order_number,
      'status',new.status,
      'payment_status',new.payment_status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_order_created_notification
on public.orders;

create trigger trg_order_created_notification
after insert on public.orders
for each row execute function public.notify_order_created_event();

-- ------------------------------------------------------------
-- 7. ORDER STATUS LIFECYCLE
-- completed / cancelled / expired / refunded
-- ------------------------------------------------------------

create or replace function public.notify_order_status_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_event_key text;
  v_message text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  v_event_key :=
    case new.status
      when 'completed' then 'order.completed'
      when 'cancelled' then 'order.cancelled'
      when 'expired' then 'order.expired'
      when 'refunded' then 'order.refunded'
      else null
    end;

  if v_event_key is null then
    return new;
  end if;

  v_message := case
    when v_event_key='order.cancelled' then coalesce(new.admin_note,'Order cancelled')
    when v_event_key='order.refunded' then 'Order refunded'
    when v_event_key='order.expired' then 'Order expired'
    else 'Order completed'
  end;

  perform public.log_commerce_event(
    new.id,
    null,
    v_event_key,
    'system_trigger',
    v_message,
    jsonb_build_object(
      'old_status',old.status,
      'new_status',new.status,
      'payment_status',new.payment_status
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_order_completed_notification
on public.orders;

drop trigger if exists trg_order_status_notification
on public.orders;

create trigger trg_order_status_notification
after update of status on public.orders
for each row
when (
  new.status in ('completed','cancelled','expired','refunded')
  and old.status is distinct from new.status
)
execute function public.notify_order_status_event();

-- ------------------------------------------------------------
-- 8. PAYMENT TRANSACTION LIFECYCLE
-- waiting_verification / approved / rejected / failed
-- ------------------------------------------------------------

create or replace function public.notify_payment_status_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_event_key text;
  v_message text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  v_event_key :=
    case new.status
      when 'waiting_verification' then 'payment.waiting_verification'
      when 'paid' then 'payment.approved'
      when 'rejected' then 'payment.rejected'
      when 'failed' then 'payment.failed'
      else null
    end;

  if v_event_key is null then
    return new;
  end if;

  select * into v_order
  from public.orders
  where id=new.order_id;

  if not found then
    return new;
  end if;

  v_message := case new.status
    when 'waiting_verification' then 'Payment proof submitted and waiting for verification'
    when 'paid' then 'Payment approved'
    when 'rejected' then coalesce(new.rejection_reason,'Payment rejected')
    when 'failed' then coalesce(new.rejection_reason,'Payment failed')
    else 'Payment status changed'
  end;

  perform public.log_commerce_event(
    v_order.id,
    new.id,
    v_event_key,
    'system_trigger',
    v_message,
    jsonb_build_object(
      'payment_transaction_id',new.id,
      'payment_status',new.status,
      'payment_method',new.payment_method_name_snapshot,
      'payment_method_code',new.payment_method_code_snapshot,
      'payment_method_type',new.payment_method_type_snapshot,
      'amount_due',new.amount_due,
      'provider_name',new.provider_name,
      'provider_reference',new.provider_reference,
      'rejection_reason',new.rejection_reason
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_payment_status_notification
on public.payment_transactions;

create trigger trg_payment_status_notification
after insert or update of status on public.payment_transactions
for each row
when (
  new.status in ('waiting_verification','paid','rejected','failed')
  and old.status is distinct from new.status
)
execute function public.notify_payment_status_event();

-- ------------------------------------------------------------
-- 9. REMOVE DUPLICATE EXPLICIT EVENT LOGGING
--
-- Lifecycle triggers above are now canonical for payment approved/
-- rejected and order cancelled/refunded. The admin wrappers still
-- perform their canonical business operations, but must not insert a
-- second identical notification event.
-- ------------------------------------------------------------

create or replace function public.admin_review_payment_operation(
  p_payment_transaction_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_order public.orders%rowtype;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_tx
  from public.payment_transactions
  where id=p_payment_transaction_id;

  if not found then
    raise exception 'Payment transaction not found';
  end if;

  select * into v_order
  from public.orders
  where id=v_tx.order_id;

  perform public.admin_review_manual_payment(
    p_payment_transaction_id,
    p_approve,
    p_note
  );

  -- Payment status trigger has already logged the notification event.
  return public.admin_get_order_detail(v_order.id);
end;
$$;

revoke all on function public.admin_review_payment_operation(uuid,boolean,text)
from public;
grant execute on function public.admin_review_payment_operation(uuid,boolean,text)
to authenticated;

create or replace function public.admin_cancel_order_operation(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  v_result := public.cancel_unpaid_order_secure(
    p_order_id,
    null,
    p_reason
  );

  -- Order status trigger has already logged order.cancelled.
  return v_result;
end;
$$;

revoke all on function public.admin_cancel_order_operation(uuid,text)
from public;
grant execute on function public.admin_cancel_order_operation(uuid,text)
to authenticated;

create or replace function public.admin_refund_order_operation(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if not public.is_imerssupa_admin() then
    raise exception 'Admin access required';
  end if;

  v_result := public.admin_refund_order(p_order_id,p_reason);

  -- Order status trigger has already logged order.refunded.
  return v_result;
end;
$$;

revoke all on function public.admin_refund_order_operation(uuid,text)
from public;
grant execute on function public.admin_refund_order_operation(uuid,text)
to authenticated;

-- ------------------------------------------------------------
-- 10. VERIFICATION
-- ------------------------------------------------------------

do $$
declare
  v_missing_templates integer;
  v_missing_triggers integer;
begin
  select count(*) into v_missing_templates
  from (
    values
      ('order.created'::text,'in_app'::public.notification_channel),
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
  ) required(event_key,channel)
  where not exists (
    select 1
    from public.notification_templates nt
    where nt.event_key=required.event_key
      and nt.channel=required.channel
      and nt.active=true
  );

  select count(*) into v_missing_triggers
  from (
    values
      ('trg_commerce_event_notification'::text,'commerce_events'::text),
      ('trg_order_created_notification','orders'),
      ('trg_order_status_notification','orders'),
      ('trg_payment_status_notification','payment_transactions')
  ) required(trigger_name,table_name)
  where not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where t.tgname=required.trigger_name
      and c.relname=required.table_name
      and n.nspname='public'
      and not t.tgisinternal
  );

  if v_missing_templates<>0 then
    raise exception 'Notification hotfix verification failed: % active templates missing',v_missing_templates;
  end if;

  if v_missing_triggers<>0 then
    raise exception 'Notification hotfix verification failed: % triggers missing',v_missing_triggers;
  end if;
end
$$;

commit;

-- ============================================================
-- POST-COMMIT QUICK CHECKS
-- Run manually after deployment if desired:
--
-- select event_key,channel,active
-- from public.notification_templates
-- where event_key in (
--   'order.created','payment.waiting_verification','payment.approved',
--   'payment.rejected','payment.failed','order.completed',
--   'order.cancelled','order.expired','order.refunded'
-- )
-- order by sort_order,channel;
--
-- select tgname, c.relname
-- from pg_trigger t
-- join pg_class c on c.oid=t.tgrelid
-- join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public'
--   and tgname in (
--     'trg_commerce_event_notification',
--     'trg_order_created_notification',
--     'trg_order_status_notification',
--     'trg_payment_status_notification'
--   );
--
-- select event_key,channel,status,recipient,created_at,last_error
-- from public.notification_outbox
-- where created_at > now()-interval '1 hour'
-- order by created_at desc;
-- ============================================================

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
