-- "Card" is no longer a supported payment method — this business only
-- accepts cash and bank transfer. Drops the historical paidCard breakdown
-- outright (confirmed with the user, no reconciliation into paidTransfer).
ALTER TABLE "Order" DROP COLUMN "paidCard";

-- Dead code from the cloned project: nothing anywhere ever set
-- origin='quote_conversion' or populated quoteRef — no Quote model exists.
ALTER TABLE "Order" DROP COLUMN "quoteRef";
