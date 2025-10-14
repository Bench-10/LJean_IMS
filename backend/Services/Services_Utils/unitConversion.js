import { SQLquery } from "../../db.js";

// Cache for unit conversion data
let unitConversionCache = null;

/**
 * Load unit conversion data into cache
 * Call this once at server startup
 */
export const loadUnitConversionCache = async () => {
    try {
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
        
        console.log('✓ Unit conversion cache loaded:', unitConversionCache.size, 'units');
        return unitConversionCache;
    } catch (error) {
        console.error('Failed to load unit conversion cache:', error.message);
        throw error;
    }
};

/**
 * Reload cache (useful for when new units are added)
 */
export const reloadUnitConversionCache = async () => {
    return await loadUnitConversionCache();
};

/**
 * Get conversion data for a unit
 * @param {string} displayUnit - Display unit (kg, ltr, etc.)
 * @returns {Object} Conversion data
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
 * Get all available units
 * @returns {Array} Array of all unit configurations
 */
export const getAllUnits = () => {
    if (!unitConversionCache) {
        throw new Error('Unit conversion cache not initialized.');
    }
    
    return Array.from(unitConversionCache.entries()).map(([displayUnit, data]) => ({
        display_unit: displayUnit,
        ...data
    }));
};

/**
 * Convert display quantity to base quantity (for database storage)
 * @param {number} displayQuantity - Quantity in display unit (can be decimal like 1.5 kg)
 * @param {string} displayUnit - Display unit (kg, ltr, etc.)
 * @returns {number} Base quantity as integer (e.g., 1500 grams)
 */
export const convertToBaseUnit = (displayQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    
    // Multiply by conversion factor and round to nearest integer
    // Math.round handles floating point precision issues
    const baseQuantity = Math.round(displayQuantity * conversion.conversion_factor);
    
    return baseQuantity;
};

/**
 * Convert base quantity to display quantity (for UI display)
 * @param {number} baseQuantity - Quantity in base unit (integer like 1500 grams)
 * @param {string} displayUnit - Display unit to convert to (kg)
 * @returns {number} Display quantity as decimal (e.g., 1.5)
 */
export const convertToDisplayUnit = (baseQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    
    // Divide by conversion factor to get display value
    const displayQuantity = baseQuantity / conversion.conversion_factor;
    
    return displayQuantity;
};

/**
 * Validate if quantity can be precisely converted
 * Useful for input validation
 * @param {number} displayQuantity - Quantity to validate
 * @param {string} displayUnit - Unit to validate with
 * @returns {boolean} True if conversion is precise
 */
export const isValidQuantity = (displayQuantity, displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    const baseQuantity = displayQuantity * conversion.conversion_factor;
    
    // Check if result is effectively an integer (within floating point precision)
    // This handles edge cases where 1.5 * 1000 might be 1499.9999999999998
    return Math.abs(baseQuantity - Math.round(baseQuantity)) < 0.0001;
};

/**
 * Get minimum sellable quantity for a unit
 * This is the smallest amount that can be sold
 * @param {string} displayUnit - Display unit
 * @returns {number} Minimum quantity (e.g., 0.001 for kg = 1g)
 */
export const getMinimumQuantity = (displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    return 1 / conversion.conversion_factor;
};

/**
 * Get step size for input fields
 * @param {string} displayUnit - Display unit
 * @returns {number} Step size for HTML input
 */
export const getQuantityStep = (displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    
    // For count units (conversion factor = 1), step is 1
    if (conversion.conversion_factor === 1) {
        return 1;
    }
    
    // For other units, step is 1/conversion_factor
    // For kg (1000), step is 0.001 (1 gram)
    // For ltr (1000), step is 0.001 (1 ml)
    return 1 / conversion.conversion_factor;
};

/**
 * Format quantity for display with appropriate precision
 * Removes unnecessary trailing zeros
 * @param {number} quantity - Quantity to format
 * @param {string} unit - Unit
 * @returns {string} Formatted quantity
 */
export const formatQuantity = (quantity, unit) => {
    const conversion = getUnitConversion(unit);
    
    // For units with conversion factor of 1 (count units like pcs, bag), show as integer
    if (conversion.conversion_factor === 1) {
        return Math.round(quantity).toString();
    }
    
    // For other units, determine precision based on conversion factor
    // kg (1000) -> 3 decimal places
    // m (100) -> 2 decimal places
    let precision = 0;
    let factor = conversion.conversion_factor;
    while (factor > 1) {
        precision++;
        factor = Math.floor(factor / 10);
    }
    
    // Show up to the precision needed, removing trailing zeros
    // parseFloat removes trailing zeros: "1.500" -> "1.5"
    return parseFloat(quantity.toFixed(precision)).toString();
};

/**
 * Round quantity to valid precision for a unit
 * @param {number} quantity - Quantity to round
 * @param {string} unit - Unit
 * @returns {number} Rounded quantity
 */
export const roundQuantity = (quantity, unit) => {
    const baseQuantity = convertToBaseUnit(quantity, unit);
    return convertToDisplayUnit(baseQuantity, unit);
};

/**
 * Check if a unit requires fractional quantities
 * @param {string} displayUnit - Display unit
 * @returns {boolean} True if unit can have fractions
 */
export const allowsFractionalQuantity = (displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    return conversion.conversion_factor > 1;
};

/**
 * Get user-friendly description of minimum quantity
 * @param {string} displayUnit - Display unit
 * @returns {string} Description like "0.001 kg (1 gram)"
 */
export const getMinimumQuantityDescription = (displayUnit) => {
    const conversion = getUnitConversion(displayUnit);
    const minQty = getMinimumQuantity(displayUnit);
    
    if (conversion.conversion_factor === 1) {
        return `1 ${displayUnit}`;
    }
    
    return `${minQty} ${displayUnit} (1 ${conversion.base_unit})`;
};

/**
 * Validate quantity input from frontend
 * @param {number} quantity - Quantity to validate
 * @param {string} unit - Unit
 * @returns {Object} { valid: boolean, error: string|null }
 */
export const validateQuantityInput = (quantity, unit) => {
    try {
        // Check if unit exists
        const conversion = getUnitConversion(unit);
        
        // Check if quantity is positive
        if (quantity <= 0) {
            return { valid: false, error: 'Quantity must be greater than 0' };
        }
        
        // Check if quantity is valid for the unit
        if (!isValidQuantity(quantity, unit)) {
            const minQty = getMinimumQuantity(unit);
            return { 
                valid: false, 
                error: `Quantity must be in multiples of ${minQty} ${unit} (1 ${conversion.base_unit})` 
            };
        }
        
        return { valid: true, error: null };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

/**
 * Compare two quantities in potentially different units
 * @param {number} qty1 - First quantity
 * @param {string} unit1 - First unit
 * @param {number} qty2 - Second quantity  
 * @param {string} unit2 - Second unit
 * @returns {number} Negative if qty1 < qty2, 0 if equal, positive if qty1 > qty2
 */
export const compareQuantities = (qty1, unit1, qty2, unit2) => {
    const base1 = convertToBaseUnit(qty1, unit1);
    const base2 = convertToBaseUnit(qty2, unit2);
    return base1 - base2;
};

export default {
    loadUnitConversionCache,
    reloadUnitConversionCache,
    getUnitConversion,
    getAllUnits,
    convertToBaseUnit,
    convertToDisplayUnit,
    isValidQuantity,
    getMinimumQuantity,
    getQuantityStep,
    formatQuantity,
    roundQuantity,
    allowsFractionalQuantity,
    getMinimumQuantityDescription,
    validateQuantityInput,
    compareQuantities
};
