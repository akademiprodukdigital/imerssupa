# iMersSUPA FINAL CLEAN INSTALLER v1.6

Fresh installer for new clients. v1.6 adds the Member Affiliate Product Link Generator with on-demand product search.

**Fresh client:** run `supabase/install/00_FULL_FRESH_INSTALL_IMERSSUPA.sql`; do not run old incremental migrations.

# iMersSUPA — FINAL CLEAN CLIENT INSTALLER v1.1

Clean installer for a **new client / fresh Supabase project**.

## Included

- Latest iMersSUPA frontend
- Light premium checkout / order payment UI
- Admin Payments transaction management
- Admin Payment Methods management
- Payment method create / edit / active / inactive
- Search, filter, pagination where applicable
- Secure checkout `grand_total` fix
- pgcrypto schema-qualified checkout fix
- Payment method private gateway config preservation
- Full commerce notification lifecycle
- Transactional **WhatsApp + Email** queue wiring
- `order.created`
- `payment.waiting_verification`
- `payment.approved`
- `payment.rejected`
- `payment.failed`
- `order.completed`
- `order.cancelled`
- `order.expired`
- `order.refunded`
- No hardcoded bank account, QRIS, WhatsApp gateway token, or email provider credential
- No demo notification recipients / fake outbox history in the fresh install

## Fresh Installation

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Run:

   `supabase/install/00_FULL_FRESH_INSTALL_IMERSSUPA.sql`

4. Run:

   `supabase/install/01_BIND_FIRST_SUPER_ADMIN_BY_EMAIL.sql`

5. Run:

   `supabase/install/02_VERIFY_INSTALLATION.sql`

6. Copy `.env.example` to `.env.local` and fill:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

7. Install and build:

```bash
npm install
npm run build
npm run start
```

## After Login

Configure the client's own credentials from the Admin UI:

- WhatsApp provider / gateway
- Email provider
- Payment methods (bank transfer / e-wallet / QRIS / gateway)
- Branding and commerce settings

Payment credentials and provider secrets are intentionally **not hardcoded** into the installer.

## Notification Architecture

```text
Checkout / Order / Payment lifecycle
                ↓
         commerce event
                ↓
      notification dispatcher
             ↙     ↘
          EMAIL     WHATSAPP
                ↓
       notification_outbox
                ↓
       existing worker / Edge Function
                ↓
          provider gateway
```

For transactional commerce notifications, Email and WhatsApp are queued whenever the corresponding buyer contact exists. In-app notifications remain separately configurable.

## Important

A fresh installation starts with **no client payment account details** and no provider tokens. The client must configure their own payment methods and communication providers in Admin Settings.


### Release v1.2
This clean installer already includes the Admin Orders cancellation action. For a **new client**, run the bundled fresh-install SQL normally; do **not** run the standalone v1.2 UI hotfix afterward.

### Affiliate code format (v1.5)
Affiliate codes are generated automatically in lowercase using 3-6 alphanumeric characters from the member name plus a 4-character generated suffix, with no separator (example: `terry7k3p`).
