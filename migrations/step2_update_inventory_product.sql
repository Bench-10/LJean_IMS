-- ============================================================
-- STEP 2: Add columns to Inventory_Product
-- Run this after Step 1 is successful
-- ============================================================

BEGIN;

-- Add base unit tracking columns
ALTER TABLE Inventory_Product 
    ADD COLUMN IF NOT EXISTS base_unit VARCHAR(15),
    ADD COLUMN IF NOT EXISTS conversion_factor INT DEFAULT 1;

-- Update existing records with conversion factors
UPDATE Inventory_Product ip
SET 
    base_unit = uc.base_unit,
    conversion_factor = uc.conversion_factor
FROM Unit_Conversion uc
WHERE ip.unit = uc.display_unit;

-- Make columns non-null
ALTER TABLE Inventory_Product 
    ALTER COLUMN base_unit SET NOT NULL,
    ALTER COLUMN conversion_factor SET NOT NULL;

COMMIT;

-- Verification
SELECT 'Inventory_Product Updated' AS status, 
       COUNT(*) AS total_products,
       COUNT(CASE WHEN base_unit IS NOT NULL THEN 1 END) AS with_base_unit
FROM Inventory_Product;
