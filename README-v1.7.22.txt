iMersSUPA v1.7.22
SQL MIGRATION: REQUIRED

Existing installation:
1. Run supabase/migrations/iMersSUPA-MIGRATION-v1.7.22-ORDER-ACTIVATION-CANONICAL.sql once in Supabase SQL Editor.
2. Deploy frontend/API hotfix v1.7.22.

Fixes:
- Canonical Orders > Detail > AKTIFKAN ORDER flow.
- Member resolution uses auth.users.email; profiles.email is never assumed.
- Existing order UUID is preserved and buyer_user_id is bound to the member account.
- Completed/Paid + member_access delivery remain one activation path.
- API now exposes actual Supabase error message/code/details/hint instead of hiding it behind a generic message.
- Fresh installer master SQL includes the same v1.7.22 backend definitions.
