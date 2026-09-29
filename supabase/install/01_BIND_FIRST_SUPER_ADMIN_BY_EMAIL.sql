-- iMersSUPA - Bind First Super Admin by Email
-- 1) Create the user first in Supabase Authentication > Users > Add user.
-- 2) Replace OWNER_EMAIL_DI_SINI below, then Run.

do $$
declare
  v_user_id uuid;
  v_email text := lower(trim('OWNER_EMAIL_DI_SINI'));
begin
  if v_email = 'owner_email_di_sini' or position('@' in v_email)=0 then
    raise exception 'Replace OWNER_EMAIL_DI_SINI with the real owner email first.';
  end if;

  select id into v_user_id from auth.users where lower(email)=v_email limit 1;
  if v_user_id is null then
    raise exception 'Auth user not found for email: %', v_email;
  end if;

  insert into public.profiles(id,full_name,role,status)
  values(v_user_id,coalesce((select raw_user_meta_data->>'full_name' from auth.users where id=v_user_id),''),'super_admin','active')
  on conflict(id) do update set role='super_admin',status='active',updated_at=now();
end $$;

select u.id as auth_user_id,u.email,p.full_name,p.role,p.status
from auth.users u join public.profiles p on p.id=u.id
where lower(u.email)=lower(trim('OWNER_EMAIL_DI_SINI'));
