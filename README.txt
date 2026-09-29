iMersSUPA v1.7.15 — ORDERS LAYOUT FIX

SQL MIGRATION: NOT REQUIRED
FRONTEND UPDATE: REQUIRED

BASE:
Built from the user's uploaded imerssupa-main(3).zip.

FIX:
- Removes the invalid AdminShell dependency.
- Orders now carries the same working sidebar geometry/style used by the current Payments page.
- Sidebar 268px + content margin-left 268px, so content cannot overlap the sidebar.
- Responsive offset stays synchronized at <=1050px.
- Mobile <=760px removes sidebar and resets content margin.
- Keeps Detail > AKTIFKAN ORDER.
- LIGHT UI only; dark-mode CSS removed.
- No Content, Products, Payments, Checkout, or other page is replaced.

VALIDATION:
- AdminShell reference: NONE.
- Existing Supabase import path checked.
- TypeScript/JSX syntax diagnostics: PASS.
- ZIP integrity: PASS.
- Full npm build was attempted, but dependency installation did not complete in the execution environment, so this README does NOT claim a full Next.js build pass.
