iMersSUPA v1.7.25 - Notification End-to-End
SQL MIGRATION: REQUIRED for existing installation.
Run: supabase/migrations/iMersSUPA-MIGRATION-v1.7.25-NOTIFICATION-END-TO-END.sql
Frontend: notification worker + automatic dispatch hooks.
Providers reuse existing Fonnte / StarSender / Mailketing / SMTP configuration.
Order role remains independent: member, agency, admin, super_admin can buy products without role conversion.
