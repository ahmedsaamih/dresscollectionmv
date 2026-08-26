-- Order refs are now a random 5-character code (lib/ref.ts) instead of a
-- sequential DC-YY-NNNNN counter, so the counter table is no longer needed.
DROP TABLE "RefSequence";
