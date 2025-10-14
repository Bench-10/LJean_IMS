/**
 * Frontend Unit Conversion Utilities
 * This mirrors the backend conversion logic for client-side validation
 */

// Unit conversion configuration
// This should match the database Unit_Conversion table
export const UNIT_CONFIG = {
  'kg': { base: 'g', factor: 1000, type: 'weight' },
  'ltr': { base: 'ml', factor: 1000, type: 'volume' },
  'gal': { base: 'ml', factor: 3785, type: 'volume' },
  'm': { base: 'cm', factor: 100, type: 'length' },
  'meter': { base: 'cm', factor: 100, type: 'length' },
  'cu.m': { base: 'cu.cm', factor: 1000000, type: 'volume' },
  'bd.ft': { base: 'bd.in', factor: 12, type: 'length' },
  'pcs': { base: 'pcs', factor: 1, type: 'count' },
  'bag': { base: 'bag', factor: 1, type: 'count' },
  'pairs': { base: 'pairs', factor: 1, type: 'count' },
  'roll': { base: 'roll', factor: 1, type: 'count' },
  'set': { base: 'set', factor: 1, type: 'count' },
  'sheet': { base: 'sheet', factor: 1, type: 'count' },
  'btl': { base: 'btl', factor: 1, type: 'count' },
  'can': { base: 'can', factor: 1, type: 'count' },
  'pail': { base: 'pail', factor: 1, type: 'count' }
};

/**
 * Get unit configuration
 */
export const getUnitConfig = (unit) => {
  const config = UNIT_CONFIG[unit];
  if (!config) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return config;
};

/**
 * Convert display quantity to base quantity
 * @param {number} displayQuantity - Quantity in display unit
 * @param {string} unit - Display unit
 * @returns {number} Base quantity as integer
 */
export const convertToBaseUnit = (displayQuantity, unit) => {
  const config = getUnitConfig(unit);
  return Math.round(displayQuantity * config.factor);
};

/**
 * Convert base quantity to display quantity
 * @param {number} baseQuantity - Base quantity
 * @param {string} unit - Display unit
 * @returns {number} Display quantity
 */
export const convertToDisplayUnit = (baseQuantity, unit) => {
  const config = getUnitConfig(unit);
  return baseQuantity / config.factor;
};

/**
 * Get minimum quantity step for input field
 * @param {string} unit - Display unit
 * @returns {number} Step size
 */
export const getQuantityStep = (unit) => {
  const config = getUnitConfig(unit);
  
  // For count units, step is 1
  if (config.factor === 1) {
    return 1;
  }
  
  // For other units, step is 1/factor (e.g., 0.001 for kg)
  return 1 / config.factor;
};

/**
 * Format quantity for display
 * @param {number} quantity - Quantity to format
 * @param {string} unit - Unit
 * @returns {string} Formatted quantity
 */
export const formatQuantity = (quantity, unit) => {
  const config = getUnitConfig(unit);
  
  // For count units, show as integer
  if (config.factor === 1) {
    return Math.round(quantity).toString();
  }
  
  // For other units, show appropriate decimal places
  let precision = 0;
  let factor = config.factor;
  while (factor > 1) {
    precision++;
    factor = Math.floor(factor / 10);
  }
  
  // Remove trailing zeros
  return parseFloat(quantity.toFixed(precision)).toString();
};

/**
 * Validate quantity input
 * @param {number} quantity - Quantity to validate
 * @param {string} unit - Unit
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateQuantity = (quantity, unit) => {
  try {
    const config = getUnitConfig(unit);
    
    // Check if positive
    if (quantity <= 0) {
      return { valid: false, error: 'Quantity must be greater than 0' };
    }
    
    // Check if valid for unit
    const baseQuantity = quantity * config.factor;
    const isInteger = Math.abs(baseQuantity - Math.round(baseQuantity)) < 0.0001;
    
    if (!isInteger) {
      const minQty = 1 / config.factor;
      return {
        valid: false,
        error: `Quantity must be in multiples of ${minQty} ${unit} (1 ${config.base})`
      };
    }
    
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Get minimum quantity description
 * @param {string} unit - Display unit
 * @returns {string} Description
 */
export const getMinimumQuantityDescription = (unit) => {
  const config = getUnitConfig(unit);
  const minQty = 1 / config.factor;
  
  if (config.factor === 1) {
    return `1 ${unit}`;
  }
  
  return `${minQty} ${unit} (1 ${config.base})`;
};

/**
 * Check if unit allows fractional quantities
 * @param {string} unit - Display unit
 * @returns {boolean} True if fractional allowed
 */
export const allowsFractional = (unit) => {
  const config = getUnitConfig(unit);
  return config.factor > 1;
};

/**
 * Round quantity to valid precision
 * @param {number} quantity - Quantity to round
 * @param {string} unit - Unit
 * @returns {number} Rounded quantity
 */
export const roundQuantity = (quantity, unit) => {
  const baseQuantity = convertToBaseUnit(quantity, unit);
  return convertToDisplayUnit(baseQuantity, unit);
};

/**
 * Get placeholder text for quantity input
 * @param {string} unit - Display unit
 * @returns {string} Placeholder text
 */
export const getQuantityPlaceholder = (unit) => {
  const config = getUnitConfig(unit);
  
  if (config.factor === 1) {
    return '1, 2, 3...';
  }
  
  // Show example with decimals
  return '1.5, 2.25, 3.75...';
};

/**
 * Check if two quantities are equal (within precision)
 * @param {number} qty1 - First quantity
 * @param {number} qty2 - Second quantity
 * @param {string} unit - Unit
 * @returns {boolean} True if equal
 */
export const quantitiesEqual = (qty1, qty2, unit) => {
  const base1 = convertToBaseUnit(qty1, unit);
  const base2 = convertToBaseUnit(qty2, unit);
  return base1 === base2;
};

export default {
  UNIT_CONFIG,
  getUnitConfig,
  convertToBaseUnit,
  convertToDisplayUnit,
  getQuantityStep,
  formatQuantity,
  validateQuantity,
  getMinimumQuantityDescription,
  allowsFractional,
  roundQuantity,
  getQuantityPlaceholder,
  quantitiesEqual
};
