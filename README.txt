iMersSUPA HOTFIX v1.7.24
SQL MIGRATION: REQUIRED
FRONTEND/API UPDATE: REQUIRED

1. Jalankan supabase/migrations/iMersSUPA-MIGRATION-v1.7.24-ROLE-INDEPENDENT-PRODUCT-ACCESS.sql
2. Replace app/api/_ensure-member.ts
3. Deploy ulang Vercel.

Rule: order/product access tidak bergantung pada role akun. Existing role tidak diubah.
