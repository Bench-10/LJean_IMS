-- ============================================================
-- FIX: Change quantity_display columns to DECIMAL
-- Run this to allow fractional quantities in display columns
-- ============================================================

BEGIN;

-- Fix Add_Stocks table
ALTER TABLE Add_Stocks
    ALTER COLUMN quantity_added_display TYPE DECIMAL(10,3),
    ALTER COLUMN quantity_left_display TYPE DECIMAL(10,3);

-- Fix Sales_Items table
ALTER TABLE Sales_Items
    ALTER COLUMN quantity_display TYPE DECIMAL(10,3);

-- Fix Sales_Stock_Usage table
ALTER TABLE Sales_Stock_Usage
    ALTER COLUMN quantity_used_display TYPE DECIMAL(10,3);

COMMIT;

-- Verification
SELECT 'Add_Stocks quantity_added_display' AS column_name, 
       data_type, 
       numeric_precision, 
       numeric_scale
FROM information_schema.columns
WHERE table_name = 'add_stocks' 
  AND column_name = 'quantity_added_display';

SELECT 'Sales_Items quantity_display' AS column_name, 
       data_type, 
       numeric_precision, 
       numeric_scale
FROM information_schema.columns
WHERE table_name = 'sales_items' 
  AND column_name = 'quantity_display';

SELECT 'Sales_Stock_Usage quantity_used_display' AS column_name, 
       data_type, 
       numeric_precision, 
       numeric_scale
FROM information_schema.columns
WHERE table_name = 'sales_stock_usage' 
  AND column_name = 'quantity_used_display';

SELECT 'Column types updated successfully' AS status;
