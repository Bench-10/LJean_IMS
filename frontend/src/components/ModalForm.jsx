import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';
import api from '../utils/api';
import { getQuantityStep, validateQuantity, getQuantityPlaceholder, allowsFractional } from '../utils/unitConversion';
import DropdownCustom from './DropdownCustom';
import DatePickerCustom from './DatePickerCustom';

function ModalForm({ isModalOpen, OnSubmit, mode, onClose, itemData, listCategories, sanitizeInput }) {
  // GET USER INFORMATION
  const { user } = useAuth();

  // CATEGORY OPTIONS (TEMPORARY)
  const [product_name, setItemName] = useState('');
  const [category_id, setCategory] = useState('');
  const [branch_id, setBranch] = useState('');
  const [quantity_added, setQuantity] = useState(0);
  const [unit_cost, setPurchasedPrice] = useState('');
  const [date_added, setDatePurchased] = useState('');
  const [unit, setUnit] = useState('');
  const [min_threshold, setMinThreshold] = useState('');
  const [max_threshold, setMaxThreshold] = useState('');
  const [unit_price, setPrice] = useState('');
  const [exceedQuantity, setForExceedQuantity] = useState(''); // Fixed typo: exceedQunatity -> exceedQuantity
  const [product_validity, setExpirationDate] = useState('');
  const [maxQuant, setMaxQuant] = useState(false);
  const [description, setDescription] = useState('');
  const [sellingUnits, setSellingUnits] = useState([]);
  const [sellingUnitErrors, setSellingUnitErrors] = useState({ general: '', entries: {} });
  const [showSellingUnitsEditor, setShowSellingUnitsEditor] = useState(false);

  const [editChoice, setEditChoice] = useState(null);

  // EXISTING PRODUCT SELECTION STATES
  const [existingProducts, setExistingProducts] = useState([]);
  const [selectedExistingProduct, setSelectedExistingProduct] = useState(null);
  const [showExistingProducts, setShowExistingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // INCREMENTAL RENDERING STATE FOR LARGE LISTS
  const [visibleCount, setVisibleCount] = useState(20);
  const BATCH_SIZE = 20;
  const overlayRef = useRef(null);

  const areSellingUnitsEqual = (first = [], second = []) => {
    if (first.length !== second.length) return false;
    for (let i = 0; i < first.length; i += 1) {
      const a = first[i] || {};
      const b = second[i] || {};
      if (
        a.unit !== b.unit ||
        a.unit_price !== b.unit_price ||
        a.base_quantity_per_sell_unit !== b.base_quantity_per_sell_unit ||
        Boolean(a.is_base) !== Boolean(b.is_base)
      ) {
        return false;
      }
    }
    return true;
  };

  const syncSellingUnitsWithBase = useCallback((currentUnits, baseUnitValue, basePriceValue) => {
    const sanitizedBaseUnit = typeof baseUnitValue === 'string' ? baseUnitValue.trim() : '';
    const basePriceString = basePriceValue === undefined || basePriceValue === null ? '' : String(basePriceValue);

    const preparedUnits = Array.isArray(currentUnits)
      ? currentUnits.map(entry => ({
          unit: typeof entry?.unit === 'string' ? entry.unit : '',
          unit_price: entry?.unit_price === undefined || entry?.unit_price === null ? '' : String(entry.unit_price),
          base_quantity_per_sell_unit: entry?.base_quantity_per_sell_unit === undefined || entry?.base_quantity_per_sell_unit === null ? '' : String(entry.base_quantity_per_sell_unit),
          is_base: Boolean(entry?.is_base)
        }))
      : [];

    if (!sanitizedBaseUnit) {
      return preparedUnits.filter(entry => !entry.is_base);
    }

    const blanks = [];
    const nonBaseUnits = [];

    preparedUnits.forEach(entry => {
      if (!entry) return;
      const identifier = typeof entry.unit === 'string' ? entry.unit.trim() : '';

      if (!identifier) {
        blanks.push({ ...entry, unit: '' });
        return;
      }

      if (identifier === sanitizedBaseUnit) {
        return;
      }

      const exists = nonBaseUnits.find(existing => existing.unit === identifier);
      if (!exists) {
        nonBaseUnits.push({
          unit: identifier,
          unit_price: entry.unit_price,
          base_quantity_per_sell_unit: entry.base_quantity_per_sell_unit,
          is_base: false
        });
      }
    });

    const result = [
      {
        unit: sanitizedBaseUnit,
        unit_price: basePriceString,
        base_quantity_per_sell_unit: '1',
        is_base: true
      }
    ];

    nonBaseUnits.forEach(entry => {
      result.push({
        unit: entry.unit,
        unit_price: entry.unit_price,
        base_quantity_per_sell_unit: entry.base_quantity_per_sell_unit,
        is_base: false
      });
    });

    blanks.forEach(entry => {
      result.push({
        unit: '',
        unit_price: entry.unit_price,
        base_quantity_per_sell_unit: entry.base_quantity_per_sell_unit,
        is_base: false
      });
    });

    return result;
  }, []);

  const initializeSellingUnits = useCallback((sourceUnits, baseUnitValue, basePriceValue) => {
    const basePriceString = basePriceValue === undefined || basePriceValue === null ? '' : String(basePriceValue);

    const prepared = Array.isArray(sourceUnits)
      ? sourceUnits
          .map(entry => ({
            unit: typeof entry?.unit === 'string' ? entry.unit.trim() : typeof entry?.sell_unit === 'string' ? entry.sell_unit.trim() : '',
            unit_price: entry?.unit_price === undefined || entry?.unit_price === null ? '' : String(entry.unit_price),
            base_quantity_per_sell_unit: entry?.base_quantity_per_sell_unit === undefined || entry?.base_quantity_per_sell_unit === null ? '' : String(entry.base_quantity_per_sell_unit),
            is_base: Boolean(entry?.is_base)
          }))
      : [];

    return syncSellingUnitsWithBase(prepared, baseUnitValue, basePriceString);
  }, [syncSellingUnitsWithBase]);

  const computeUnitsPerBase = (entry) => {
    const quantity = Number(entry?.base_quantity_per_sell_unit);
    if (!Number.isFinite(quantity) || quantity <= 0) return '';
    const computed = 1 / quantity;
    if (!Number.isFinite(computed) || computed <= 0) return '';
    if (Math.abs(computed - Math.round(computed)) < 1e-9) {
      return String(Math.round(computed));
    }
    return computed.toFixed(6).replace(/\.0+$|0+$/,'').replace(/\.$/, '');
  };

  // STATES FOR ERROR HANDLING
  const [emptyField, setEmptyField] = useState({});
  const [notANumber, setNotANumber] = useState({});
  const [invalidNumber, setInvalidNumber] = useState({});
  const [isExpiredEarly, setIsExpiredEarly] = useState(false);
  const [unitValidationError, setUnitValidationError] = useState({});

  // LOADING STATE
  const [loading, setLoading] = useState(false);

  // FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const message = mode === 'add' ? "Are you sure you want to add this?" : "Are you sure you want to edit this?";

  // FETCH EXISTING PRODUCTS ON MODAL OPEN
  const fetchExistingProducts = async () => {
    try {
      const response = await api.get('/api/items/unique');
      setExistingProducts(response.data);
    } catch (error) {
      console.error('Error fetching existing products:', error);
    }
  };

  // CLEARS THE FORM EVERYTIME THE ADD ITEMS BUTTON IS PRESSED
  useEffect(() => {
    if (!user) return;

    if (isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role))) {
      setInvalidNumber({});
      setIsExpiredEarly(false);
      setEmptyField({});
      setNotANumber({});
      setUnitValidationError({});
      setSelectedExistingProduct(null);
      setSearchTerm('');
      // reset edit choice when modal opens
      setEditChoice(null);

      if (mode === 'add') {
        setItemName('');
        setCategory('');
        setBranch(user.branch_id);
        setQuantity(0);
        setPurchasedPrice('');
        setDatePurchased('');
        setUnit('');
        setMaxThreshold('');
        setMinThreshold('');
        setPrice('');
        setExpirationDate('');
        setMaxQuant(false);
        setForExceedQuantity('');
        setDescription('');
        setSellingUnits([]);
        setSellingUnitErrors({ general: '', entries: {} });
        setShowSellingUnitsEditor(false);

        // FETCH EXISTING PRODUCTS FOR SELECTION
        fetchExistingProducts();
      }

      if (isModalOpen && mode === 'edit' && itemData) {
        setItemName(itemData.product_name);
        setCategory(itemData.category_id);
        setBranch(user.branch_id); // BRANCH ID FROM USER INFORMATION
        setQuantity(0);
        setPurchasedPrice(itemData.unit_cost);
        setUnit(itemData.unit);
        setMinThreshold(itemData.min_threshold);
        setMaxThreshold(itemData.max_threshold);
        setPrice(itemData.unit_price ?? '');
        setForExceedQuantity(itemData.quantity);
        setDatePurchased('');
        setExpirationDate('');
        setDescription(itemData.description);
        setSellingUnits(initializeSellingUnits(itemData.selling_units, itemData.unit, itemData.unit_price));
        setSellingUnitErrors({ general: '', entries: {} });
        setShowSellingUnitsEditor(Array.isArray(itemData.selling_units) && itemData.selling_units.some(entry => !entry?.is_base));
      }
    }
  }, [isModalOpen, mode, itemData, user, initializeSellingUnits]);

  useEffect(() => {
    setSellingUnits(prevUnits => {
      const nextUnits = syncSellingUnitsWithBase(prevUnits, unit, unit_price);
      return areSellingUnitsEqual(prevUnits, nextUnits) ? prevUnits : nextUnits;
    });
    if (!unit || !unit.trim()) {
      setShowSellingUnitsEditor(false);
    }
  }, [unit, unit_price, syncSellingUnitsWithBase]);

   useEffect(() => {
     if (!showSellingUnitsEditor) return undefined;
     const handleKeyDown = (event) => {
       if (event.key === 'Escape') {
         setShowSellingUnitsEditor(false);
       }
     };
     document.addEventListener('keydown', handleKeyDown);
     return () => {
       document.removeEventListener('keydown', handleKeyDown);
     };
   }, [showSellingUnitsEditor]);
 
  const constructionUnits = ["pcs", "ltr", "gal", "bag", "pairs", "roll", "set", "sheet", "kg", "m", "cu.m", "btl", "can", "bd.ft", "meter", "pail"];

  // HANDLE SELECTING AN EXISTING PRODUCT
  const handleSelectExistingProduct = (product) => {
    setSelectedExistingProduct(product);
    setItemName(product.product_name);
    setUnit(product.unit);
    setCategory(product.category_id);
    setShowExistingProducts(false);
    setDescription(product.description);
    setPrice(product.unit_price !== undefined && product.unit_price !== null ? String(product.unit_price) : '');
    setSellingUnits(initializeSellingUnits(product.selling_units, product.unit, product.unit_price));
    setSellingUnitErrors({ general: '', entries: {} });
    setShowSellingUnitsEditor(Array.isArray(product.selling_units) && product.selling_units.some(entry => !entry?.is_base));
  };

  // FILTER EXISTING PRODUCTS BASED ON SEARCH TERM
  const filteredExistingProducts = existingProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const nonBaseSellingUnitCount = sellingUnits.filter(entry => !entry.is_base).length;
  const hasSellingUnitIssues = Boolean(sellingUnitErrors.general) || Object.keys(sellingUnitErrors.entries || {}).length > 0;
  const sellingUnitToggleButtonClass = (() => {
    if (!unit || !unit.trim()) return 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed';
    if (hasSellingUnitIssues) return 'border-red-500 text-red-600 hover:bg-red-50';
    return 'border-green-600 text-green-700 hover:bg-green-50';
  })();
  const baseUnitPriceDisplay = (() => {
    const parsed = Number(unit_price);
    if (!Number.isFinite(parsed) || parsed <= 0) return '—';
    return `₱${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  })();
  const getAvailableUnitOptions = useCallback((rowIndex) => {
    const normalizedBaseUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
    const currentEntry = sellingUnits[rowIndex] || {};
    const currentValue = typeof currentEntry.unit === 'string' ? currentEntry.unit.trim() : '';
    const normalizedCurrentValue = currentValue.toLowerCase();

    const usedUnits = new Set();
    sellingUnits.forEach((entry, idx) => {
      if (idx === rowIndex) return;
      if (entry?.is_base) return;
      const identifier = typeof entry?.unit === 'string' ? entry.unit.trim() : '';
      if (!identifier) return;
      usedUnits.add(identifier.toLowerCase());
    });

    const dedupe = new Set();
    const options = [];

    if (currentValue && !constructionUnits.some(opt => opt.toLowerCase() === normalizedCurrentValue)) {
      options.push({ value: currentValue, label: currentValue });
      dedupe.add(normalizedCurrentValue);
    }

    constructionUnits.forEach(option => {
      const normalizedOption = option.trim().toLowerCase();
      if (normalizedOption === normalizedBaseUnit) return;
      if (usedUnits.has(normalizedOption) && normalizedOption !== normalizedCurrentValue) return;
      if (!dedupe.has(normalizedOption)) {
        options.push({ value: option, label: option });
        dedupe.add(normalizedOption);
      }
    });

    return options;
  }, [constructionUnits, sellingUnits, unit]);
  const availableUnitsForNewRow = getAvailableUnitOptions(sellingUnits.length);

  // TOGGLE EXISTING PRODUCTS PANEL
  const toggleExistingProductsPanel = () => {
    setShowExistingProducts(!showExistingProducts);
    if (!showExistingProducts) {
      setSearchTerm('');
    }
  };

  // RESET VISIBLE COUNT WHEN SEARCH TERM OR PANEL OPENS/CLOSES
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);

    if (overlayRef.current) {
      overlayRef.current.scrollTop = 0;
    }
  }, [searchTerm, showExistingProducts, existingProducts]);

  const handleThreshold = (quantity, threshold) => {
    if (mode === 'add') {
      if (Number(quantity) > threshold) {
        setMaxQuant(true);
      } else {
        setMaxQuant(false);
      }
    }

    if (mode === 'edit') {
      if (Number(exceedQuantity) + Number(quantity) > threshold) { // Fixed variable name
        setMaxQuant(true);
      } else {
        setMaxQuant(false);
      }
    }
  };

  const handleAddSellingUnitRow = () => {
    setSellingUnits(prev => ([
      ...prev,
      {
        unit: '',
        unit_price: '',
        base_quantity_per_sell_unit: '',
        is_base: false
      }
    ]));

    setSellingUnitErrors(prev => ({ ...prev, general: '' }));
  };

  const handleSellingUnitFieldChange = (index, field, rawValue) => {
    setSellingUnits(prev => prev.map((entry, idx) => {
      if (idx !== index) return entry;

      const updated = { ...entry };
      let value = rawValue;

      if (field === 'unit') {
        value = typeof value === 'string' ? sanitizeInput(value) : '';
      }

      if (field === 'unit_price' || field === 'base_quantity_per_sell_unit') {
        value = value === '' ? '' : value;
      }

      updated[field] = value;
      return updated;
    }));

    setSellingUnitErrors(prev => {
      if (!prev.entries || !prev.entries[index]) return prev;
      const nextEntries = { ...prev.entries };
      delete nextEntries[index];
      return { ...prev, entries: nextEntries };
    });
  };

  const handleRemoveSellingUnitRow = (index) => {
    setSellingUnits(prev => prev.filter((_, idx) => idx !== index));
    setSellingUnitErrors({ general: '', entries: {} });
  };

  // HANDLE SCROLL TO LOAD MORE (FOR PERFORMANCE)
  const handleOverlayScroll = useCallback((e) => {
    const target = e.target;
    if (!target) return;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 120;
    if (nearBottom && visibleCount < filteredExistingProducts.length) {
      setVisibleCount((v) => Math.min(v + BATCH_SIZE, filteredExistingProducts.length));
    }
  }, [visibleCount, filteredExistingProducts.length]);

  const validateInputs = () => {
    // THIS VARIABLES STORE THE ERROR INPUTS
    const isEmptyField = {};
    const isnotANumber = {};
    const invalidNumberValue = {};
    const unitValidationErrors = {};
    const sellingEntryErrors = {};
    let sellingGeneralError = '';

    // CHECK IF INPUT IS EMPTY
    if (mode === 'edit' && editChoice === 'addStocks') {
      // only require quantity and unit_cost (and date) for add-stocks flow
      if (!String(quantity_added).trim()) isEmptyField.quantity_added = true;
      if (!String(unit_cost).trim()) isEmptyField.unit_cost = true;
      if (!String(date_added).trim()) isEmptyField.date_added = true;
      if (!String(product_validity).trim()) isEmptyField.product_validity = true;
    } else {
      if (!String(product_name).trim()) isEmptyField.product_name = true;
      if (!String(category_id).trim()) isEmptyField.category_id = true;
      if (!String(quantity_added).trim()) isEmptyField.quantity_added = true;
      if (!String(unit_cost).trim()) isEmptyField.unit_cost = true;
      if (!String(unit).trim()) isEmptyField.unit = true;
      if (!String(min_threshold).trim()) isEmptyField.min_threshold = true;
      if (!String(max_threshold).trim()) isEmptyField.max_threshold = true;
      if (!String(unit_price).trim()) isEmptyField.unit_price = true;
    }

    // CHECK IF INPUT IS NOT A NUMBER
    if (mode === 'edit' && editChoice === 'addStocks') {
      if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
      if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
    } else {
      if (isNaN(Number(quantity_added))) isnotANumber.quantity_added = true;
      if (isNaN(Number(unit_cost))) isnotANumber.unit_cost = true;
      if (isNaN(Number(min_threshold))) isnotANumber.min_threshold = true;
      if (isNaN(Number(max_threshold))) isnotANumber.max_threshold = true;
      if (isNaN(Number(unit_price))) isnotANumber.unit_price = true;
    }

    // CHECK IF NUMBER IS 0 OR LESS
    if (mode === 'add') {
      if (String(quantity_added).trim() && Number(quantity_added) <= 0) invalidNumberValue.quantity_added = true;
    } else {
      if (String(quantity_added).trim() && Number(quantity_added) < 0) invalidNumberValue.quantity_added = true;
    }

    if (String(unit_cost).trim() && Number(unit_cost) <= 0) invalidNumberValue.unit_cost = true;

    if (!(mode === 'edit' && editChoice === 'addStocks')) {
      if (String(min_threshold).trim() && Number(min_threshold) <= 0) invalidNumberValue.min_threshold = true;
      if (String(max_threshold).trim() && Number(max_threshold) <= 0) invalidNumberValue.max_threshold = true;
      if (String(unit_price).trim() && Number(unit_price) <= 0) invalidNumberValue.unit_price = true;
    }

    // CHECK IF DATE ADDED IS GREATER THAN THE EXPIRY DATE
    const isExpiryEarly = date_added > product_validity;
    setIsExpiredEarly(isExpiryEarly);

    // NEW: Unit-aware quantity validation
    if (unit && quantity_added && !isNaN(Number(quantity_added))) {
      const validation = validateQuantity(Number(quantity_added), unit);
      if (!validation.valid) {
        unitValidationErrors.quantity_added = validation.error;
      }
    }

    if (!(mode === 'edit' && editChoice === 'addStocks')) {
      const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
      const hasBaseUnit = sellingUnits.some(entry => entry.is_base && entry.unit === trimmedUnit);
      const baseUnitPriceValue = Number(unit_price);

      if (!trimmedUnit) {
        sellingGeneralError = 'Select a base unit before configuring selling units.';
      } else if (!hasBaseUnit) {
        sellingGeneralError = 'Base unit entry is required in selling units.';
      } else if (!Number.isFinite(baseUnitPriceValue) || baseUnitPriceValue <= 0) {
        sellingGeneralError = 'Enter a valid price for the base unit.';
      }

      sellingUnits.forEach((entry, index) => {
        const entryErrors = [];
        const identifier = typeof entry.unit === 'string' ? entry.unit.trim() : '';
        const priceNumeric = Number(entry.unit_price);
        const baseQuantityNumeric = Number(entry.base_quantity_per_sell_unit);

        if (!identifier) {
          entryErrors.push('Unit name is required.');
        }

        if (!Number.isFinite(priceNumeric) || priceNumeric <= 0) {
          entryErrors.push('Price must be greater than 0.');
        }

        if (!Number.isFinite(baseQuantityNumeric) || baseQuantityNumeric <= 0) {
          entryErrors.push('Conversion value must be greater than 0.');
        }

        if (entry.is_base && identifier !== trimmedUnit) {
          entryErrors.push('Base unit entry must match the selected inventory unit.');
        }

        if (!entry.is_base && identifier === trimmedUnit) {
          entryErrors.push('Non-base entry cannot use the base unit.');
        }

        if (entryErrors.length > 0) {
          sellingEntryErrors[index] = entryErrors;
        }
      });

      if (!sellingGeneralError && Object.keys(sellingEntryErrors).length > 0) {
        sellingGeneralError = 'Fix the selling unit errors before submitting.';
      }
    }

    // SET THE VALUES TO THE STATE VARIABLE
    setEmptyField(isEmptyField);
    setNotANumber(isnotANumber);
    setInvalidNumber(invalidNumberValue);
    setUnitValidationError(unitValidationErrors);
    setSellingUnitErrors({ general: sellingGeneralError, entries: sellingEntryErrors });

    // STOP SUBMISSION IF INPUT IS INVALID
    if (Object.keys(isEmptyField).length > 0) return;
    if (Object.keys(isnotANumber).length > 0) return;
    if (Object.keys(invalidNumberValue).length > 0) return;
    if (Object.keys(unitValidationErrors).length > 0) return;
    if (sellingGeneralError) return;
    if (Object.keys(sellingEntryErrors).length > 0) return;
    if (isExpiryEarly) return;

    setDialog(true);
  };

  // HANDLES THE SUBMIT
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // RUNS IF THERE ARE NO INVALID INPUTS
      const itemData = {
        product_name,
        category_id: Number(category_id),
        branch_id: Number(branch_id),
        unit,
        unit_price: Number(unit_price),
        unit_cost: Number(unit_cost),
        quantity_added: Number(quantity_added),
        min_threshold: Number(min_threshold),
        max_threshold: Number(max_threshold),
        date_added,
        product_validity,
        userID: user.user_id,
        fullName: user.full_name,
        requestor_roles: user.role,
        existing_product_id: selectedExistingProduct?.product_id || null,
        description,
        selling_units: sellingUnits.map(entry => ({
          unit: typeof entry.unit === 'string' ? entry.unit.trim() : '',
          unit_price: Number(entry.unit_price),
          base_quantity_per_sell_unit: Number(entry.base_quantity_per_sell_unit),
          is_base: Boolean(entry.is_base)
        }))
      };

      // SENDS THE DATA TO App.jsx TO BE SENT TO DATABASE
      await OnSubmit(itemData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => {
    const hasError = emptyField[field] || notANumber[field] || invalidNumber[field] || (isExpiredEarly && field === 'product_validity');
    return `w-full py-2 px-4 rounded-lg bg-white border ${hasError ? 'border-red-500 ring-1 ring-red-50' : 'border-gray-200'} text-sm placeholder-gray-400 shadow-sm focus:outline-none transition focus:shadow-outline disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${hasError ? 'focus:ring-red-500' : 'focus:ring-indigo-500'}`;
  };

  const label = (field) => `block text-sm font-medium mb-1 ${emptyField[field] ? 'text-red-600' : 'text-gray-600'} ${isExpiredEarly && field === 'product_validity' ? 'text-red-600' : ''}`;

  const errorflag = (field, field_warn) => {
    if (emptyField[field])
      return <p className="mt-1 text-xs text-red-600">{`Please enter a ${field_warn}!`}</p>;

    if (notANumber[field])
      return <p className="mt-1 text-xs text-red-600">Must be a positive number!</p>;

    if (invalidNumber[field])
      return <p className="mt-1 text-xs text-red-600">Value must not be less than 1!</p>;

    if (isExpiredEarly && field === 'product_validity')
      return <p className="mt-1 text-xs text-red-600">Expiry date must be after purchase date!</p>;

    return null;
  };

  return (
    <div>
      {/* Loading overlay */}
      {loading && (
        <FormLoading
          message={mode === 'add' ? "Adding product..." : "Updating product..."}
        />
      )}

      {openDialog &&
        <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={() => { handleSubmit(); }}
          onClose={() => { setDialog(false); }}
        />
      }

      {/* When editing, prompt the user to choose action before showing edit fields */}
      {isModalOpen && mode === 'edit' && !editChoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-md sm:max-w-lg">
            <h4 className="font-semibold text-xl sm:text-2xl mb-6 text-center">Choose an action</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button type="button" onClick={() => setEditChoice('edit')} className="p-4 border border-gray-100 rounded-lg hover:shadow-md text-left transition">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 010 2.828l-9.9 9.9a1 1 0 01-.464.263l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.263-.464l9.9-9.9a2 2 0 012.828 0z" />
                  </svg>
                  <span className="font-medium">Edit Product Data</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Change product attributes such as unit, price, thresholds and description.</p>
              </button>
              <button type="button" onClick={() => setEditChoice('addStocks')} className="p-4 border border-gray-100 rounded-lg hover:shadow-md text-left transition">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Add Stocks</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Quickly add stock quantity and cost without changing other product details.</p>
              </button>
            </div>
            <div className="mt-8 text-center">
              <button type="button" onClick={() => { onClose(); setEditChoice(null); setShowExistingProducts(false); setMaxQuant(false); setShowSellingUnitsEditor(false); }} className="text-sm text-gray-500 px-5 py-2  rounded-md border hover:bg-gray-50 ">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role)) && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm transition-opacity"
          style={{ pointerEvents: 'auto' }}
          onClick={() => { onClose(); setMaxQuant(false); setShowSellingUnitsEditor(false); }}
        />
      )}

      <dialog className="bg-transparent fixed inset-0 z-[200]" open={mode === 'edit' ? isModalOpen && user && user.role && editChoice && user.role.some(role => ['Inventory Staff'].includes(role)) : isModalOpen && user && user.role && user.role.some(role => ['Inventory Staff'].includes(role))}>
        <div className="relative bg-white h-[75vh] lg:h-[600px] w-[100vw] max-w-[800px] overflow-y-auto rounded-xl p-6 lg:py-10 lg:px-[53px] shadow-2xl border border-gray-100 animate-popup hide-scrollbar">
          {showSellingUnitsEditor && (
            <div
              className="absolute inset-0 z-[400] flex items-start justify-center bg-black/20 backdrop-blur-sm px-4 pt-6 pb-10"
              onClick={() => setShowSellingUnitsEditor(false)}
            >
              <div
                className="relative w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-xl p-5 sm:p-6 lg:p-7 overflow-y-auto max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800">Selling Units &amp; Pricing</h4>
                    <p className="text-sm text-gray-600 max-w-xl">Configure alternate selling units, their prices, and conversions relative to the base inventory unit.</p>
                  </div>
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowSellingUnitsEditor(false)}
                    aria-label="Close selling units editor"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="text-xs sm:text-sm text-gray-500">
                    <p><span className="font-semibold text-gray-700">Base unit:</span> {unit || 'N/A'}</p>
                    <p><span className="font-semibold text-gray-700">Base price:</span> {baseUnitPriceDisplay}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSellingUnitRow}
                    className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md border border-green-600 text-green-700 hover:bg-green-50 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50"
                    disabled={!unit || !unit.trim() || availableUnitsForNewRow.length === 0}
                  >
                    Add Selling Unit
                  </button>
                </div>

                {!unit || !unit.trim() ? (
                  <div className="text-sm text-gray-500 italic mb-4">Select the product&apos;s base unit first to manage alternate selling units.</div>
                ) : availableUnitsForNewRow.length === 0 ? (
                  <div className="text-sm text-gray-500 italic mb-4">All available units from the list are already configured.</div>
                ) : null}

                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left w-[24%]">Unit</th>
                        <th className="px-3 py-2 text-left w-[18%]">Unit Price</th>
                        <th className="px-3 py-2 text-left w-[20%]">Base Qty</th>
                        <th className="px-3 py-2 text-left w-[22%]">Units per Base</th>
                        <th className="px-3 py-2 text-left w-[16%]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellingUnits.length === 0 ? (
                        <tr>
                          <td className="px-3 py-5 text-center text-gray-500" colSpan={5}>No selling units configured yet.</td>
                        </tr>
                      ) : (
                        sellingUnits.map((entry, index) => {
                          const isBase = Boolean(entry.is_base);
                          const entryErrors = sellingUnitErrors.entries[index] || [];
                          const unitsPerBase = computeUnitsPerBase(entry);
                          return (
                            <tr key={`${entry.unit || 'unit'}-${index}`} className={isBase ? 'bg-green-50/70' : ''}>
                              <td className="px-3 py-2 align-top">
                                {isBase ? (
                                  <input
                                    type="text"
                                    className="w-full border rounded-sm px-2 py-1 bg-gray-100 text-gray-600 cursor-not-allowed"
                                    value={entry.unit}
                                    readOnly
                                  />
                                ) : (
                                  <select
                                    className="w-full border rounded-sm px-2 py-1 bg-white"
                                    value={entry.unit}
                                    onChange={(e) => handleSellingUnitFieldChange(index, 'unit', e.target.value)}
                                  >
                                    <option value="">Select unit</option>
                                    {getAvailableUnitOptions(index).map(option => (
                                      <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                )}
                                {isBase && <p className="text-[10px] text-gray-500 mt-1">Base unit follows the selected inventory unit.</p>}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={`w-full border rounded-sm px-2 py-1 ${isBase ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                                  value={isBase ? unit_price : entry.unit_price}
                                  onChange={(e) => (isBase ? setPrice(e.target.value) : handleSellingUnitFieldChange(index, 'unit_price', e.target.value))}
                                  disabled={isBase}
                                />
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.000001"
                                  className={`w-full border rounded-sm px-2 py-1 ${isBase ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                                  value={isBase ? '1' : entry.base_quantity_per_sell_unit}
                                  onChange={(e) => handleSellingUnitFieldChange(index, 'base_quantity_per_sell_unit', e.target.value)}
                                  disabled={isBase}
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Amount of base unit per {entry.unit || 'sell unit'}.</p>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <input
                                  type="text"
                                  className="w-full border rounded-sm px-2 py-1 bg-gray-100 text-gray-600 cursor-not-allowed"
                                  value={isBase ? '1' : unitsPerBase}
                                  readOnly
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Sell units per base unit.</p>
                              </td>
                              <td className="px-3 py-2 align-top text-center">
                                {isBase ? (
                                  <span className="text-[10px] text-gray-400">Base</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="text-xs text-red-600 hover:text-red-700"
                                    onClick={() => handleRemoveSellingUnitRow(index)}
                                  >
                                    Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {sellingUnitErrors.general && (
                  <p className="mt-3 text-xs text-red-600">{sellingUnitErrors.general}</p>
                )}

                {sellingUnits.map((_, index) => (
                  sellingUnitErrors.entries[index]?.length ? (
                    <ul key={`selling-unit-errors-${index}`} className="mt-1 text-[11px] text-red-600 list-disc list-inside">
                      {sellingUnitErrors.entries[index].map((message, idx) => (
                        <li key={`entry-${index}-error-${idx}`}>{message}</li>
                      ))}
                    </ul>
                  ) : null
                ))}
              </div>
            </div>
          )}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mode === 'edit' && editChoice && (
                  <button
                    type="button"
                    onClick={() => { setEditChoice(null); setShowExistingProducts(false); }}
                    className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded-md border border-gray-100 hover:bg-gray-50"
                  >
                    ← Back
                  </button>
                )}
                <div>
                  <h3 className="text-2xl font-bold">{mode === 'edit' ? 'EDIT ITEM' : 'ADD NEW ITEM'}</h3>
                  <p className="text-sm opacity-90">{mode === 'edit' ? 'Modify product details or add stock' : 'Create a new product in inventory'}</p>
                </div>
              </div>
              <button type='button' className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors z-10"
                onClick={() => {
                  onClose();
                  setShowExistingProducts(false);
                  setMaxQuant(false);
                  setShowSellingUnitsEditor(false);
                }}>✕</button>
            </div>
          </div>

          <div className="pt-2">
            {/*FORMS */}
            <form onSubmit={(e) => { e.preventDefault(); validateInputs(); }}>
              {/*PRODUCT NAME*/}
              <div className='relative mb-4'>
                <label className={label('product_name')}>Product name</label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
                      </svg>
                    </span>
                    <input
                      id='item'
                      type="text"
                      placeholder='Item Name'
                      className={`${inputClass('product_name')} rounded-lg pl-10 ${selectedExistingProduct ? 'border-green-500 bg-green-900' : ''}`}
                      value={product_name}
                      onChange={(e) => setItemName(sanitizeInput(e.target.value))}
                      disabled={selectedExistingProduct || mode === 'edit'}
                    />
                  </div>
                  {mode === 'add' && (
                    <button
                      type="button"
                      onClick={toggleExistingProductsPanel}
                      className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${showExistingProducts
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-blue-800 text-white hover:bg-blue-600'
                        }`}
                    >
                      {showExistingProducts ? 'Cancel' : 'Browse'}
                    </button>
                  )}
                </div>

                {selectedExistingProduct && (
                  <div className="mt-2 inline-flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-full px-3 py-1 text-sm">
                    <span className="font-medium">{selectedExistingProduct.product_name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDescription('');
                        setSelectedExistingProduct(null);
                        setItemName('');
                        setUnit('');
                        setCategory('');
                      }}
                      className="ml-2 text-sm text-green-700 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {errorflag('product_name', 'product name')}

                {/* EXISTING PRODUCTS PANEL (OVERLAY) */}
                {mode === 'add' && showExistingProducts && (
                  <div ref={overlayRef} onScroll={handleOverlayScroll} className="absolute left-0 top-full mt-2 border border-gray-500 rounded-md p-4 bg-white max-h-96 overflow-y-auto w-full shadow-lg z-10 hide-scrollbar">
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Search existing products..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      {filteredExistingProducts.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                          {searchTerm ? 'No products found matching your search' : 'No existing products available'}
                        </p>
                      ) : (
                        filteredExistingProducts.slice(0, visibleCount).map((product) => (
                          <div
                            key={product.product_id}
                            onClick={() => handleSelectExistingProduct(product)}
                            className="p-4 border border-gray-100 rounded-lg cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-sm">{product.product_name}</div>
                                <div className="text-xs text-gray-500">{product.category_name} • {product.unit}</div>
                              </div>
                              <div className="text-xs text-gray-400">ID: {product.product_id}</div>
                            </div>
                            <div className="mt-2 text-xs text-gray-400">Available in: {product.branches}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* DESCRIPTION FIELD */}
              {!(mode === 'edit' && editChoice === 'addStocks') && (
                <div className="mb-4 ">
                  <label className={label('description')}>Description</label>
                  <textarea
                    placeholder="Enter product description"
                    className="w-full p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[72px] shadow-sm"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={selectedExistingProduct || mode === 'edit'}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 mt-6">
                {/* Left column inputs */}
                <div className="flex flex-col gap-6">
                  {/* If user chose addStocks while editing, only show quantity & unit cost (plus date) */}
                  {!(mode === 'edit' && editChoice === 'addStocks') &&
                    <div className='relative'>
                      <DropdownCustom
                        value={category_id}
                        onChange={(e) => setCategory(e.target.value)}
                        label="Category"
                        variant="simple"
                        error={emptyField.category_id}
                        options={[
                          { value: '', label: 'Select Category' },
                          ...listCategories.map(option => ({
                            value: option.category_id,
                            label: option.category_name
                          }))
                        ]}
                      />
                      {errorflag('category_id', 'category')}
                    </div>
                  }

                  {!(mode === 'edit' && editChoice === 'addStocks') &&
                    <div className='relative grid grid-cols-2 gap-3 '>
                      <div>
                        <label className={`${label('min_threshold')}`}>Min threshold</label>
                        <input
                          placeholder="Min Threshold"
                          className={`${inputClass('min_threshold')} focus:border-2 focus:border-green-500`}
                          value={min_threshold}
                          onChange={(e) => setMinThreshold(e.target.value)}
                        />
                        {errorflag('min_threshold', 'value')}
                      </div>
                      <div>
                        <label className={label('max_threshold')}>Max threshold</label>
                        <input
                          placeholder="Max Threshold"
                          className={`${inputClass('max_threshold')} focus:border-2 focus:border-green-500`}
                          value={max_threshold}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMaxThreshold(value);
                            handleThreshold(quantity_added, value);
                          }}
                        />
                        {errorflag('max_threshold', 'value')}
                      </div>
                    </div>
                  }

                  {!(mode === 'edit' && editChoice === 'edit') &&
                    <div className='relative'>
                      <label className={label('unit_cost')}>Unit cost</label>
                      <input
                        placeholder="Cost"
                        className={`${inputClass('unit_cost')} focus:border-2 focus:border-green-500`}
                        value={unit_cost}
                        onChange={(e) => setPurchasedPrice(e.target.value)}
                      />
                      {errorflag('unit_cost', 'value')}
                    </div>
                  }
                  {!(mode === 'edit' && editChoice === 'edit') &&
                    <div className='relative'>
                      <DatePickerCustom
                        id="date_added"
                        value={date_added}
                        onChange={(e) => setDatePurchased(e.target.value)}
                        label="Enter Date Added"
                        error={emptyField.date_added}
                        placeholder="mm/dd/yyyy"
                        errorMessage={
                          emptyField.date_added ? "Please enter a date!" : null
                        }
                      />
                    </div>
                  }
                </div>

                {/* Right column inputs */}
                <div className="flex flex-col gap-6">
                  {/* If addStocks was chosen, hide product-edit-only fields on the right side */}
                  {!(mode === 'edit' && editChoice === 'addStocks') && (
                    <div className="relative">
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <DropdownCustom
                            value={unit}
                            onChange={(e) => setUnit(sanitizeInput(e.target.value))}
                            label="Unit"
                            error={emptyField.unit}
                            options={[
                              { value: '', label: 'Select Unit' },
                              ...constructionUnits.map(option => ({
                                value: option,
                                label: option
                              }))
                            ]}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!unit || !unit.trim()) return;
                            setShowSellingUnitsEditor(prev => !prev);
                          }}
                          disabled={!unit || !unit.trim()}
                          className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border transition ${sellingUnitToggleButtonClass}`}
                        >
                          <span>Selling Units &amp; Pricing{nonBaseSellingUnitCount > 0 ? ` (${nonBaseSellingUnitCount})` : ''}</span>
                        </button>
                      </div>
                      {errorflag('unit', 'unit')}
                      {sellingUnitErrors.general && !showSellingUnitsEditor && (
                        <p className="mt-1 text-xs text-red-600">{sellingUnitErrors.general}</p>
                      )}
                    </div>
                  )}
                  
                  {!(mode === 'edit' && editChoice === 'edit') &&
                    <div className='relative '>
                      <label className={label('quantity_added')}>Quantity</label>
                      <input
                        type="number"
                        step={unit ? getQuantityStep(unit) : "0.001"}
                        min={unit ? getQuantityStep(unit) : "0.001"}
                        placeholder={unit ? getQuantityPlaceholder(unit) : `${mode === 'add' ? 'Quantity' : 'Add Quantity or Enter 0'}`}
                        className={`${inputClass('quantity_added')} focus:border-2 focus:border-green-500`}
                        value={quantity_added}
                        onChange={(e) => {
                          const value = e.target.value;
                          setQuantity(value);
                          handleThreshold(value, max_threshold);
                        }}
                      />
                      {errorflag('quantity_added', 'value')}
                      {unitValidationError.quantity_added && (
                        <p className="text-red-600 text-xs mt-1">{unitValidationError.quantity_added}</p>
                      )}
                      {maxQuant && <p className='mt-1 text-xs italic text-red-600'>Quantity exceeds the max threshold!</p>}
                    </div>
                  }


                  {!(mode === 'edit' && editChoice === 'addStocks') &&
                    <div className='relative'>
                      <label className={label('unit_price')}>Price</label>
                      <input
                        placeholder="Price"
                        className={`${inputClass('unit_price')} focus:border-2 focus:border-green-500`}
                        value={unit_price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                      {errorflag('unit_price', 'value')}
                    </div>
                  }

                  {/* Selling units editor rendered as overlay when toggled */}

                  {!(mode === 'edit' && editChoice === 'edit') &&
                    <div className='relative'>
                      <DatePickerCustom
                        id="product_validity"
                        value={product_validity}
                        onChange={(e) => setExpirationDate(e.target.value)}
                        label="Enter Product Validity"
                        error={emptyField.product_validity || isExpiredEarly}
                        placeholder="mm/dd/yyyy"
                        errorMessage={
                          emptyField.product_validity
                            ? "Please enter a date!"
                            : isExpiredEarly
                              ? "Expiry date must be after purchase date!"
                              : null
                        }
                      />
                    </div>
                  }

                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button type="submit" disabled={maxQuant} className={`flex items-center gap-3 ${mode === 'edit' ? 'bg-[#007278] hover:bg-[#009097]' : 'bg-[#119200] hover:bg-[#56be48]'} text-white font-semibold rounded-md px-6 py-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed`} >
                  <span>{mode === 'edit' ? 'UPDATE' : 'ADD'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}



export default ModalForm
