iMersSUPA HOTFIX v1.7.26 — AGENCY + MEMBER UNIFIED

SQL MIGRATION: NOT REQUIRED
FRONTEND UPDATE: REQUIRED

UNTUK EXISTING INSTALL v1.7.25:
Replace hanya:
- app/login/page.tsx
- app/member/page.tsx
- app/agency/page.tsx

Tujuan:
- Agency diterima saat login.
- Agency menggunakan Member Area yang sama.
- Semua fitur/menu Member tetap tersedia untuk Agency.
- Agency mendapat tambahan Kelola Member & Akses.
- Role Agency tetap Agency; tidak dikonversi menjadi Member.
- Tidak mengubah SQL, checkout, payment, order, notification, atau affiliate engine.

Setelah replace:
1. Commit/push.
2. Deploy Vercel.
3. Hard refresh / logout-login ulang.
