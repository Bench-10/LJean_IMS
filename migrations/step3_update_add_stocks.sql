-- ============================================================
-- STEP 3: Modify Add_Stocks Table
-- Run this after Step 2 is successful
-- ============================================================

BEGIN;

-- Add base quantity columns
ALTER TABLE Add_Stocks
    ADD COLUMN IF NOT EXISTS quantity_added_base BIGINT,
    ADD COLUMN IF NOT EXISTS quantity_left_base BIGINT;

-- Migrate existing data to base units
UPDATE Add_Stocks ast
SET 
    quantity_added_base = ast.quantity_added * ip.conversion_factor,
    quantity_left_base = ast.quantity_left * ip.conversion_factor
FROM Inventory_Product ip
WHERE ast.product_id = ip.product_id 
    AND ast.branch_id = ip.branch_id
    AND ast.quantity_added_base IS NULL;

-- Make base quantity columns non-null
ALTER TABLE Add_Stocks 
    ALTER COLUMN quantity_added_base SET NOT NULL,
    ALTER COLUMN quantity_left_base SET NOT NULL;

-- Rename original columns for clarity
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='add_stocks' AND column_name='quantity_added') THEN
        ALTER TABLE Add_Stocks RENAME COLUMN quantity_added TO quantity_added_display;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='add_stocks' AND column_name='quantity_left') THEN
        ALTER TABLE Add_Stocks RENAME COLUMN quantity_left TO quantity_left_display;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_add_stocks_quantity_base 
    ON Add_Stocks(quantity_left_base) 
    WHERE quantity_left_base > 0;

COMMIT;

-- Verification
SELECT 'Add_Stocks Updated' AS status, 
       COUNT(*) AS total_stocks,
       COUNT(CASE WHEN quantity_added_base IS NOT NULL THEN 1 END) AS with_base_quantity
FROM Add_Stocks;
