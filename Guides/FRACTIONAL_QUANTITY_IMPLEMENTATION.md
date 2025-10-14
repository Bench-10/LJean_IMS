# Fractional Quantity System Implementation Guide

## Overview
This document outlines the implementation of a fractional quantity system that normalizes all product quantities into their smallest measurable units for precise inventory management.

## Database Schema Changes

### 1. Create Unit Conversion Table

```sql
-- Unit conversion table to store conversion factors
CREATE TABLE Unit_Conversion (
    unit_id SERIAL PRIMARY KEY,
    display_unit VARCHAR(15) NOT NULL UNIQUE,      -- User-facing unit (kg, ltr, m, etc.)
    base_unit VARCHAR(15) NOT NULL,                -- Base unit for storage (g, ml, cm, etc.)
    conversion_factor INT NOT NULL,                 -- Multiplier to convert to base unit
    unit_type VARCHAR(20) NOT NULL,                 -- Category: weight, volume, length, count, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert conversion data for your existing units
INSERT INTO Unit_Conversion (display_unit, base_unit, conversion_factor, unit_type) VALUES
    ('kg', 'g', 1000, 'weight'),
    ('ltr', 'ml', 1000, 'volume'),
    ('gal', 'ml', 3785, 'volume'),
    ('m', 'cm', 100, 'length'),
    ('meter', 'cm', 100, 'length'),
    ('cu.m', 'cu.cm', 1000000, 'volume'),
    ('bd.ft', 'bd.in', 12, 'length'),
    ('pcs', 'pcs', 1, 'count'),
    ('bag', 'bag', 1, 'count'),
    ('pairs', 'pairs', 1, 'count'),
    ('roll', 'roll', 1, 'count'),
    ('set', 'set', 1, 'count'),
    ('sheet', 'sheet', 1, 'count'),
    ('btl', 'btl', 1, 'count'),
    ('can', 'can', 1, 'count'),
    ('pail', 'pail', 1, 'count');

-- Index for performance
CREATE INDEX idx_unit_conversion_display ON Unit_Conversion(display_unit);
```

### 2. Modify Existing Tables

```sql
-- Add base unit tracking to Inventory_Product
ALTER TABLE Inventory_Product 
    ADD COLUMN base_unit VARCHAR(15),
    ADD COLUMN conversion_factor INT DEFAULT 1;

-- Update existing records with conversion factors
UPDATE Inventory_Product ip
SET 
    base_unit = uc.base_unit,
    conversion_factor = uc.conversion_factor
FROM Unit_Conversion uc
WHERE ip.unit = uc.display_unit;

-- Add constraint to ensure base_unit is set
ALTER TABLE Inventory_Product 
    ALTER COLUMN base_unit SET NOT NULL,
    ALTER COLUMN conversion_factor SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE Inventory_Product
    ADD CONSTRAINT fk_inventory_unit 
    FOREIGN KEY (unit) 
    REFERENCES Unit_Conversion(display_unit);
```

### 3. Modify Add_Stocks Table

```sql
-- Add base quantity column
ALTER TABLE Add_Stocks
    ADD COLUMN quantity_added_base INT,
    ADD COLUMN quantity_left_base INT;

-- Migrate existing data to base units
UPDATE Add_Stocks ast
SET 
    quantity_added_base = ast.quantity_added * ip.conversion_factor,
    quantity_left_base = ast.quantity_left * ip.conversion_factor
FROM Inventory_Product ip
WHERE ast.product_id = ip.product_id 
    AND ast.branch_id = ip.branch_id;

-- Make base quantity columns non-null
ALTER TABLE Add_Stocks 
    ALTER COLUMN quantity_added_base SET NOT NULL,
    ALTER COLUMN quantity_left_base SET NOT NULL;

-- Keep original columns for backward compatibility and display
-- Rename them for clarity
ALTER TABLE Add_Stocks 
    RENAME COLUMN quantity_added TO quantity_added_display;
ALTER TABLE Add_Stocks 
    RENAME COLUMN quantity_left TO quantity_left_display;
```

### 4. Modify Sales_Items Table

```sql
-- Add base quantity column
ALTER TABLE Sales_Items
    ADD COLUMN quantity_base INT;

-- Migrate existing sales data
UPDATE Sales_Items si
SET quantity_base = si.quantity * ip.conversion_factor
FROM Inventory_Product ip
WHERE si.product_id = ip.product_id 
    AND si.branch_id = ip.branch_id;

-- Make base quantity non-null
ALTER TABLE Sales_Items 
    ALTER COLUMN quantity_base SET NOT NULL;

-- Keep original for display
ALTER TABLE Sales_Items 
    RENAME COLUMN quantity TO quantity_display;
```

### 5. Modify Sales_Stock_Usage Table

```sql
-- Add base quantity column
ALTER TABLE Sales_Stock_Usage
    ADD COLUMN quantity_used_base INT;

-- Migrate existing data
UPDATE Sales_Stock_Usage ssu
SET quantity_used_base = ssu.quantity_used * ip.conversion_factor
FROM Inventory_Product ip
WHERE ssu.product_id = ip.product_id 
    AND ssu.branch_id = ip.branch_id;

-- Make base quantity non-null
ALTER TABLE Sales_Stock_Usage 
    ALTER COLUMN quantity_used_base SET NOT NULL;

-- Keep original for display
ALTER TABLE Sales_Stock_Usage 
    RENAME COLUMN quantity_used TO quantity_used_display;
```

### 6. Create Views for Easy Querying

```sql
-- View to show inventory with both base and display quantities
CREATE OR REPLACE VIEW Inventory_View AS
SELECT 
    ip.product_id,
    ip.branch_id,
    ip.product_name,
    ip.category_id,
    ip.unit AS display_unit,
    ip.base_unit,
    ip.conversion_factor,
    ip.unit_price,
    ip.unit_cost,
    ip.min_threshold,
    ip.max_threshold,
    -- Sum base quantities
    COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_base END), 0) AS quantity_base,
    -- Convert back to display units
    COALESCE(SUM(CASE WHEN ast.product_validity < NOW() THEN 0 ELSE ast.quantity_left_base END), 0)::NUMERIC / ip.conversion_factor AS quantity_display
FROM Inventory_Product ip
LEFT JOIN Add_Stocks ast USING(product_id, branch_id)
GROUP BY 
    ip.product_id, 
    ip.branch_id, 
    ip.product_name,
    ip.category_id,
    ip.unit,
    ip.base_unit,
    ip.conversion_factor,
    ip.unit_price,
    ip.unit_cost,
    ip.min_threshold,
    ip.max_threshold;
```

## Backend Implementation

### 1. Unit Conversion Utility (`backend/Services/Services_Utils/unitConversion.js`)

```javascript
import { SQLquery } from "../../db.js";

// Cache for unit conversion data
let unitConversionCache = null;

/**
 * Load unit conversion data into cache
 */
export const loadUnitConversionCache = async () => {
    const { rows } = await SQLquery('SELECT * FROM Unit_Conversion');
    unitConversionCache = new Map();
    
    rows.forEach(row => {
        unitConversionCache.set(row.display_unit, {
            unit_id: row.unit_id,
            base_unit: row.base_unit,
            conversion_factor: row.conversion_factor,
            unit_type: row.unit_type
        });
    });
    
    console.log('Unit conversion cache loaded:', unitConversionCache.size, 'units');
    return unitConversionCache;
};

/**
 * Get conversion data for a unit
 */
export const getUnitConversion = (displayUnit) => {
    if (!unitConversionCache) {
        throw new Error('Unit conversion cache not initialized. Call loadUnitConversionCache() first.');
    }
    
    const conversion = unitConversionCache.get(displayUnit);
    if (!conversion) {
        throw new Error(`Unit '${displayUnit}' not found in conversion table`);
    }
    
    return conversion;
};

/**
 * Convert display quantity to base quantity
 * @param {number} displayQuantity - Quantity in display unit (can be decimal)
 * @param {string} displayUnit - Display unit (kg, ltr, etc.)
 * @returns {number} Base quantity as integer
 */
export const convertToBaseUnit = (displayQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    
    // Multiply by conversion factor and round to nearest integer
    const baseQuantity = Math.round(displayQuantity * conversion.conversion_factor);
    
    return baseQuantity;
};

/**
 * Convert base quantity to display quantity
 * @param {number} baseQuantity - Quantity in base unit (integer)
 * @param {string} displayUnit - Display unit to convert to
 * @returns {number} Display quantity as decimal
 */
export const convertToDisplayUnit = (baseQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    
    // Divide by conversion factor
    const displayQuantity = baseQuantity / conversion.conversion_factor;
    
    return displayQuantity;
};

/**
 * Validate if quantity can be precisely converted
 * @param {number} displayQuantity - Quantity to validate
 * @param {string} displayUnit - Unit to validate with
 * @returns {boolean} True if conversion is precise
 */
export const isValidQuantity = (displayQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    const baseQuantity = displayQuantity * conversion.conversion_factor;
    
    // Check if result is effectively an integer (within floating point precision)
    return Math.abs(baseQuantity - Math.round(baseQuantity)) < 0.0001;
};

/**
 * Get minimum sellable quantity for a unit
 * @param {string} displayUnit - Display unit
 * @returns {number} Minimum quantity (e.g., 0.001 for kg = 1g)
 */
export const getMinimumQuantity = (displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    return 1 / conversion.conversion_factor;
};

/**
 * Format quantity for display with appropriate precision
 * @param {number} quantity - Quantity to format
 * @param {string} unit - Unit
 * @returns {string} Formatted quantity
 */
export const formatQuantity = (quantity, unit) => {
    const conversion = getUnitConversion(unit);
    
    // For units with conversion factor of 1 (count units), show as integer
    if (conversion.conversion_factor === 1) {
        return Math.round(quantity).toString();
    }
    
    // For other units, determine precision based on conversion factor
    let precision = 0;
    let factor = conversion.conversion_factor;
    while (factor > 1) {
        precision++;
        factor = factor / 10;
    }
    
    // Show up to the precision needed, removing trailing zeros
    return parseFloat(quantity.toFixed(precision)).toString();
};
```

### 2. Initialize Cache in Server

```javascript
// In backend/server.js - add at startup
import { loadUnitConversionCache } from './Services/Services_Utils/unitConversion.js';

// After database connection
await loadUnitConversionCache();
console.log('Unit conversion system initialized');
```

## API Response Format

All API responses should include both base and display quantities:

```javascript
{
    product_id: 123,
    product_name: "Cement",
    quantity_display: 1.5,  // User-friendly display
    quantity_base: 1500,    // Internal storage (in grams)
    unit: "kg",             // Display unit
    base_unit: "g",         // Base unit
    conversion_factor: 1000
}
```

## Usage Examples

### Adding Stock with Fractional Quantity
```javascript
// User adds 2.5 kg of cement
const displayQuantity = 2.5;
const unit = "kg";

// Convert to base unit for storage
const baseQuantity = convertToBaseUnit(displayQuantity, unit); // 2500 grams

// Store in database
await SQLquery(`
    INSERT INTO Add_Stocks (product_id, quantity_added_display, quantity_added_base, ...)
    VALUES ($1, $2, $3, ...)
`, [productId, displayQuantity, baseQuantity, ...]);
```

### Selling Fractional Quantity
```javascript
// User sells 0.5 kg of cement
const displayQuantity = 0.5;
const unit = "kg";

// Convert to base unit for deduction
const baseQuantity = convertToBaseUnit(displayQuantity, unit); // 500 grams

// Deduct from stock using base quantity
await deductStockFIFO(productId, baseQuantity, branchId);
```

### Displaying Inventory
```javascript
// Query returns base quantity: 3750 grams
const baseQuantity = 3750;
const unit = "kg";

// Convert to display unit
const displayQuantity = convertToDisplayUnit(baseQuantity, unit); // 3.75 kg
```

## Migration Strategy

1. **Phase 1: Add new columns** (backward compatible)
   - Add base quantity columns
   - Keep original columns
   - Populate base quantities from existing data

2. **Phase 2: Update application code**
   - Modify inventory services to use base quantities
   - Update sales services to use base quantities
   - Update frontend to allow decimal inputs

3. **Phase 3: Testing**
   - Test fractional quantity inputs
   - Test stock deduction with FIFO
   - Test reporting and analytics

4. **Phase 4: Cleanup** (optional)
   - Can keep display columns for audit trail
   - Or migrate to views only

## Benefits

1. **Precision**: No floating-point arithmetic issues
2. **Performance**: Integer operations are faster
3. **Database**: Can use INT instead of DECIMAL
4. **Flexibility**: Easy to add new units
5. **Accuracy**: Exact quantity tracking

## Frontend Changes

See separate document: `FRONTEND_FRACTIONAL_QUANTITY.md`
