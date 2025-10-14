# Before and After: Fractional Quantity Implementation

## Example 1: Adding Stock

### BEFORE (Integer Only):
```javascript
// ModalForm.jsx
<input 
  type="text"
  value={quantity_added}
  onChange={(e) => setQuantity(e.target.value)}
  onKeyDown={(e) => {
    // Only allows whole numbers
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
      e.preventDefault();
    }
  }}
/>

// Backend: inventoryServices.js
await SQLquery(`
  INSERT INTO Add_Stocks (product_id, quantity_added, quantity_left)
  VALUES ($1, $2, $2)
`, [productId, quantity_added, quantity_added]);
// User adds 1 kg, database stores: 1
```

### AFTER (Fractional Support):
```javascript
// ModalForm.jsx
import { getQuantityStep } from '../utils/unitConversion';

<input 
  type="number"
  step={unit ? getQuantityStep(unit) : "0.001"}
  min={unit ? getQuantityStep(unit) : "0.001"}
  value={quantity_added}
  onChange={(e) => setQuantity(e.target.value)}
  placeholder="1.5, 2.75, etc."
/>

// Backend: inventoryServices.js
import { convertToBaseUnit } from '../Services_Utils/unitConversion.js';

const quantity_base = convertToBaseUnit(quantity_added, unit);

await SQLquery(`
  INSERT INTO Add_Stocks 
  (product_id, quantity_added_display, quantity_added_base, quantity_left_display, quantity_left_base)
  VALUES ($1, $2, $3, $2, $3)
`, [productId, quantity_added, quantity_base, quantity_added, quantity_base]);
// User adds 1.5 kg
// Database stores: display = 1.5, base = 1500 (grams)
```

---

## Example 2: Selling Products

### BEFORE (Integer Only):
```javascript
// AddSaleModalForm.jsx
<input 
  type="text" 
  className="border w-full" 
  value={row.quantity} 
  onChange={e => {
    const newRows = [...rows];
    newRows[idx].quantity = e.target.value;
    setRows(newRows);
  }}
/>
// User can only sell: 1, 2, 3 kg
// Cannot sell: 0.5, 1.5, 2.75 kg
```

### AFTER (Fractional Support):
```javascript
// AddSaleModalForm.jsx
import { getQuantityStep, validateQuantity } from '../utils/unitConversion';

<input 
  type="number" 
  step={row.unit ? getQuantityStep(row.unit) : "0.001"}
  min={row.unit ? getQuantityStep(row.unit) : "0.001"}
  className="border w-full" 
  value={row.quantity} 
  onChange={e => {
    const newRows = [...rows];
    newRows[idx].quantity = e.target.value;
    
    // Validate quantity
    if (row.unit && e.target.value) {
      const validation = validateQuantity(Number(e.target.value), row.unit);
      if (!validation.valid) {
        console.error(validation.error);
      }
    }
    
    setRows(newRows);
  }}
/>
// User can now sell: 0.5, 1.5, 2.75 kg
// Precise customer transactions!
```

---

## Example 3: Displaying Inventory

### BEFORE (Raw Numbers):
```javascript
// ProductInventory.jsx
<td className="px-6 py-4">
  {item.quantity} {item.unit}
</td>
// Displays: "1.5000000000001 kg" or "2 kg"
// Inconsistent decimal places
```

### AFTER (Formatted Display):
```javascript
// ProductInventory.jsx
import { formatQuantity } from '../utils/unitConversion';

<td className="px-6 py-4">
  {formatQuantity(item.quantity, item.unit)} {item.unit}
</td>
// Displays: "1.5 kg" or "2 kg"
// Clean, consistent formatting
// 1500g shows as "1.5 kg", not "1.500 kg"
```

---

## Example 4: Stock Deduction (FIFO)

### BEFORE (Integer Only):
```javascript
// saleServices.js
// Problem: Can't track fractional quantities precisely

// Batch 1: 3 kg
// Batch 2: 2 kg
// Sell: 1 kg
// Remaining: Batch 1 = 2 kg, Batch 2 = 2 kg ✓

// Sell: 0.5 kg - NOT POSSIBLE!
```

### AFTER (Fractional Support):
```javascript
// saleServices.js
import { convertToBaseUnit } from '../Services_Utils/unitConversion.js';

// Batch 1: 3 kg (3000g base)
// Batch 2: 2 kg (2000g base)

// Sell: 0.5 kg
const quantity_base = convertToBaseUnit(0.5, 'kg'); // 500g

// Deduct from Batch 1: 3000g - 500g = 2500g (2.5 kg)
// Batch 2: Unchanged at 2000g (2 kg)

await SQLquery(`
  UPDATE Add_Stocks 
  SET quantity_left_base = quantity_left_base - $1,
      quantity_left_display = quantity_left_base / conversion_factor
  WHERE add_id = $2
`, [quantity_base, batchId]);

// Track exact usage
await SQLquery(`
  INSERT INTO Sales_Stock_Usage 
  (sales_information_id, product_id, add_stock_id, quantity_used_display, quantity_used_base)
  VALUES ($1, $2, $3, $4, $5)
`, [saleId, productId, batchId, 0.5, 500]);
```

---

## Example 5: Validation

### BEFORE (No Fractional Validation):
```javascript
// Simple check
if (quantity <= 0) {
  return 'Quantity must be positive';
}
// Can't validate precision requirements
```

### AFTER (Unit-Aware Validation):
```javascript
import { validateQuantity } from '../utils/unitConversion';

const validation = validateQuantity(quantity, unit);

if (!validation.valid) {
  return validation.error;
  // For kg: "Quantity must be in multiples of 0.001 kg (1 g)"
  // For pcs: "Quantity must be a whole number"
}

// Examples:
validateQuantity(1.5, 'kg')     // ✓ Valid (1500g)
validateQuantity(1.5001, 'kg')  // ✗ Invalid (too precise)
validateQuantity(0.5, 'ltr')    // ✓ Valid (500ml)
validateQuantity(1.5, 'pcs')    // ✗ Invalid (can't have half a piece)
```

---

## Example 6: Database Query

### BEFORE (Simple Integer):
```sql
-- Get available stock
SELECT 
  product_name,
  SUM(quantity_left) as available_quantity
FROM Add_Stocks
JOIN Inventory_Product USING(product_id)
WHERE product_id = 123
GROUP BY product_name;

-- Result: 5 kg
```

### AFTER (Base Units with Display Conversion):
```sql
-- Get available stock (precise)
SELECT 
  ip.product_name,
  ip.unit,
  -- Sum in base units (always integers)
  SUM(ast.quantity_left_base) as available_base,
  -- Convert to display units
  SUM(ast.quantity_left_base) / ip.conversion_factor as available_display
FROM Add_Stocks ast
JOIN Inventory_Product ip USING(product_id)
WHERE ip.product_id = 123
GROUP BY ip.product_name, ip.unit, ip.conversion_factor;

-- Result: 
-- available_base = 5750 (grams)
-- available_display = 5.75 kg
```

---

## Example 7: Real-World Scenario

### Scenario: Selling Cement

**BEFORE:**
```
Stock: 5 kg
Customer wants: 2.5 kg
Problem: Can only sell 2 kg or 3 kg
Solutions:
  1. Round down: Sell 2 kg (customer unhappy, wants more)
  2. Round up: Sell 3 kg (you lose 0.5 kg for free)
  3. Tell customer to buy whole bags only (bad customer service)
```

**AFTER:**
```
Stock: 5 kg (5000g base)
Customer wants: 2.5 kg

// Frontend
<input type="number" step="0.001" value="2.5" />
// User enters: 2.5

// Backend converts
const base = convertToBaseUnit(2.5, 'kg'); // 2500g

// Deduct from stock
New stock: 5000g - 2500g = 2500g
Display: 2.5 kg

Result: ✓ Customer gets exactly what they want
        ✓ Inventory is accurate
        ✓ No waste or loss
```

---

## Example 8: Threshold Alerts

### BEFORE (Integer Threshold):
```javascript
// Check low stock
if (current_quantity <= min_threshold) {
  sendLowStockAlert();
}

// Problem:
// Threshold: 5 kg
// Stock: 5.5 kg → No alert
// Sell: 1 kg → Stock: 4.5 kg (stored as 4) → Alert!
// Lost precision: 0.5 kg "disappeared"
```

### AFTER (Precise Threshold):
```javascript
// Check low stock with base units
if (current_quantity_base <= (min_threshold * conversion_factor)) {
  sendLowStockAlert();
}

// Accurate:
// Threshold: 5 kg (5000g)
// Stock: 5500g (5.5 kg) → No alert ✓
// Sell: 1000g (1 kg) → Stock: 4500g (4.5 kg) → Alert! ✓
// Precision maintained: exact tracking
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Input Type** | `text` with keydown filter | `number` with step |
| **Values** | Integers only (1, 2, 3) | Decimals (1.5, 0.75) |
| **Storage** | Single column | Display + Base columns |
| **Precision** | Whole units | Down to smallest unit |
| **Validation** | Basic > 0 check | Unit-aware validation |
| **Display** | Raw numbers | Formatted, clean |
| **Database** | INT | INT for base, NUMERIC for display |
| **FIFO** | Works with integers | Works with exact amounts |
| **Customer Service** | Limited by integers | Sell exact amounts |

---

## Migration Example

```sql
-- Your data BEFORE migration:
Add_Stocks:
  add_id | product_id | quantity_added | quantity_left
  -------|------------|----------------|---------------
  1      | 101        | 5              | 3
  2      | 101        | 10             | 8

-- Your data AFTER migration:
Add_Stocks:
  add_id | product_id | quantity_added_display | quantity_added_base | quantity_left_display | quantity_left_base | conversion_factor
  -------|------------|------------------------|---------------------|----------------------|--------------------|-----------------
  1      | 101        | 5                      | 5000                | 3                    | 3000               | 1000
  2      | 101        | 10                     | 10000               | 8                    | 8000               | 1000

-- Now you can:
-- - Sell 2.5 kg: Deduct 2500 from quantity_left_base
-- - Display as: 2.5 kg (calculated from 2500 / 1000)
-- - Track precisely: Every gram accounted for
```

---

## Key Takeaway

**The system works exactly like before for whole numbers, but now also supports fractional quantities with perfect precision!**

- Add 1 kg → Works just like before
- Add 1.5 kg → Now possible!
- Sell 0.5 kg → Now possible!
- Display is always clean and precise
- No data loss, no rounding errors
- Full audit trail maintained
