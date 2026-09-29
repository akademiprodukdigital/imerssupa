iMersSUPA v1.7.13 RECOVERY
BASE DEPLOYMENT: v1.7.10 / repository that was contaminated by broken v1.7.11 Content page

SQL MIGRATION: REQUIRED only if admin_activate_order_simple has NOT been installed yet.
FRONTEND UPDATE: REQUIRED.

WHAT THIS PACKAGE DOES
1. Restores app/admin/content/page.tsx to the known pre-v1.7.11 implementation, removing the syntax error around line 194.
2. Keeps the simple Orders > Detail > AKTIFKAN ORDER flow.
3. Does not require Payment Queue for manual activation.
4. Includes the activation SQL so this package can be used cumulatively.

IMPORTANT
- Replace BOTH frontend files from this ZIP.
- Do not keep the broken v1.7.11 app/admin/content/page.tsx.
- Run the SQL once if the v1.7.12 activation SQL was never successfully installed.

VALIDATION
- Both TSX files were parsed/transpiled with TypeScript compiler diagnostics: PASS.
- ZIP integrity checked after creation.
- This is a syntax validation of the patched files, not a full Next.js project build because the complete current deployed repository is not present in this recovery package.
