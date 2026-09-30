iMersSUPA HOTFIX v1.7.21 — LOGIN AGENCY FIX

SQL MIGRATION: NOT REQUIRED
FRONTEND UPDATE: REQUIRED

Fix:
- Login menerima role: super_admin, admin, agency, member.
- Agency tidak lagi ditolak sebagai "Role akun tidak valid".
- Agency redirect tetap ke /agency.
- Tidak mengubah database, checkout, order, payment, notification, affiliate, atau member access.

INSTALL:
Replace app/login/page.tsx lalu deploy ulang Vercel.
JANGAN jalankan SQL apa pun untuk hotfix ini.
