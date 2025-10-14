-- ============================================================
-- STEP 4: Modify Sales_Items Table
-- Run this after Step 3 is successful
-- ============================================================

BEGIN;

-- Add base quantity and conversion factor columns
ALTER TABLE Sales_Items
    ADD COLUMN IF NOT EXISTS quantity_base BIGINT,
    ADD COLUMN IF NOT EXISTS conversion_factor INT;

-- Migrate existing sales data
UPDATE Sales_Items si
SET 
    quantity_base = si.quantity * ip.conversion_factor,
    conversion_factor = ip.conversion_factor
FROM Inventory_Product ip
WHERE si.product_id = ip.product_id 
    AND si.branch_id = ip.branch_id
    AND si.quantity_base IS NULL;

-- Make base quantity non-null
ALTER TABLE Sales_Items 
    ALTER COLUMN quantity_base SET NOT NULL,
    ALTER COLUMN conversion_factor SET NOT NULL;

-- Rename original for display
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='sales_items' AND column_name='quantity') THEN
        ALTER TABLE Sales_Items RENAME COLUMN quantity TO quantity_display;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'Sales_Items Updated' AS status, 
       COUNT(*) AS total_items,
       COUNT(CASE WHEN quantity_base IS NOT NULL THEN 1 END) AS with_base_quantity
FROM Sales_Items;
