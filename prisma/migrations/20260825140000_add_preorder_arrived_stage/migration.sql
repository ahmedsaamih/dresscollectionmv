-- Shift every stage id >= 2 up by one, freeing id 2 for the new pre-order-only
-- "Arrived at Facility" status inserted between Payment Confirmed (1) and
-- Ready for Pickup/Delivery (now 3/4). See lib/utils.ts's ORDER_STAGES.
UPDATE "Order" SET "stage" = "stage" + 1 WHERE "stage" >= 2;
