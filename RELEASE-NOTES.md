# iMersSUPA FINAL CLEAN INSTALLER v1.3

## Member Affiliate Center
- Added Affiliate Center menu in Member Area.
- Member can join affiliate program using existing secure RPC.
- Shows affiliate status, referral code/link, clicks, referred orders, available/pending commission.
- Shows affiliate-enabled products and per-product referral links.
- Member can save payout profile.
- Shows latest commission history.
- Respects global affiliate enabled/disabled, auto approval, product affiliate rules and RLS.
- No new SQL migration is required for existing v1.2 databases because affiliate schema/RPC/RLS already exist.

# iMersSUPA — FINAL CLEAN CLIENT INSTALLER v1.1

## 2026-09-24

### Checkout / Payment
- Fixed secure checkout pgcrypto resolution using the `extensions` schema.
- Restored the secure checkout core + wrapper architecture.
- New orders now populate `payment_fee` and `grand_total` correctly.
- Added Payment Methods management UI.
- Preserved existing private gateway configuration when editing a payment method without replacing it.
- Kept all payment credentials configurable; nothing is hardcoded.

### UI
- Checkout/order payment page uses the light premium visual language used by the product and checkout pages.
- Admin Payment Methods UI is light and consistent with the existing admin experience.

### Notifications
- Connected order creation to `order.created` commerce events.
- Connected payment lifecycle events to notification dispatch.
- Connected order status lifecycle events to notification dispatch.
- Transactional Email + WhatsApp are queued whenever the corresponding buyer contact exists.
- Added active templates for all supported commerce lifecycle events and channels.
- Removed demo notification recipients/history from the fresh installer.
- Added final installer verification for notification triggers, templates, functions, and outbox.

### Fresh Install
- Installer now contains one consolidated `00_FULL_FRESH_INSTALL_IMERSSUPA.sql` with the latest checkout, payment-method, and notification lifecycle fixes already applied.
- No client-specific bank, QRIS, WhatsApp, or email credentials are included.


## v1.2 — Admin Orders Action
- Added **Batalkan Pesanan** action for eligible Pending/Unpaid orders in Admin → Orders & Transactions.
- Uses the existing `cancel_unpaid_order(uuid,text)` backend RPC; order history is preserved (no hard delete).
- Paid/completed/refunded/cancelled/expired orders are protected from this action.
- No additional SQL migration is required when installing this v1.2 fresh installer because the required backend function is already included in the bundled fresh-install SQL.

## v1.4 — Member Affiliate Navigation Safety Fix
- Added **Affiliate Center** to the primary Member Area desktop sidebar in `app/member/page.tsx`.
- Added **Affiliate Center** to the Member Area mobile drawer/sidebar.
- Preserved Dashboard, Produk Saya, Lanjut Belajar, Resources, and Profile & Account entries unchanged.
- Existing `/member/affiliate` page and `MemberShell` Affiliate Center navigation remain intact.
- No SQL migration is required for installations already using the v1.3 backend.

## v1.5
- Affiliate referral codes now use lowercase URL-friendly name-based codes, e.g. `terry7k3p`.
- Removed the old uppercase `AFF...` generator.
- Added case-insensitive referral-code uniqueness.
- Existing legacy auto-generated `AFF...` codes are migrated on upgrade.
- No manual referral-code editing is exposed to members.

## v1.6 — Member Affiliate Product Link Generator
- Replaced the bulk affiliate-product list with an on-demand product search.
- Affiliate members search by product name or slug, with a maximum of 10 results per request.
- Only published products with affiliate enabled are returned.
- Selecting a product generates its referral URL using the member's existing referral code.
- Added Copy Link and Open Product actions.
- No database migration is required for v1.6; it uses the existing product_affiliate_rules/products RLS from the current backend.

## v1.7 — Sales Page Manager
- Sales Page per product: None / Internal HTML / External URL.
- Direct Checkout URL tetap tersedia pada semua mode.
- Admin Products mendapat action Sales Page.
- Internal HTML editor + preview + placeholder `{{PRODUCT_NAME}}` dan `{{CHECKOUT_URL}}`.
- External URL meneruskan parameter `ref` dan `coupon`.
- Public product page mencatat referral affiliate dan mempertahankan attribution ke checkout.
- Fix resolver referral code agar lowercase code v1.6 bekerja case-insensitive.
- Existing v1.6: wajib jalankan `supabase/migrations/47-sales-page-manager-v1.7.sql`.
