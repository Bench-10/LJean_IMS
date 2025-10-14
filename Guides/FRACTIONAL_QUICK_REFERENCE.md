# Fractional Quantities - Quick Reference

## User Guide

### Supported Units

**Fractional Units** (can use decimals):
- `kg` - Kilograms (e.g., 1.5 kg, 2.75 kg)
- `ltr` - Liters (e.g., 0.5 ltr, 3.25 ltr)
- `gal` - Gallons (e.g., 2.5 gal)
- `m` / `meter` - Meters (e.g., 1.5 m)
- `cu.m` - Cubic meters (e.g., 0.75 cu.m)
- `bd.ft` - Board feet (e.g., 2.25 bd.ft)

**Count Units** (whole numbers only):
- `pcs`, `bag`, `pairs`, `roll`, `set`, `sheet`, `btl`, `can`, `pail`

### Quick Examples

✅ **Valid:**
- 1.5 kg rice
- 0.75 ltr oil
- 2.25 m rope
- 3 pcs eggs

❌ **Invalid:**
- 1.5 pcs (must be whole number)
- 2.3 bags (must be whole number)

### Decimal Precision

- Weight/Volume/Length: Up to 3 decimal places (0.001)
- Count items: Whole numbers only (1, 2, 3)

### Adding Products

1. Select unit first
2. Input box shows allowed precision
3. System validates automatically
4. Error messages guide you if invalid

### Making Sales

1. Each product can have fractional quantity
2. System checks sufficient stock
3. FIFO automatically applied (oldest stock used first)
4. Real-time inventory updates

---

## Developer Reference

### Key Functions

```javascript
// Frontend validation
validateQuantity(quantity, unit)         // Returns true/false
formatQuantity(quantity, unit)           // Returns formatted string "1.5 kg"
getQuantityStep(unit)                    // Returns 0.001 or 1
allowsFractional(unit)                   // Returns true/false

// Backend conversion
convertToBaseUnit(quantity, unit)        // 1.5 kg → 1500 g
convertToDisplayUnit(baseQty, unit)      // 1500 g → 1.5 kg
validateQuantityInput(quantity, unit)    // Validates and returns error if invalid
```

### Database Columns

**Inventory_Product:**
- `unit` - Display unit (kg, ltr, pcs, etc.)
- `base_unit` - Base unit (g, ml, pcs, etc.)
- `conversion_factor` - Multiply factor (1000, 1, etc.)

**Add_Stocks:**
- `quantity_added_display` - What user entered (1.5)
- `quantity_added_base` - Stored value (1500)
- `quantity_left_display` - Current display (1.2)
- `quantity_left_base` - Current base (1200)

**Sales_Items:**
- `quantity_display` - What was sold (0.5)
- `quantity_base` - Base unit value (500)

**Sales_Stock_Usage:**
- `quantity_used_display` - Display amount (0.3)
- `quantity_used_base` - Base amount (300)

### SQL Queries

**Get product with stock:**
```sql
SELECT 
    ip.product_name,
    ip.unit,
    ast.quantity_left_display AS quantity,
    ast.quantity_left_base / ip.conversion_factor AS calculated_display
FROM Add_Stocks ast
JOIN Inventory_Product ip USING(product_id, branch_id)
WHERE ast.quantity_left_base > 0;
```

**Get sales with conversions:**
```sql
SELECT 
    si.sale_id,
    ip.product_name,
    si.quantity_display,
    ip.unit,
    si.quantity_base,
    ip.base_unit
FROM Sales_Items si
JOIN Inventory_Product ip USING(product_id, branch_id);
```

### API Response Format

```json
{
  "product_id": 123,
  "product_name": "Rice",
  "quantity": 1.5,
  "unit": "kg",
  "quantity_base": 1500,
  "base_unit": "g"
}
```

### Error Codes

- `INVALID_FRACTIONAL_UNIT` - Fractional quantity for count-based unit
- `INVALID_QUANTITY_FORMAT` - Not a valid number
- `INSUFFICIENT_STOCK` - Not enough stock for sale
- `QUANTITY_OUT_OF_RANGE` - Negative or too large

---

## Troubleshooting

### Problem: Can't enter decimals in quantity field
**Solution:** 
- Check unit type (count units don't allow decimals)
- Clear browser cache
- Verify unitConversion.js imported

### Problem: Validation error on valid quantity
**Solution:**
- Check UNIT_CONFIG has correct unit
- Verify conversion factor in database
- Check browser console for JS errors

### Problem: Stock not deducting correctly
**Solution:**
- Verify quantity_left_base column updated
- Check FIFO logic in inventoryServices.js
- Run database verification queries

### Problem: Display shows wrong decimal places
**Solution:**
- Check formatQuantity() function
- Verify conversion_factor correct
- Ensure using display columns for UI

---

## Conversion Factors Reference

| Display Unit | Base Unit | Factor | Example |
|--------------|-----------|--------|---------|
| kg | g | 1000 | 1.5 kg = 1500 g |
| ltr | ml | 1000 | 0.5 ltr = 500 ml |
| gal | ml | 3785 | 1 gal = 3785 ml |
| m | cm | 100 | 2.5 m = 250 cm |
| meter | cm | 100 | 1.2 meter = 120 cm |
| cu.m | cu.cm | 1000000 | 0.5 cu.m = 500000 cu.cm |
| bd.ft | bd.in | 12 | 2.5 bd.ft = 30 bd.in |
| pcs | pcs | 1 | 3 pcs = 3 pcs |
| bag | bag | 1 | 5 bags = 5 bags |
| btl | btl | 1 | 2 btl = 2 btl |

---

## Best Practices

### For Users:
1. Always select unit before entering quantity
2. Use appropriate decimal places (don't over-specify)
3. Double-check quantity before submitting
4. Understand which units allow decimals

### For Developers:
1. Always use base units for calculations
2. Convert to display units only for UI
3. Use BIGINT for base quantities (prevents overflow)
4. Validate on both frontend and backend
5. Test edge cases (very small/large numbers)
6. Keep conversion cache in memory for performance

### For Database:
1. Never directly update base quantity columns
2. Always update display and base together
3. Use transactions for sales (atomic operations)
4. Index base quantity columns for performance
5. Run verification queries after bulk operations

---

## Testing Checklist

Quick test after deployment:

- [ ] Add 1.5 kg product → Should work
- [ ] Add 1.5 pcs product → Should error
- [ ] Sell 0.5 kg from 2 kg stock → Should leave 1.5 kg
- [ ] Try selling 3 kg from 2 kg stock → Should error
- [ ] Check display shows correct decimals
- [ ] Verify FIFO uses oldest stock first

---

## Performance Notes

- Conversion cache loads on server start (< 100ms)
- Conversions are simple multiplication (< 1ms)
- BIGINT storage same performance as INT
- Indexes on base columns maintain query speed
- No performance degradation expected

---

## Version History

- **v1.0** - Initial fractional quantity implementation
  - 16 units supported
  - Base unit normalization
  - FIFO-compatible
  - Frontend/backend validation
  - Database migration tools

---

## Support Contacts

For issues or questions:
- Check TESTING_FRACTIONAL_QUANTITIES.md
- Review FRACTIONAL_QUANTITY_IMPLEMENTATION.md
- Check database with verify_migration.sql
- Review console/server logs

---

## Quick Commands

**Restart Backend:**
```powershell
cd backend
npm start
```

**Check Migration Status:**
```sql
SELECT * FROM Unit_Conversion;
SELECT COUNT(*) FROM Inventory_Product WHERE base_unit IS NOT NULL;
```

**Rollback:**
```powershell
psql -U username -d database < backup_before_fractional.sql
```

**Verify Conversion:**
```javascript
// In browser console (F12)
import { formatQuantity } from './utils/unitConversion.js';
formatQuantity(1.5, 'kg'); // Should return "1.5"
```
