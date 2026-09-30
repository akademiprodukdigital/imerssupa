iMersSUPA HOTFIX v1.7.20 — AGENCY + MEMBER UNIFIED

SQL MIGRATION: REQUIRED
FRONTEND UPDATE: REQUIRED

Tujuan:
- Agency tetap role Agency.
- Agency tetap memiliki kemampuan Member untuk produk yang dibeli/dimiliki sendiri.
- Pembelian produk tidak dibatasi role.
- Agency Tools tetap hanya untuk Agency.
- Sidebar Agency memakai font yang konsisten dan menyediakan akses Member Area.
- Tidak mengubah order/payment/notification/affiliate engine selain akses navigasi Affiliate Center.

Install existing:
1. Jalankan sql/iMersSUPA-MIGRATION-v1.7.20-AGENCY-MEMBER-UNIFIED.sql
2. Replace app/agency/page.tsx
3. app/login/page.tsx disertakan sebagai reference verified-current; tidak ada perubahan routing berisiko.
4. Deploy Vercel.
5. Test akun Agency:
   - Produk yang dibeli -> Member Area > Produk Saya
   - materi -> Lanjut Belajar
   - Resources
   - Affiliate Center
   - Agency Dashboard
   - Produk & Lisensi Agency
   - Member Saya
   - Buat Member

CATATAN:
File member dashboard penuh TIDAK ditimpa di hotfix ini karena source Library yang tersedia lebih lama
daripada deployment yang sudah memiliki Affiliate Center. Ini sengaja agar fitur Affiliate yang sudah hidup tidak regress.
