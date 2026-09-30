# iMersSUPA v1.7.25

- End-to-end outbound notification worker using existing provider configuration.
- Reuses Fonnte, StarSender, Mailketing and SMTP implementations already used by Communication Test.
- Automatic dispatch after checkout creation, payment proof submission, payment review and admin order activation.
- New transactional events: member.registered, product.access_granted/revoked, affiliate.order_attributed, affiliate.commission_created/approved/paid.
- Existing commerce lifecycle remains: order.created, payment waiting/approved/rejected/failed, order completed/cancelled/expired/refunded.
- Order activation drawer closes after an activation attempt; result remains visible through page notification/status refresh.
- Role-independent purchase/access behavior from v1.7.24 retained.
