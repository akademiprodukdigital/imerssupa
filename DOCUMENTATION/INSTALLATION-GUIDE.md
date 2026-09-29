# iMersSUPA — Final Clean Installation Guide v1.1

## A. Supabase

1. Create a **new Supabase project**.
2. Open **SQL Editor**.
3. Run `supabase/install/00_FULL_FRESH_INSTALL_IMERSSUPA.sql` once.
4. Replace the placeholder email in `supabase/install/01_BIND_FIRST_SUPER_ADMIN_BY_EMAIL.sql` with the client's Supabase Auth email, then run it.
5. Run `supabase/install/02_VERIFY_INSTALLATION.sql`.

The full installer SQL already includes the latest checkout/payment fixes and notification lifecycle wiring. Do not run the older standalone hotfix files on a fresh installation.

## B. Frontend

1. Copy `.env.example` to `.env.local`.
2. Fill `NEXT_PUBLIC_SUPABASE_URL`.
3. Fill `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Run:

```bash
npm install
npm run build
npm run start
```

The same project can be deployed to Vercel or another Next.js-compatible host.

## C. First Admin Configuration

After login, configure:

- Branding
- WhatsApp provider/gateway
- Email provider
- Payment methods
- Commerce settings

No bank account, QRIS image, gateway token, email credential, or provider secret is hardcoded into the installer.

## D. Payment Methods

Open **Admin → Payments → Payment Methods** and create the payment methods the client actually supports.

A fresh installation intentionally has no real client payment account details.

## E. Notification Flow

Transactional commerce events are connected as follows:

```text
Order Created
Payment Waiting Verification
Payment Approved
Payment Rejected
Payment Failed
Order Completed
Order Cancelled
Order Expired
Order Refunded
        ↓
Notification Dispatcher
        ↓
Email + WhatsApp Outbox
        ↓
Existing Provider Worker / Edge Function
```

The SQL does not contain provider credentials. The communication provider must be configured by the client.

## F. Verification

The final verification SQL checks:

- Required tables
- Storage buckets
- Payment methods
- 27 active transactional notification templates
- Commerce notification triggers
- Checkout/payment functions
- Recent notification outbox records

## G. Existing Installation Warning

This package is the **fresh client installer**. For an existing production installation, do not re-run the complete fresh-install SQL over the production database. Use the corresponding upgrade/hotfix process instead.
