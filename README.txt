iMersSUPA v1.7.16 — PROFESSIONAL IN-APP CONFIRMATION

SQL MIGRATION: NOT REQUIRED
FRONTEND UPDATE: REQUIRED

FIX:
- Native browser window.confirm removed from Orders > Detail > AKTIFKAN ORDER.
- Confirmation now uses a centered iMersSUPA modal inside the application.
- No browser/URL-origin popup for this action.
- Keeps v1.7.15 Orders layout/sidebar fix.
- Keeps direct Orders > Detail > AKTIFKAN ORDER flow.
- No payment queue required to activate from Order Detail.

RULE GOING FORWARD:
Do not use window.confirm/window.alert for application UX. Use centered in-app modal/toast.

VALIDATION:
- window.confirm in patched Orders page: NONE
- window.alert in patched Orders page: NONE
- TypeScript/JSX syntax diagnostics: PASS
- ZIP integrity: PASS
