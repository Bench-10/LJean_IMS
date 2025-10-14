-- ============================================================
-- STEP 1: Create Unit Conversion Table
-- Run this first to set up the unit conversion system
-- ============================================================

BEGIN;

-- Create the Unit_Conversion table
CREATE TABLE IF NOT EXISTS Unit_Conversion (
    unit_id SERIAL PRIMARY KEY,
    display_unit VARCHAR(15) NOT NULL UNIQUE,
    base_unit VARCHAR(15) NOT NULL,
    conversion_factor INT NOT NULL,
    unit_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert conversion data for existing units
INSERT INTO Unit_Conversion (display_unit, base_unit, conversion_factor, unit_type) VALUES
    ('kg', 'g', 1000, 'weight'),
    ('ltr', 'ml', 1000, 'volume'),
    ('gal', 'ml', 3785, 'volume'),
    ('cu.m', 'cu.cm', 1000000, 'volume'),
    ('btl', 'btl', 1, 'count'),
    ('can', 'can', 1, 'count'),
    ('pail', 'pail', 1, 'count'),
    ('m', 'cm', 100, 'length'),
    ('meter', 'cm', 100, 'length'),
    ('bd.ft', 'bd.in', 12, 'length'),
    ('pcs', 'pcs', 1, 'count'),
    ('bag', 'bag', 1, 'count'),
    ('pairs', 'pairs', 1, 'count'),
    ('roll', 'roll', 1, 'count'),
    ('set', 'set', 1, 'count'),
    ('sheet', 'sheet', 1, 'count')
ON CONFLICT (display_unit) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_unit_conversion_display ON Unit_Conversion(display_unit);

COMMIT;

-- Verification
SELECT 'Unit Conversion Table Created' AS status, COUNT(*) AS unit_count FROM Unit_Conversion;
