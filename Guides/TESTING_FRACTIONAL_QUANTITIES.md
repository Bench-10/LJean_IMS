# Testing Guide: Fractional Quantity System

## Pre-Testing Checklist

Before you start testing, ensure:

- [ ] Database migration completed successfully (all 5 steps)
- [ ] Verification script shows no issues
- [ ] Backend server restarted and shows "Unit conversion cache loaded: 16 units"
- [ ] Frontend built and running
- [ ] Browser console cleared (F12 → Console → Clear)

## Test Scenarios

### Test 1: Add Product with Fractional Quantity (Basic)

**Objective:** Verify you can add products with decimal quantities

**Steps:**
1. Login to your system
2. Go to Product Inventory page
3. Click "Add Product" or similar button
4. Fill in product details:
   - Product Name: "Test Rice"
   - Category: Any
   - Unit: **kg** (fractional unit)
   - Quantity: **2.5**
   - Price: 100
   - Expiration Date: Any future date
5. Click Submit/Save

**Expected Results:**
- ✅ Form accepts 2.5 (no validation errors)
- ✅ Product saved successfully
- ✅ Product displays as "2.5 kg" in inventory
- ✅ No errors in console
- ✅ Stock notification works (if low stock)

**If Failed:**
- Check browser console for errors
- Verify Unit_Conversion table has 'kg' entry
- Check backend logs

---

### Test 2: Add Product with Invalid Fractional Quantity

**Objective:** Verify validation prevents fractional quantities for count-based units

**Steps:**
1. Click "Add Product"
2. Fill in:
   - Product Name: "Test Bags"
   - Unit: **bag** (count unit)
   - Quantity: **1.5**
3. Try to submit

**Expected Results:**
- ❌ Validation error appears: "bag only accepts whole numbers"
- ❌ Submit button stays disabled
- ✅ Form does not submit

**If Failed:**
- Check validateQuantity() function in unitConversion.js
- Verify UNIT_CONFIG has bag: {factor: 1}

---

### Test 3: Sell Product with Fractional Quantity

**Objective:** Verify sales work with decimal amounts and FIFO deduction

**Steps:**
1. First, add a product:
   - Product: "Test Oil"
   - Unit: **ltr**
   - Quantity: **5.0**
   - Price: 200
2. Go to Sales page
3. Create a new sale
4. Add the "Test Oil" product
5. Enter quantity: **1.5**
6. Complete the sale

**Expected Results:**
- ✅ Sale accepts 1.5 ltr
- ✅ Sale completes successfully
- ✅ Inventory updates to 3.5 ltr (5.0 - 1.5)
- ✅ Sales record shows 1.5 ltr
- ✅ FIFO deduction works (check Add_Stocks table)

**If Failed:**
- Check saleServices.js for conversion logic
- Verify quantity_left_base column updated correctly
- Check browser console and backend logs

---

### Test 4: Multiple Fractional Sales (FIFO Test)

**Objective:** Verify FIFO works correctly with fractional quantities

**Steps:**
1. Add Stock Batch 1:
   - Product: "Test Sugar"
   - Unit: **kg**
   - Quantity: **10.0**
   - Date: Today
2. Add Stock Batch 2:
   - Same product
   - Quantity: **8.0**
   - Date: Tomorrow
3. Make Sale 1: Sell **12.5 kg**
4. Check remaining stock

**Expected Results:**
- ✅ Sale deducts from Batch 1 first (10.0 kg fully used)
- ✅ Then deducts 2.5 kg from Batch 2
- ✅ Batch 2 shows 5.5 kg remaining (8.0 - 2.5)
- ✅ Total inventory shows 5.5 kg
- ✅ Sales_Stock_Usage table has 2 entries:
  - Batch 1: 10.0 kg used
  - Batch 2: 2.5 kg used

**To Verify FIFO:**
```sql
SELECT 
    ast.stock_id,
    ast.quantity_added_display,
    ast.quantity_left_display,
    ssu.quantity_used_display
FROM Add_Stocks ast
LEFT JOIN Sales_Stock_Usage ssu USING(stock_id, product_id, branch_id)
WHERE product_id = [your_test_product_id]
ORDER BY ast.date_added;
```

**If Failed:**
- Check inventoryServices.js FIFO logic
- Verify convertToBaseUnit() called before deduction
- Check quantity_left_base updates

---

### Test 5: Edge Cases - Very Small Quantities

**Objective:** Test precision with very small decimal amounts

**Steps:**
1. Add product:
   - Unit: **kg**
   - Quantity: **0.25**
2. Sell: **0.1**
3. Sell: **0.05**
4. Check remaining

**Expected Results:**
- ✅ Each operation works
- ✅ Remaining shows **0.10 kg** (0.25 - 0.1 - 0.05)
- ✅ No rounding errors visible
- ✅ Base unit storage prevents precision loss

---

### Test 6: Large Quantity Operations

**Objective:** Verify system handles large decimal quantities

**Steps:**
1. Add product:
   - Unit: **cu.m** (cubic meters)
   - Quantity: **1234.567**
2. Sell: **999.999**
3. Check remaining

**Expected Results:**
- ✅ System accepts large decimals
- ✅ Remaining shows **234.568 cu.m**
- ✅ No overflow errors
- ✅ BIGINT storage handles large base unit values

---

### Test 7: Mixed Unit Types in One Sale

**Objective:** Verify one sale can have both fractional and count-based items

**Steps:**
1. Create a sale with multiple products:
   - Product A: **2.5 kg** rice
   - Product B: **3 pcs** eggs
   - Product C: **1.75 ltr** oil
   - Product D: **5 bags** cement
2. Submit sale

**Expected Results:**
- ✅ All items accepted
- ✅ No validation errors
- ✅ Sale completes
- ✅ Each product deducted correctly
- ✅ Mixed precision displays correctly

---

### Test 8: Insufficient Stock - Fractional

**Objective:** Verify insufficient stock detection works with decimals

**Steps:**
1. Product has: **2.0 kg**
2. Try to sell: **2.5 kg**

**Expected Results:**
- ❌ Error message: "Insufficient stock"
- ❌ Sale does not complete
- ✅ Inventory unchanged

---

### Test 9: Edit Existing Product Quantity

**Objective:** Verify editing product quantities works with decimals

**Steps:**
1. Find an existing product
2. Click Edit
3. Change quantity from **10** to **10.5**
4. Save

**Expected Results:**
- ✅ New quantity accepted
- ✅ Display shows 10.5
- ✅ quantity_left_base updated correctly

---

### Test 10: Analytics and Reports

**Objective:** Verify reports handle fractional quantities

**Steps:**
1. Make several fractional sales
2. Go to Analytics/Reports page
3. Check:
   - Sales reports
   - Low stock alerts
   - Inventory summary
   - Transaction history

**Expected Results:**
- ✅ All quantities display with correct decimals
- ✅ Totals calculate correctly
- ✅ Charts/graphs handle decimals
- ✅ Export functions work

---

## Performance Testing

### Test 11: Bulk Operations

**Objective:** Ensure system performs well with many fractional transactions

**Steps:**
1. Add 10 products with fractional quantities
2. Make 20 sales with mixed fractional amounts
3. Check response times

**Expected Results:**
- ✅ No noticeable slowdown
- ✅ Database queries perform well
- ✅ UI remains responsive

---

## Database Verification Tests

After testing, run these SQL queries to verify data integrity:

### Check 1: Display vs Base Consistency
```sql
SELECT 
    ip.product_name,
    ip.unit,
    ast.quantity_left_display,
    ast.quantity_left_base,
    ip.conversion_factor,
    ast.quantity_left_display * ip.conversion_factor AS expected_base
FROM Add_Stocks ast
JOIN Inventory_Product ip USING(product_id, branch_id)
WHERE ABS(ast.quantity_left_base - (ast.quantity_left_display * ip.conversion_factor)) > 1;
```
Expected: 0 rows (perfect consistency)

### Check 2: FIFO Integrity
```sql
SELECT 
    product_id,
    stock_id,
    quantity_left_base,
    date_added
FROM Add_Stocks
WHERE quantity_left_base > 0
ORDER BY product_id, date_added;
```
Expected: Older stocks depleted first

### Check 3: Sales Totals Match
```sql
SELECT 
    si.sale_id,
    si.quantity_display * ip.conversion_factor AS calculated_base,
    si.quantity_base,
    si.quantity_display * ip.conversion_factor - si.quantity_base AS difference
FROM Sales_Items si
JOIN Inventory_Product ip USING(product_id, branch_id)
WHERE ABS(si.quantity_display * ip.conversion_factor - si.quantity_base) > 1;
```
Expected: 0 rows or minimal rounding differences

---

## Rollback Testing

### Test 12: Emergency Rollback

**Objective:** Verify you can rollback if needed

**Steps:**
1. Stop backend server
2. Restore backup:
   ```powershell
   psql -U your_username -d your_database < backup_before_fractional.sql
   ```
3. Restart server (it will work with old integer system)

**Expected Results:**
- ✅ System reverts to integer-only mode
- ✅ Existing data intact
- ✅ No data loss

---

## Regression Testing

### Test 13: Existing Functionality Still Works

**Objective:** Ensure new fractional system doesn't break existing features

Test all existing features:
- [ ] User login/logout
- [ ] User management
- [ ] Branch management
- [ ] Approvals workflow
- [ ] Notifications
- [ ] Password reset
- [ ] Reports export
- [ ] Search/filter
- [ ] Real-time updates (WebSocket)

---

## Bug Reporting Template

If you find issues, report them with this format:

```
**Test Case:** Test #X - [Name]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Steps to Reproduce:**
1. 
2. 
3. 

**Console Errors:** [Paste any errors]
**Database State:** [Run relevant SQL query]
**Screenshot:** [If applicable]
```

---

## Success Criteria

The fractional quantity system is ready for production when:

- [ ] All 13 tests pass
- [ ] No console errors during normal operations
- [ ] Database verification queries show perfect consistency
- [ ] Performance is acceptable (< 2 seconds for sales)
- [ ] All regression tests pass
- [ ] Users can easily understand decimal inputs
- [ ] FIFO deduction works correctly with decimals
- [ ] No data loss or corruption
- [ ] Rollback procedure verified

---

## Post-Testing Steps

After successful testing:

1. **Document any issues found and fixed**
2. **Train users on fractional quantity input**
3. **Monitor system for first week closely**
4. **Keep backup for 30 days minimum**
5. **Update user manual with fractional quantity examples**

---

## Need Help?

Common issues and solutions:

**Issue:** Validation not working  
**Solution:** Clear browser cache, hard refresh (Ctrl+Shift+R)

**Issue:** Database shows 0 for fractional quantities  
**Solution:** Check if using quantity_base columns, not display columns

**Issue:** FIFO not working correctly  
**Solution:** Verify inventoryServices.js uses convertToBaseUnit() before comparisons

**Issue:** WebSocket not updating  
**Solution:** Restart backend server, check socket.io connection
