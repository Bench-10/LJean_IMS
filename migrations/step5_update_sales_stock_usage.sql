-- ============================================================
-- STEP 5: Modify Sales_Stock_Usage Table
-- Run this after Step 4 is successful
-- ============================================================

BEGIN;

-- Add base quantity column
ALTER TABLE Sales_Stock_Usage
    ADD COLUMN IF NOT EXISTS quantity_used_base BIGINT;

-- Migrate existing data
UPDATE Sales_Stock_Usage ssu
SET quantity_used_base = ssu.quantity_used * ip.conversion_factor
FROM Inventory_Product ip
WHERE ssu.product_id = ip.product_id 
    AND ssu.branch_id = ip.branch_id
    AND ssu.quantity_used_base IS NULL;

-- Make base quantity non-null
ALTER TABLE Sales_Stock_Usage 
    ALTER COLUMN quantity_used_base SET NOT NULL;

-- Rename original for display
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='sales_stock_usage' AND column_name='quantity_used') THEN
        ALTER TABLE Sales_Stock_Usage RENAME COLUMN quantity_used TO quantity_used_display;
    END IF;
END $$;

COMMIT;

-- Verification
SELECT 'Sales_Stock_Usage Updated' AS status, 
       COUNT(*) AS total_usage,
       COUNT(CASE WHEN quantity_used_base IS NOT NULL THEN 1 END) AS with_base_quantity
FROM Sales_Stock_Usage;
