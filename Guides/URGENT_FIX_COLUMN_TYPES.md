# URGENT: Missing Column Type Fix

## Problem

The migration scripts renamed columns but **didn't change the data types** from INTEGER to DECIMAL for the `_display` columns:

- `Add_Stocks.quantity_added_display` - Still INTEGER, should be DECIMAL(10,3)
- `Add_Stocks.quantity_left_display` - Still INTEGER, should be DECIMAL(10,3)
- `Sales_Items.quantity_display` - Still INTEGER, should be DECIMAL(10,3)
- `Sales_Stock_Usage.quantity_used_display` - Still INTEGER, should be DECIMAL(10,3)

## Current Errors

```
Error: invalid input syntax for type integer: "40.5"
Error: invalid input syntax for type integer: "1.5"
```

These happen because we're trying to insert decimal values (1.5, 40.5) into INTEGER columns.

## Solution

**Run this SQL immediately:**

```sql
-- Fix: Change quantity_display columns to DECIMAL
BEGIN;

ALTER TABLE Add_Stocks
    ALTER COLUMN quantity_added_display TYPE DECIMAL(10,3),
    ALTER COLUMN quantity_left_display TYPE DECIMAL(10,3);

ALTER TABLE Sales_Items
    ALTER COLUMN quantity_display TYPE DECIMAL(10,3);

ALTER TABLE Sales_Stock_Usage
    ALTER COLUMN quantity_used_display TYPE DECIMAL(10,3);

COMMIT;
```

Or run the provided file:
```bash
psql -U postgres -d ljean_database -f backend/migrations/fix_quantity_display_types.sql
```

## Why This Happened

The original migration scripts:
1. ✅ Added `_base` columns (BIGINT) ✓
2. ✅ Added `_display` columns (but didn't set type)
3. ✅ Renamed original columns to `_display`
4. ❌ **FORGOT** to change the renamed column types from INTEGER to DECIMAL

## After Running the Fix

✅ Can insert fractional quantities: 1.5, 2.75, 40.5, etc.  
✅ Display columns store decimals properly  
✅ Base columns store integers for calculations  
✅ No more type conversion errors  

## Files

- `backend/migrations/fix_quantity_display_types.sql` - Run this SQL file to fix the issue
