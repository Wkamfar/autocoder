-- NOTE (2026-01-14):
-- This migration used to be the "init" migration, but its timestamp caused it to run *after*
-- migrations that depend on base tables like "User"/"Organization".
--
-- The actual init schema has been moved to `20240101000000_init/`.
-- This migration is now intentionally a no-op.

SELECT 1;

