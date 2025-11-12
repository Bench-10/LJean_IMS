-- ============================================================
-- REMOVE INVENTORY PRODUCT SELLING UNITS FEATURE
-- Drops the auxiliary selling units table, trigger, and helper
-- function now that products use a single base unit for sales.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS inventory_product_sell_units CASCADE;

DROP FUNCTION IF EXISTS set_inventory_product_sell_units_updated_at() CASCADE;

COMMIT;
