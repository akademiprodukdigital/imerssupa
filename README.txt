iMersSUPA v1.7.20
SQL MIGRATION: NOT REQUIRED
FRONTEND/SERVER UPDATE: REQUIRED

Build/type fix:
- app/api/_ensure-member.ts no longer derives an invalid `never` schema type from ReturnType<typeof createClient>.
- Server-only Supabase admin helper is explicitly untyped (`admin: any`) because this project does not supply generated Database types to createClient.
- Fix covers BOTH profile read and profile upsert paths, including the exact v1.7.19 error:
  Object literal may only specify known properties, and 'id' does not exist in type 'never[]'.

Business flow unchanged:
checkout -> member exists/created -> order recorded -> access granted only after payment/admin activation.
