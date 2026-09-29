iMersSUPA v1.7.14
UI RESTORE / ORDERS ONLY

FRONTEND:
- Replaces ONLY app/admin/orders/page.tsx.
- Uses the AdminShell/shared admin layout.
- Does NOT replace Content.
- Adds only Detail > AKTIFKAN ORDER.

SQL:
- Run only if admin_activate_order_simple has not already been installed successfully.

VALIDATION:
- app/admin/orders/page.tsx TypeScript parser/transpile diagnostics: PASS.
- ZIP integrity: PASS.
