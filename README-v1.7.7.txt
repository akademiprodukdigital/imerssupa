iMersSUPA HOTFIX v1.7.7
SQL MIGRATION: NOT REQUIRED
FRONTEND UPDATE: REQUIRED

Fixes:
- Correct JSX tree: removes the extra closing </div> that broke Vercel build.
- Restores LIGHT PREMIUM checkout stylesheet on the normal loaded state.
- Keeps storage-safe localStorage/sessionStorage handling.
- Keeps try/catch/finally anti-infinite-loading protection.

Replace at project root, then deploy.
