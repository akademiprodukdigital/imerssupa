iMersSUPA MEMBER AFFILIATE CENTER HOTFIX v1.3

UPDATE EXISTING v1.2:
1. Replace components/MemberShell.tsx
2. Add app/member/affiliate/page.tsx
3. Deploy again.

SQL MIGRATION: NOT REQUIRED for databases installed from FINAL CLEAN v1.2.
The required affiliate tables, RLS and RPC functions already exist in v1.2:
- join_affiliate_program()
- update_affiliate_payout_profile()
- affiliate_settings / affiliates / product_affiliate_rules
- affiliate_clicks / affiliate_orders / affiliate_commissions / affiliate_payouts

IMPORTANT:
Affiliate Center follows Admin Affiliate Settings. If affiliate_settings.enabled=false,
member sees "Program Affiliate Belum Aktif" until Super Admin enables it.
