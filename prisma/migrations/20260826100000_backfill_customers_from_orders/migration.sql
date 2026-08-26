-- Customer rows are normally upserted reactively at order-creation time
-- (lib/customers.ts), keyed by phone. That never ran for orders that existed
-- in the database before this reactive upsert was wired up (or were inserted
-- directly, bypassing it), so the admin Customers list was missing anyone
-- whose order predates the app actually creating their Customer row. This
-- backfills Customer from every existing Order that has a phone number,
-- taking the most recent order per phone for name/email — a one-time catch-up,
-- not a replacement for the ongoing reactive upsert.
INSERT INTO "Customer" (id, name, phone, email, "createdAt", "updatedAt")
SELECT DISTINCT ON (o.mobile)
  'cust_' || substr(md5(random()::text || o.mobile), 1, 20),
  o.customer, o.mobile, NULLIF(o.email, ''), o."createdAt", now()
FROM "Order" o
WHERE o.mobile IS NOT NULL AND btrim(o.mobile) <> ''
  AND NOT EXISTS (SELECT 1 FROM "Customer" c WHERE c.phone = o.mobile)
ORDER BY o.mobile, o."createdAt" DESC
ON CONFLICT (phone) DO NOTHING;
