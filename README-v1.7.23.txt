iMersSUPA v1.7.23
SQL MIGRATION: REQUIRED
FRONTEND/API UPDATE: REQUIRED

Existing installation:
1. Run supabase/migrations/iMersSUPA-MIGRATION-v1.7.23-COMMERCE-PERMISSION-AUDIT.sql
2. Deploy frontend/API v1.7.23.
3. Test Orders -> Detail -> AKTIFKAN ORDER.

Fixes:
- Activation API no longer reads/updates orders using the service-role database client.
- Order lookup uses the authenticated admin session and existing admin RLS SELECT policy.
- buyer_user_id binding uses SECURITY DEFINER RPC admin_bind_order_buyer.
- Explicit service_role grants restored for trusted server operations.
- Browser direct writes to commerce tables remain revoked.
- Existing checkout/payment/notification read grants are re-asserted without opening direct mutations.
