# iMersSUPA Affiliate Product Link Generator HOTFIX v1.6

SQL MIGRATION: NOT REQUIRED.

Replace:
- app/member/affiliate/page.tsx

Changes:
- Does not load/render all affiliate products.
- Member searches a product on demand by name or slug.
- Minimum search: 2 characters.
- Maximum results: 10 per request.
- Only published products with affiliate enabled can appear.
- Select a result to generate the per-product affiliate URL.
- Copy Link and Open Product actions are included.
- Existing referral code, payout, commission, stats, and sidebar are preserved.
