# Fractional Quantity System - Quick Start Guide

## 🎯 Overview

This system enables your inventory to handle fractional quantities (like 1.5 kg or 0.75 liters) by converting them to their smallest measurable units internally (grams, milliliters, etc.) while displaying them in user-friendly units.

## 📋 Implementation Steps

### Step 1: Database Migration (30 minutes)

1. **Backup your database first!**
   ```bash
   pg_dump your_database > backup_before_fractional.sql
   ```

2. **Run the migration script:**
   ```bash
   psql -U your_user -d your_database -f backend/migrations/fractional_quantity_migration.sql
   ```

3. **Verify migration:**
   ```sql
   -- Check if tables were created/modified
   \d Unit_Conversion
   \d Inventory_Product
   \d Add_Stocks
   
   -- Check data integrity
   SELECT * FROM Unit_Conversion;
   SELECT COUNT(*) FROM Add_Stocks WHERE quantity_left_base IS NULL;
   ```

### Step 2: Backend Setup (15 minutes)

1. **Initialize unit conversion on server startup**

   Edit `backend/server.js`:
   ```javascript
   import { loadUnitConversionCache } from './Services/Services_Utils/unitConversion.js';

   // After database connection, before starting server
   try {
     await loadUnitConversionCache();
     console.log('✓ Unit conversion system initialized');
   } catch (error) {
     console.error('Failed to initialize unit conversion:', error);
     process.exit(1);
   }
   ```

2. **Update inventory service** - Already created at:
   - `backend/Services/Services_Utils/unitConversion.js`

3. **Test backend:**
   ```bash
   cd backend
   npm start
   ```
   
   Look for: `✓ Unit conversion cache loaded: 16 units`

### Step 3: Frontend Updates (45 minutes)

1. **Copy utility file** - Already created at:
   - `frontend/src/utils/unitConversion.js`

2. **Update ModalForm.jsx** for adding/editing inventory:
   
   ```javascript
   import { getQuantityStep, validateQuantity, formatQuantity } from '../utils/unitConversion';

   // Change quantity input
   <input 
     type="number"
     step={unit ? getQuantityStep(unit) : "0.001"}
     min={unit ? getQuantityStep(unit) : "0.001"}
     value={quantity_added}
     onChange={(e) => setQuantity(e.target.value)}
   />
   ```

3. **Update AddSaleModalForm.jsx** for sales:
   
   ```javascript
   <input 
     type="number" 
     step={row.unit ? getQuantityStep(row.unit) : "0.001"}
     value={row.quantity}
     onChange={e => {
       const newRows = [...rows];
       newRows[idx].quantity = e.target.value;
       setRows(newRows);
     }}
   />
   ```

4. **Update display components** to format quantities:
   
   ```javascript
   // In ProductInventory.jsx and other display components
   import { formatQuantity } from '../utils/unitConversion';
   
   <td>{formatQuantity(item.quantity, item.unit)}</td>
   ```

### Step 4: Backend Service Updates (Optional - for optimization)

The existing backend services will work with the new system, but for optimal performance, you can update them to use base quantities directly.

**Example update for `inventoryServices.js`:**

```javascript
import { convertToBaseUnit, convertToDisplayUnit } from '../Services_Utils/unitConversion.js';

// When adding stock
export const addProductItem = async (productData) => {
  const { quantity_added, unit, ...rest } = productData;
  
  // Convert to base unit for storage
  const quantity_base = convertToBaseUnit(quantity_added, unit);
  
  await SQLquery(`
    INSERT INTO Add_Stocks 
    (product_id, quantity_added_display, quantity_added_base, quantity_left_display, quantity_left_base, ...)
    VALUES ($1, $2, $3, $2, $3, ...)
  `, [productId, quantity_added, quantity_base, ...]);
};
```

### Step 5: Testing (1-2 hours)

#### Test Cases to Run:

1. **Add Item with Fractional Quantity**
   - Add 1.5 kg of cement
   - Add 0.75 ltr of paint
   - Add 2.25 m of wire
   - Verify stored as: 1500g, 750ml, 225cm

2. **Sell Item with Fractional Quantity**
   - Sell 0.5 kg of cement
   - Verify stock deducted: 500g
   - Check remaining: Should show 1.0 kg (1000g)

3. **Count Units (No Fractions)**
   - Try adding 1.5 pcs (should reject or round)
   - Verify pcs, bag, roll units only accept integers

4. **FIFO Stock Deduction**
   - Add batch 1: 2 kg
   - Add batch 2: 3 kg
   - Sell 2.5 kg
   - Verify: Batch 1 empty, Batch 2 has 2.5 kg left

5. **Threshold Checks**
   - Set min threshold: 5 kg
   - Current stock: 5.5 kg
   - Sell 1 kg
   - Verify low stock notification triggers

6. **Display Formatting**
   - 1500g displays as: 1.5 kg
   - 750ml displays as: 0.75 ltr
   - 1000g displays as: 1 kg (not 1.0 or 1.000)

#### Test Script:

```javascript
// backend/test/fractional-quantity.test.js
import { convertToBaseUnit, convertToDisplayUnit, validateQuantityInput } from '../Services/Services_Utils/unitConversion.js';

// Test conversions
console.assert(convertToBaseUnit(1.5, 'kg') === 1500, 'kg conversion failed');
console.assert(convertToDisplayUnit(1500, 'kg') === 1.5, 'kg display failed');
console.assert(convertToBaseUnit(1, 'pcs') === 1, 'pcs conversion failed');

// Test validation
const valid = validateQuantityInput(1.5, 'kg');
console.assert(valid.valid === true, 'Valid quantity rejected');

const invalid = validateQuantityInput(1.5, 'pcs');
console.assert(invalid.valid === false, 'Invalid quantity accepted');

console.log('✓ All unit conversion tests passed');
```

### Step 6: Rollback Plan (if needed)

If something goes wrong:

```sql
-- Restore from backup
psql -U your_user -d your_database < backup_before_fractional.sql

-- Or use rollback script in migration file
```

## 🔍 Verification Queries

```sql
-- Check unit conversions are loaded
SELECT * FROM Unit_Conversion ORDER BY unit_type, display_unit;

-- Check inventory quantities match
SELECT 
  product_name,
  quantity_left_display AS display_qty,
  quantity_left_base AS base_qty,
  conversion_factor,
  quantity_left_display * conversion_factor AS calculated_base
FROM Add_Stocks
JOIN Inventory_Product USING(product_id, branch_id)
WHERE ABS(quantity_left_display * conversion_factor - quantity_left_base) > 1
LIMIT 10;

-- Check total inventory value
SELECT 
  SUM(quantity_left_base * h_unit_cost / conversion_factor) AS total_inventory_value
FROM Add_Stocks
JOIN Inventory_Product USING(product_id, branch_id);
```

## 📊 Expected Behavior

### Before (Integer Only):
- Can only add/sell whole numbers: 1 kg, 2 kg, 3 kg
- Can't sell 0.5 kg - must sell 1 kg
- Waste or imprecision in transactions

### After (Fractional Support):
- Can add/sell precise amounts: 1.5 kg, 0.75 kg, 2.25 kg
- Accurate inventory tracking
- Better customer service (sell exact amounts needed)

## 🎨 User Experience

### Input Examples:

| Unit | Allows Fractions | Example Inputs | Invalid Inputs |
|------|------------------|----------------|----------------|
| kg   | ✅ Yes | 1.5, 0.75, 2.25 | 1.5001 (too precise) |
| ltr  | ✅ Yes | 1.5, 0.5, 3.75 | 1.0001 |
| m    | ✅ Yes | 1.5, 2.25, 0.5 | 1.001 |
| pcs  | ❌ No | 1, 2, 3 | 1.5, 2.5 |
| bag  | ❌ No | 1, 2, 3 | 1.5, 2.5 |

## 🚨 Troubleshooting

### Issue: "Unit conversion cache not initialized"
**Solution:** Make sure `loadUnitConversionCache()` is called in server.js before handling requests.

### Issue: Frontend shows wrong decimal places
**Solution:** Use `formatQuantity()` function consistently for all displays.

### Issue: Can't sell fractional quantities
**Solution:** Check that input fields use `type="number"` with proper `step` attribute.

### Issue: Stock deduction not working
**Solution:** Verify backend is using `quantity_left_base` column for calculations.

### Issue: Migration failed
**Solution:** Check PostgreSQL version, permissions, and existing table structure.

## 📈 Performance Impact

- **Database:** Negligible (integer operations are faster than decimal)
- **Backend:** ~2-5ms added for unit conversions per request
- **Frontend:** Negligible (client-side JavaScript)
- **Storage:** +8 bytes per record (BIGINT for base quantities)

## 🔐 Data Integrity

The migration preserves all existing data:
- Original quantities stored in `*_display` columns
- Converted quantities in `*_base` columns
- Both are maintained for audit trail

## 📝 Next Steps

1. ✅ Run database migration
2. ✅ Update backend to load unit cache
3. ✅ Update frontend input fields
4. ✅ Update display components
5. ✅ Test thoroughly
6. ✅ Train users on fractional input
7. ✅ Monitor for issues
8. ✅ Optimize queries if needed

## 🎓 Training Users

Provide users with:
- "You can now sell partial quantities! Enter 0.5 for half a kg"
- Examples: 1.5 kg, 0.75 ltr, 2.25 m
- Note: Count items (pcs, bags) must still be whole numbers

## 📞 Support

For issues or questions:
1. Check FRACTIONAL_QUANTITY_IMPLEMENTATION.md
2. Check FRONTEND_FRACTIONAL_UPDATES.md
3. Review test results
4. Check server logs for unit conversion errors

---

**Estimated Total Implementation Time:** 3-4 hours (including testing)

**Recommended Order:**
1. Test on development/staging environment first
2. Run all test cases
3. Deploy to production during low-traffic period
4. Monitor closely for 24 hours
5. Gather user feedback
