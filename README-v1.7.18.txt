iMersSUPA HOTFIX v1.7.18 — AUTO MEMBER ON CHECKOUT

SQL MIGRATION: NOT REQUIRED
FRONTEND/SERVER UPDATE: REQUIRED

Aturan final:
- Checkout pertama otomatis membuat/menemukan akun Member berdasarkan email.
- Order tetap Pending/Unpaid sampai pembayaran/aktivasi.
- Member yang belum bayar tetap terdaftar, tetapi belum diberi akses produk.
- Orders → Detail → AKTIFKAN ORDER otomatis memastikan member ada, bind buyer_user_id, lalu menjalankan admin_activate_order_simple.
- Rp0 tetap mengikuti free-order flow yang sudah ada.
- Tidak memakai browser confirm; modal aktivasi v1.7.16 dipertahankan.
- Tidak mengubah layout/sidebar Orders v1.7.16.

WAJIB ENV VERCEL:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY

Catatan:
Supabase Auth invite dipakai saat email baru pertama kali checkout agar akun Auth benar-benar tercipta tanpa password default yang mudah ditebak.
