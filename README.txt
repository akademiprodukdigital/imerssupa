iMersSUPA Admin Orders Action Hotfix v1.2

UPDATE:
- Tambah tombol Batalkan Pesanan pada Order Detail untuk order pending/unpaid.
- Menggunakan RPC backend existing: public.cancel_unpaid_order(uuid,text).
- Cancel adalah soft lifecycle status, BUKAN hard delete.
- Order tetap tersimpan untuk history/audit.
- Setelah cancel, list + detail order otomatis refresh.
- Tombol tidak muncul untuk paid/completed/refunded/cancelled/expired.
- UI tetap LIGHT PREMIUM.

DATABASE / MIGRATION:
TIDAK PERLU menjalankan migration SQL baru apabila backend berasal dari iMersSUPA FINAL CLEAN INSTALLER v1.1, karena function cancel_unpaid_order(uuid,text) sudah tersedia dan sudah diberi EXECUTE ke authenticated.

INSTALL:
Replace file:
app/admin/orders/page.tsx

Kemudian deploy ulang frontend ke Vercel.
