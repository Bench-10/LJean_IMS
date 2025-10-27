-- ============================================================
-- STEP 8: Create Inventory Product Selling Units Table
-- Supports multiple sell units with custom conversion ratios and pricing
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS inventory_product_sell_units (
    product_unit_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    sell_unit VARCHAR(30) NOT NULL,
    base_quantity_per_sell_unit NUMERIC(18, 6) NOT NULL,
    units_per_base NUMERIC(18, 6) GENERATED ALWAYS AS (CASE 
        WHEN base_quantity_per_sell_unit = 0 THEN NULL
        ELSE ROUND(1 / base_quantity_per_sell_unit, 6)
    END) STORED,
    unit_price NUMERIC(12, 2) NOT NULL,
    is_base BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_inventory_product_sell_unit UNIQUE (product_id, branch_id, sell_unit),
    CONSTRAINT fk_inventory_product_sell_units_product FOREIGN KEY (product_id, branch_id)
        REFERENCES Inventory_Product(product_id, branch_id) ON DELETE CASCADE
);

-- Ensure updated_at auto-updates on modification
CREATE OR REPLACE FUNCTION set_inventory_product_sell_units_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_product_sell_units_updated_at ON inventory_product_sell_units;
CREATE TRIGGER trg_inventory_product_sell_units_updated_at
    BEFORE UPDATE ON inventory_product_sell_units
    FOR EACH ROW
    EXECUTE PROCEDURE set_inventory_product_sell_units_updated_at();

COMMIT;

-- Verification
SELECT 'Inventory Product Selling Units Table Created' AS status,
       COUNT(*) AS total_rows
FROM inventory_product_sell_units;
