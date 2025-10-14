# Frontend Updates for Fractional Quantity Support

## Overview
This document describes the changes needed in the frontend to support fractional quantities.

## Key Changes

### 1. Import Unit Conversion Utilities

Add to your component imports:

```javascript
import { 
  getQuantityStep, 
  formatQuantity, 
  validateQuantity,
  allowsFractional,
  getQuantityPlaceholder
} from '../utils/unitConversion';
```

### 2. Update Input Fields

#### Current Quantity Input (Integer Only):
```javascript
<input 
  type="text"
  value={quantity_added}
  onChange={(e) => setQuantity(e.target.value)}
  onKeyDown={(e) => {
    // Only allows integers
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
      e.preventDefault();
    }
  }}
/>
```

#### Updated Quantity Input (Fractional Support):
```javascript
<input 
  type="number"
  step={unit ? getQuantityStep(unit) : "0.001"}
  min={unit ? getQuantityStep(unit) : "0.001"}
  value={quantity_added}
  onChange={(e) => setQuantity(e.target.value)}
  placeholder={unit ? getQuantityPlaceholder(unit) : "Enter quantity"}
  className={`bg-gray-100 border-gray-300 py-2 px-3 w-full rounded-md border ${
    emptyField.quantity_added || invalidNumber.quantity_added ? 'border-red-500' : ''
  }`}
/>
```

### 3. Update Validation Logic

#### Add Unit-Aware Validation:

```javascript
const validateInputs = () => {
  const isEmptyField = {};
  const isnotANumber = {};
  const invalidNumberValue = {};
  const unitValidationErrors = {};

  // ... existing empty checks ...

  // NEW: Unit-aware quantity validation
  if (unit && quantity_added) {
    const validation = validateQuantity(Number(quantity_added), unit);
    if (!validation.valid) {
      unitValidationErrors.quantity_added = validation.error;
    }
  }

  // Check if quantity is valid for the unit
  if (unit && quantity_added && !isNaN(Number(quantity_added))) {
    if (Number(quantity_added) <= 0) {
      invalidNumberValue.quantity_added = true;
    }
  }

  // Set validation errors
  setEmptyField(isEmptyField);
  setNotANumber(isnotANumber);
  setInvalidNumber(invalidNumberValue);
  setUnitValidationError(unitValidationErrors); // NEW STATE

  // Stop submission if invalid
  if (Object.keys(isEmptyField).length > 0) return;
  if (Object.keys(isnotANumber).length > 0) return;
  if (Object.keys(invalidNumberValue).length > 0) return;
  if (Object.keys(unitValidationErrors).length > 0) return; // NEW

  setDialog(true);
};
```

### 4. Display Formatted Quantities

#### When Displaying Inventory:
```javascript
import { formatQuantity } from '../utils/unitConversion';

// Instead of:
<td>{product.quantity}</td>

// Use:
<td>{formatQuantity(product.quantity, product.unit)}</td>
```

### 5. Update ModalForm.jsx - Complete Example

Here are the key sections to update in ModalForm.jsx:

```javascript
// Add new state for unit validation errors
const [unitValidationError, setUnitValidationError] = useState({});

// Update quantity input field (around line 341)
<input 
  type="number"
  step={unit ? getQuantityStep(unit) : "0.001"}
  min={unit ? getQuantityStep(unit) : "0.001"}
  value={quantity_added}
  onChange={(e) => setQuantity(e.target.value)}
  placeholder={unit ? getQuantityPlaceholder(unit) : "Enter quantity"}
  className={inputClass('quantity_added')}
/>

// Add error message display for unit validation
{unitValidationError.quantity_added && (
  <p className="text-red-500 text-xs mt-1">
    {unitValidationError.quantity_added}
  </p>
)}

// Update validation in validateInputs()
if (unit && quantity_added && !isNaN(Number(quantity_added))) {
  const validation = validateQuantity(Number(quantity_added), unit);
  if (!validation.valid) {
    unitValidationErrors.quantity_added = validation.error;
  }
}

// Update submit button disabled condition
<button 
  disabled={
    !product_name || !category_id || !quantity_added || 
    !unit_cost || !date_added || !unit || 
    !min_threshold || !max_threshold || !unit_price || 
    !product_validity || 
    Object.keys(emptyField).length > 0 ||
    Object.keys(notANumber).length > 0 ||
    Object.keys(invalidNumber).length > 0 ||
    Object.keys(unitValidationError).length > 0 || // NEW
    isExpiredEarly || 
    maxQuant
  }
  type='submit'
>
  {mode === 'add' ? 'Add Item' : 'Update Item'}
</button>
```

### 6. Update AddSaleModalForm.jsx

```javascript
import { 
  getQuantityStep, 
  formatQuantity, 
  validateQuantity,
  convertToBaseUnit 
} from '../utils/unitConversion';

// Update quantity input in the sales table (around line 389)
<input 
  type="number" 
  step={row.unit ? getQuantityStep(row.unit) : "0.001"}
  min={row.unit ? getQuantityStep(row.unit) : "0.001"}
  className="border w-full" 
  value={row.quantity} 
  onChange={e => {
    const newRows = [...rows];
    newRows[idx].quantity = e.target.value;
    setRows(newRows);
  }} 
  onKeyUp={() => createAnAmount(idx)}
  placeholder={row.unit ? getQuantityPlaceholder(row.unit) : "0"}
/>

// Update quantity validation in createAnAmount
const createAnAmount = (index) => {
  const currentId = rows[index].product_id;
  const product = productsToSell.find(p => p.product_id === currentId);
  const availableQuantity = product ? Number(product.quantity) : 0;
  const currentQuantity = Number(rows[index].quantity) || 0;
  const unit = rows[index].unit;

  // Validate quantity for unit
  if (unit && currentQuantity > 0) {
    const validation = validateQuantity(currentQuantity, unit);
    if (!validation.valid) {
      // Show validation error
      setQuantityValidationErrors(prev => ({
        ...prev,
        [index]: validation.error
      }));
      return;
    } else {
      // Clear validation error
      setQuantityValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[index];
        return newErrors;
      });
    }
  }

  // Check if quantity exceeds available stock
  if (currentId && currentQuantity > availableQuantity) {
    setExceedQuanity([...exceedQuanity, currentId]);
    return;
  } else if (exceedQuanity.includes(currentId) && currentQuantity <= availableQuantity) {
    const updatedList = exceedQuanity.filter(q => q !== currentId);
    setExceedQuanity(updatedList);
  }

  // Calculate amount
  const productAmount = rows[index].quantity * rows[index].unitPrice;
  const newRows = [...rows];
  newRows[index].amount = productAmount;

  preventEmptyQuantity(newRows);
  setRows(newRows);
  totalAmount(newRows);
};
```

### 7. Display Helpers

Create a component for displaying quantities consistently:

```javascript
// components/common/QuantityDisplay.jsx
import React from 'react';
import { formatQuantity } from '../../utils/unitConversion';

const QuantityDisplay = ({ quantity, unit, className = '' }) => {
  const formatted = formatQuantity(quantity, unit);
  
  return (
    <span className={className}>
      {formatted} {unit}
    </span>
  );
};

export default QuantityDisplay;
```

Usage:
```javascript
<QuantityDisplay quantity={product.quantity} unit={product.unit} />
```

### 8. Update ProductInventory.jsx Display

```javascript
import { formatQuantity } from '../utils/unitConversion';

// In the table display
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  {formatQuantity(item.quantity, item.unit)} {item.unit}
</td>
```

### 9. API Integration

When sending data to backend, the conversion happens automatically:

```javascript
// Frontend sends display values (user input):
const itemData = {
  product_name,
  quantity_added: Number(quantity_added), // Can be 1.5, 2.75, etc.
  unit,
  // ... other fields
};

// Backend converts to base units before storing
```

When receiving data from backend, use formatQuantity for display:

```javascript
// Backend sends both base and display
const { data } = await api.get('/api/items');

// Display formatted
data.forEach(item => {
  console.log(`${formatQuantity(item.quantity, item.unit)} ${item.unit}`);
});
```

## Input Field Attributes Reference

### For Fractional Units (kg, ltr, m):
```javascript
type="number"
step="0.001"  // Or getQuantityStep(unit)
min="0.001"   // Or getQuantityStep(unit)
```

### For Count Units (pcs, bag, roll):
```javascript
type="number"
step="1"
min="1"
```

## Validation Messages

Good error messages for users:

- "Quantity must be in multiples of 0.001 kg (1 g)"
- "Quantity must be in multiples of 0.001 ltr (1 ml)"
- "Quantity must be a whole number for this unit"
- "Minimum quantity is 0.001 kg"

## Testing Checklist

- [ ] Can add items with fractional quantities (e.g., 1.5 kg, 0.75 ltr)
- [ ] Can sell fractional quantities
- [ ] Validation prevents invalid fractions (e.g., 1.0001 kg for a 1000 factor)
- [ ] Count units still work as integers (1 pcs, not 1.5 pcs)
- [ ] Display shows appropriate decimal places
- [ ] Quantity comparisons work correctly
- [ ] Stock deduction works with FIFO
- [ ] Threshold checks work with fractional quantities
- [ ] Reports and analytics show formatted quantities

## Browser Compatibility

The `type="number"` with `step` attribute is supported in all modern browsers. For older browsers, add:

```javascript
// Fallback for older browsers
<input 
  type="number"
  step={getQuantityStep(unit)}
  onInput={(e) => {
    // Additional validation for browsers that don't respect step
    const value = parseFloat(e.target.value);
    const rounded = roundQuantity(value, unit);
    if (value !== rounded) {
      e.target.value = rounded;
    }
  }}
/>
```

## Performance Considerations

1. **Cache unit config**: Unit conversion config is static, no need to fetch repeatedly
2. **Validate on blur**: For better UX, validate on blur rather than every keystroke
3. **Format on display**: Only format when rendering, not during input

## Next Steps

1. Update ModalForm.jsx with fractional support
2. Update AddSaleModalForm.jsx
3. Update all display components to use formatQuantity
4. Add unit conversion info tooltips for users
5. Test thoroughly with edge cases
