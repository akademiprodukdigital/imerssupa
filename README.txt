iMersSUPA HOTFIX v1.7.21
SQL MIGRATION: NOT REQUIRED
FRONTEND/API UPDATE: REQUIRED

Fix:
- Orders -> Detail -> AKTIFKAN ORDER now sends both database UUID and visible order_number.
- Activation API resolves the canonical order UUID safely from UUID or order_number.
- Existing orders such as IMS-20260924-DC8F3C86 are not recreated/deleted.
- Existing admin auth, ensure-member flow, and admin_activate_order_simple RPC are preserved.

Replace these files preserving paths, then redeploy.
