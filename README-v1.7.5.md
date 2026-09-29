# iMersSUPA v1.7.5

## Checkout + Internal Sales Page Sandbox Fix
- Checkout visitor key now safely falls back when localStorage is blocked.
- Checkout idempotency UUID uses a safe fallback.
- Checkout token storage is guarded when sessionStorage is unavailable.
- Internal Sales Page checkout links navigate the top-level application instead of remaining inside the sandbox iframe.
- Sandbox remains isolated; `allow-same-origin` is intentionally NOT enabled.
- Admin Sales Page preview follows the same top-level navigation behavior.

SQL migration: NOT REQUIRED.
