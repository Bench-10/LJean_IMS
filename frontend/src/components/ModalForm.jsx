import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdClose } from 'react-icons/io';
import ConfirmationDialog from './dialogs/ConfirmationDialog';
import FormLoading from './common/FormLoading';
import api from '../utils/api';
import { getQuantityStep, validateQuantity, getQuantityPlaceholder } from '../utils/unitConversion';
import DropdownCustom from './DropdownCustom';
import DatePickerCustom from './DatePickerCustom';

function ModalForm({ isModalOpen, OnSubmit, mode, onClose, itemData, listCategories, sanitizeInput }) {
  const { user } = useAuth();

  // Feature flag: hide selling-units UI and price fields from users without deleting code.
  // Set to true to prevent users from accessing selling unit configuration and price input.
  const HIDE_SELLING_UNITS = true;

  // FORM STATE
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
  const [exceedQuantity, setForExceedQuantity] = useState('');
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
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimeoutRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const BATCH_SIZE = 20;
  const overlayRef = useRef(null);

  // Autofocus first field
  const firstFieldRef = useRef(null);

  // Lock background scroll while open
  useEffect(() => {
    if (isModalOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setTimeout(() => firstFieldRef.current?.focus(), 0);
      return () => { document.body.style.overflow = original; };
    }
  }, [isModalOpen]);

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
      ) return false;
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

    if (!sanitizedBaseUnit) return preparedUnits.filter(entry => !entry.is_base);

    const blanks = [];
    const nonBaseUnits = [];

    preparedUnits.forEach(entry => {
      if (!entry) return;
      const identifier = typeof entry.unit === 'string' ? entry.unit.trim() : '';
      if (!identifier) { blanks.push({ ...entry, unit: '' }); return; }
      if (identifier === sanitizedBaseUnit) return;
      if (!nonBaseUnits.find(e => e.unit === identifier)) {
        nonBaseUnits.push({
          unit: identifier,
          unit_price: entry.unit_price,
          base_quantity_per_sell_unit: entry.base_quantity_per_sell_unit,
          is_base: false
        });
      }
    });

    const result = [{
      unit: sanitizedBaseUnit,
      unit_price: basePriceString,
      base_quantity_per_sell_unit: '1',
      is_base: true
    }];

    nonBaseUnits.forEach(entry => result.push({ ...entry }));
    blanks.forEach(entry => result.push({ ...entry, is_base: false }));

    return result;
  }, []);

  const initializeSellingUnits = useCallback((sourceUnits, baseUnitValue, basePriceValue) => {
    const basePriceString = basePriceValue === undefined || basePriceValue === null ? '' : String(basePriceValue);
    const prepared = Array.isArray(sourceUnits)
      ? sourceUnits.map(entry => ({
          unit: typeof entry?.unit === 'string' ? entry.unit.trim() : typeof entry?.sell_unit === 'string' ? entry.sell_unit.trim() : '',
          unit_price: entry?.unit_price == null ? '' : String(entry.unit_price),
          base_quantity_per_sell_unit: entry?.base_quantity_per_sell_unit == null ? '' : String(entry.base_quantity_per_sell_unit),
          is_base: Boolean(entry?.is_base)
        }))
      : [];
    return syncSellingUnitsWithBase(prepared, baseUnitValue, basePriceString);
  }, [syncSellingUnitsWithBase]);

  const computeUnitsPerBase = (entry) => {
    const q = Number(entry?.base_quantity_per_sell_unit);
    if (!Number.isFinite(q) || q <= 0) return '';
    const v = 1 / q;
    if (!Number.isFinite(v) || v <= 0) return '';
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(6).replace(/\.0+$|0+$/,'').replace(/\.$/,'');
  };

  // error states
  const [emptyField, setEmptyField] = useState({});
  const [notANumber, setNotANumber] = useState({});
  const [invalidNumber, setInvalidNumber] = useState({});
  const [isExpiredEarly, setIsExpiredEarly] = useState(false);
  const [unitValidationError, setUnitValidationError] = useState({});

  const [loading, setLoading] = useState(false);
  const [openDialog, setDialog] = useState(false);
  const message = mode === 'add' ? "Are you sure you want to add this?" : "Are you sure you want to edit this?";

  const fetchExistingProducts = async () => {
    try {
      const { data } = await api.get('/api/items/unique');
      setExistingProducts(data);
    } catch (e) {
      console.error('Error fetching existing products:', e);
    }
  };

  // reset on open
  useEffect(() => {
    if (!user) return;
    if (isModalOpen && user?.role?.some(r => ['Inventory Staff'].includes(r))) {
      setInvalidNumber({}); setIsExpiredEarly(false); setEmptyField({});
      setNotANumber({}); setUnitValidationError({});
      setSelectedExistingProduct(null); setSearchTerm(''); setEditChoice(null);

      if (mode === 'add') {
        setItemName(''); setCategory(''); setBranch(user.branch_id);
        setQuantity(0); setPurchasedPrice(''); setDatePurchased('');
        setUnit(''); setMaxThreshold(''); setMinThreshold('');
        setPrice(''); setExpirationDate(''); setMaxQuant(false);
        setForExceedQuantity(''); setDescription('');
        setSellingUnits([]); setSellingUnitErrors({ general: '', entries: {} });
        setShowSellingUnitsEditor(false);
        fetchExistingProducts();
      }

      if (isModalOpen && mode === 'edit' && itemData) {
        setItemName(itemData.product_name);
        setCategory(itemData.category_id);
        setBranch(user.branch_id);
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
        setShowSellingUnitsEditor(false);
      }
    }
  }, [isModalOpen, mode, itemData, user, initializeSellingUnits]);

  useEffect(() => {
    setSellingUnits(prev => {
      const next = syncSellingUnitsWithBase(prev, unit, unit_price);
      return areSellingUnitsEqual(prev, next) ? prev : next;
    });
    if (!unit?.trim()) setShowSellingUnitsEditor(false);
  }, [unit, unit_price, syncSellingUnitsWithBase]);

  useEffect(() => {
    if (HIDE_SELLING_UNITS) return;
    if (!showSellingUnitsEditor) return;
    const onEsc = (e) => { if (e.key === 'Escape') setShowSellingUnitsEditor(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [showSellingUnitsEditor]);

  const constructionUnits = ["pcs","ltr","gal","bag","pairs","roll","set","sheet","kg","m","cu.m","btl","can","bd.ft","meter","pail"];

  const handleSelectExistingProduct = (product) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setSearchFocused(false);
    setShowExistingProducts(false);
    setSelectedExistingProduct(product);
    setItemName(product.product_name);
    setUnit(product.unit);
    setCategory(product.category_id);
    setDescription(product.description);
    setPrice(product.unit_price != null ? String(product.unit_price) : '');
    setSellingUnits(initializeSellingUnits(product.selling_units, product.unit, product.unit_price));
    setSellingUnitErrors({ general: '', entries: {} });
    setShowSellingUnitsEditor(Array.isArray(product.selling_units) && product.selling_units.some(e => !e?.is_base));
  };

  const filteredExistingProducts = existingProducts.filter(p =>
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const nonBaseSellingUnitCount = sellingUnits.filter(e => !e.is_base).length;
  const hasSellingUnitIssues = Boolean(sellingUnitErrors.general) || Object.keys(sellingUnitErrors.entries || {}).length > 0;
  const sellingUnitToggleButtonClass = !unit?.trim()
    ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
    : hasSellingUnitIssues
      ? 'border-red-500 text-red-600 hover:bg-red-50'
      : 'border-green-600 text-green-700 hover:bg-green-50';

  const baseUnitPriceDisplay = (() => {
    const n = Number(unit_price);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  })();

  const getAvailableUnitOptions = useCallback((rowIndex) => {
    const normalizedBase = (unit || '').trim().toLowerCase();
    const current = sellingUnits[rowIndex] || {};
    const currentVal = (current.unit || '').trim();
    const normalizedCurrent = currentVal.toLowerCase();

    const used = new Set();
    sellingUnits.forEach((e, idx) => {
      if (idx === rowIndex) return;
      if (e?.is_base) return;
      const id = (e?.unit || '').trim();
      if (!id) return;
      used.add(id.toLowerCase());
    });

    const dedupe = new Set();
    const options = [];

    if (currentVal && !constructionUnits.some(o => o.toLowerCase() === normalizedCurrent)) {
      options.push({ value: currentVal, label: currentVal });
      dedupe.add(normalizedCurrent);
    }

    constructionUnits.forEach(opt => {
      const n = opt.trim().toLowerCase();
      if (n === normalizedBase) return;
      if (used.has(n) && n !== normalizedCurrent) return;
      if (!dedupe.has(n)) {
        options.push({ value: opt, label: opt });
        dedupe.add(n);
      }
    });

    return options;
  }, [constructionUnits, sellingUnits, unit]);
  const availableUnitsForNewRow = getAvailableUnitOptions(sellingUnits.length);

  const toggleExistingProductsPanel = () => {
    setShowExistingProducts(v => !v);
    if (!showExistingProducts) setSearchTerm('');
  };

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    if (overlayRef.current) overlayRef.current.scrollTop = 0;
  }, [searchTerm, showExistingProducts, existingProducts]);

  const handleThreshold = (quantity, threshold) => {
    if (mode === 'add') setMaxQuant(Number(quantity) > threshold);
    else setMaxQuant(Number(exceedQuantity) + Number(quantity) > threshold);
  };

  const handleAddSellingUnitRow = () => {
    setSellingUnits(prev => ([...prev, { unit: '', unit_price: '', base_quantity_per_sell_unit: '', is_base: false }]));
    setSellingUnitErrors(prev => ({ ...prev, general: '' }));
  };

  const handleSellingUnitFieldChange = (index, field, rawValue) => {
    setSellingUnits(prev => prev.map((entry, idx) => {
      if (idx !== index) return entry;
      const updated = { ...entry };
      let value = rawValue;
      if (field === 'unit') value = typeof value === 'string' ? sanitizeInput(value) : '';
      updated[field] = value === '' ? '' : value;
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

  const handleOverlayScroll = useCallback((e) => {
    const t = e.target;
    const nearBottom = t.scrollTop + t.clientHeight >= t.scrollHeight - 120;
    if (nearBottom && visibleCount < filteredExistingProducts.length) {
      setVisibleCount(v => Math.min(v + BATCH_SIZE, filteredExistingProducts.length));
    }
  }, [visibleCount, filteredExistingProducts.length]);

  const validateInputs = () => {
    const isEmptyField = {};
    const isnotANumber = {};
    const invalidNumberValue = {};
    const unitValidationErrors = {};
    const sellingEntryErrors = {};
    let sellingGeneralError = '';

    if (mode === 'edit' && editChoice === 'addStocks') {
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

    const isExpiryEarly = date_added > product_validity;
    setIsExpiredEarly(isExpiryEarly);

    if (unit && quantity_added && !isNaN(Number(quantity_added))) {
      const validation = validateQuantity(Number(quantity_added), unit);
      if (!validation.valid) unitValidationErrors.quantity_added = validation.error;
    }

    if (!(mode === 'edit' && editChoice === 'addStocks')) {
      const trimmedUnit = (unit || '').trim();
      const hasBase = sellingUnits.some(e => e.is_base && e.unit === trimmedUnit);
      const basePrice = Number(unit_price);

      if (!trimmedUnit) sellingGeneralError = 'Select a base unit before configuring selling units.';
      else if (!hasBase) sellingGeneralError = 'Base unit entry is required in selling units.';
      else if (!Number.isFinite(basePrice) || basePrice <= 0) sellingGeneralError = 'Enter a valid price for the base unit.';

      sellingUnits.forEach((e, index) => {
        const errs = [];
        const id = (e.unit || '').trim();
        const priceN = Number(e.unit_price);
        const baseQtyN = Number(e.base_quantity_per_sell_unit);

        if (!id) errs.push('Unit name is required.');
        if (!Number.isFinite(priceN) || priceN <= 0) errs.push('Price must be greater than 0.');
        if (!Number.isFinite(baseQtyN) || baseQtyN <= 0) errs.push('Conversion value must be greater than 0.');
        if (e.is_base && id !== trimmedUnit) errs.push('Base unit entry must match the selected inventory unit.');
        if (!e.is_base && id === trimmedUnit) errs.push('Non-base entry cannot use the base unit.');

        if (errs.length) sellingEntryErrors[index] = errs;
      });

      if (!sellingGeneralError && Object.keys(sellingEntryErrors).length > 0) {
        sellingGeneralError = 'Fix the selling unit errors before submitting.';
      }
    }

    setEmptyField(isEmptyField);
    setNotANumber(isnotANumber);
    setInvalidNumber(invalidNumberValue);
    setUnitValidationError(unitValidationErrors);
    setSellingUnitErrors({ general: sellingGeneralError, entries: sellingEntryErrors });

    if (Object.keys(isEmptyField).length) return;
    if (Object.keys(isnotANumber).length) return;
    if (Object.keys(invalidNumberValue).length) return;
    if (Object.keys(unitValidationErrors).length) return;
    if (sellingGeneralError) return;
    if (Object.keys(sellingEntryErrors).length) return;
    if (isExpiryEarly) return;

    setDialog(true);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const itemDataPayload = {
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
        selling_units: sellingUnits.map(e => ({
          unit: (e.unit || '').trim(),
          unit_price: Number(e.unit_price),
          base_quantity_per_sell_unit: Number(e.base_quantity_per_sell_unit),
          is_base: Boolean(e.is_base)
        }))
      };

      await OnSubmit(itemDataPayload);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => {
    const hasError = emptyField[field] || notANumber[field] || invalidNumber[field] || (isExpiredEarly && field === 'product_validity');
    return `w-full py-2 px-3 rounded-lg bg-white border ${hasError ? 'border-red-500 ring-1 ring-red-50' : 'border-gray-200'} text-sm placeholder-gray-400 shadow-sm focus:outline-none transition focus:shadow-outline disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${hasError ? 'focus:ring-red-500' : 'focus:ring-indigo-500'}`;
  };
  const label = (field) => `block text-sm font-medium mb-1 ${emptyField[field] ? 'text-red-600' : 'text-gray-600'} ${isExpiredEarly && field === 'product_validity' ? 'text-red-600' : ''}`;
  const errorflag = (field, warn) => {
    if (emptyField[field]) return <p className="mt-1 text-xs text-red-600">{`Please enter a ${warn}!`}</p>;
    if (notANumber[field]) return <p className="mt-1 text-xs text-red-600">Must be a positive number!</p>;
    if (invalidNumber[field]) return <p className="mt-1 text-xs text-red-600">Value must not be less than 1!</p>;
    if (isExpiredEarly && field === 'product_validity') return <p className="mt-1 text-xs text-red-600">Expiry date must be after purchase date!</p>;
    return null;
  };

  return (
    <div>
      {loading && <FormLoading message={mode === 'add' ? "Adding product..." : "Updating product..."} />}

      {openDialog && (
        <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={handleSubmit}
          onClose={() => setDialog(false)}
        />
      )}

      {/* edit action chooser */}
      {isModalOpen && mode === 'edit' && !editChoice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 shadow-2xl w-full max-w-md sm:max-w-lg">
            <h4 className="font-semibold text-xl sm:text-2xl mb-6 text-center">Choose an action</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button type="button" onClick={() => setEditChoice('edit')} className="p-4 border border-gray-100 rounded-lg hover:shadow-md text-left transition">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828l-9.9 9.9a1 1 0 01-.464.263l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.263-.464l9.9-9.9a2 2 0 012.828 0z" /></svg>
                  <span className="font-medium">Edit Product Data</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Change product attributes such as unit, price, thresholds and description.</p>
              </button>
              <button type="button" onClick={() => setEditChoice('addStocks')} className="p-4 border border-gray-100 rounded-lg hover:shadow-md text-left transition">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                  <span className="font-medium">Add Stocks</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Quickly add stock quantity and cost without changing other product details.</p>
              </button>
            </div>
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => { onClose(); setEditChoice(null); setShowExistingProducts(false); setMaxQuant(false); setShowSellingUnitsEditor(false); }}
                className="text-sm text-gray-600 px-5 py-2 rounded-md border hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* overlay */}
      {isModalOpen && user?.role?.some(r => ['Inventory Staff'].includes(r)) && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }}
          onClick={() => { onClose(); setMaxQuant(false); setShowSellingUnitsEditor(false); }}
        />
      )}

      {/* dialog */}
      <dialog
        className="bg-transparent fixed inset-0 z-[200]"
        open={mode === 'edit'
          ? isModalOpen && user && editChoice && user.role?.some(r => ['Inventory Staff'].includes(r))
          : isModalOpen && user && user.role?.some(r => ['Inventory Staff'].includes(r))}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-modal-title"
      >
        <div
          className="relative bg-white w-[96vw] sm:w-[92vw] md:w-[880px] max-w-[92vw] md:max-w-[880px]
                     rounded-xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Selling Units editor (kept as-is) */}
          {!HIDE_SELLING_UNITS && showSellingUnitsEditor && (
  <div
    className="fixed inset-0 z-[400] bg-black/30 backdrop-blur-[2px]"
    onClick={() => setShowSellingUnitsEditor(false)}
    role="dialog"
    aria-modal="true"
    aria-labelledby="selling-units-title"
  >
    {/* center the panel; stop backdrop close when clicking inside */}
    <div className="absolute inset-0 p-3 sm:p-6 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      {/* PANEL: fixed height, flex column so header stays while body scrolls */}
      <div className="relative w-full max-w-4xl h-[min(86vh,720px)] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col">
        {/* sticky header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 rounded-lg border-b sticky top-0 bg-white z-20 ">
          <div>
            <h4 id="selling-units-title" className="text-lg font-semibold text-gray-800">
              Selling Units &amp; Pricing
            </h4>
            <p className="text-sm text-gray-600 max-w-xl">
              Configure alternate selling units, their prices, and conversions relative to the base inventory unit.
            </p>
          </div>
          <button
  type="button"
  className="w-9 h-9 flex items-center justify-center rounded-lg  text-gray-600 hover:text-gray-800 hover:bg-gray-50"
  onClick={() => setShowSellingUnitsEditor(false)}
  aria-label="Close selling units editor"
>
  <IoMdClose className="w-5 h-5 sm:w-6 sm:h-6" />
</button>
        </div>

        {/* BODY: scrolls, panel height stays fixed */}
        <div className="flex-1 overflow-y-auto px-5 py-4 modal-scroll hide-scrollbar">
          {/* base unit row */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-600">Base unit</label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[160px]">
                  <input
                    type="text"
                    className="w-full border rounded-sm px-3 py-2 bg-gray-50 text-gray-800 font-semibold cursor-not-allowed"
                    value={unit || ''}
                    readOnly
                  />
                </div>
                <div className="w-40 min-w-[140px]">
                  <div className="w-full text-sm text-gray-700 bg-gray-50 border rounded-sm px-3 py-2 font-semibold cursor-not-allowed">
                    {baseUnitPriceDisplay || '—'}
                  </div>
                </div>
                <div className="w-40 min-w-[140px] text-sm bg-gray-50 text-gray-600 font-semibold border rounded-sm px-3 py-2">
                  Base qty: 1
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Base unit follows the selected inventory unit and its price is the base price.
              </p>
            </div>

            <div className="sm:col-span-1 flex sm:items-end justify-end">
              <button
                type="button"
                onClick={handleAddSellingUnitRow}
                className="px-3 py-2 w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!unit?.trim() || availableUnitsForNewRow.length === 0}
              >
                <span className="text-lg leading-none">+</span>
                <span>Add Selling Unit</span>
              </button>
            </div>
          </div>

          {/* table wrapper: x-scroll only; y stays visible so dropdowns won't get clipped */}
          <div className="relative mt-2 rounded-lg border border-gray-200">
            <div className="h-[50vh] overflow-x-auto overflow-y-visible hide-scrollbar">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap min-w-[160px]">Unit</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap min-w-[140px]">Unit Price</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap min-w-[180px]">Base Qty</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap min-w-[180px]">Units per Base</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap min-w-[120px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sellingUnits.filter((s) => !s.is_base).length === 0 ? (
                    <tr>
                      <td className="px-3 py-5 text-center text-gray-500" colSpan={5}>
                        No selling units configured yet.
                      </td>
                    </tr>
                  ) : (
                    sellingUnits.map((entry, index) => {
                      if (entry.is_base) return null;
                      const unitsPerBase = computeUnitsPerBase(entry);
                      return (
                        <tr key={`${entry.unit || 'unit'}-${index}`} className="align-top">
                          <td className="px-3 py-2">
                            {/* Give dropdown a higher stacking context + portal props to avoid clipping */}
                            <div className="w-full relative">
                              <DropdownCustom
                                value={entry.unit || ''}
                                onChange={(e) => handleSellingUnitFieldChange(index, 'unit', e.target?.value ?? e)}
                                variant="default"
                                options={[
                                  { value: '', label: 'Select unit' },
                                  ...getAvailableUnitOptions(index),
                                ]}
                                /* If DropdownCustom wraps react-select or supports portals, these help: */
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                menuPlacement="auto"
                                /* Optional style bump for portal menu z-index */
                                styles={{
                                  menuPortal: (base) => ({ ...base, zIndex: 1000 }),
                                  menu: (base) => ({ ...base, zIndex: 1000 }),
                                }}
                              />
                            </div>
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full border rounded-md px-3 py-2"
                              value={entry.unit_price}
                              onChange={(e) => handleSellingUnitFieldChange(index, 'unit_price', e.target.value)}
                              inputMode="decimal"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.000001"
                              className="w-full border rounded-md px-3 py-2"
                              value={entry.base_quantity_per_sell_unit}
                              onChange={(e) =>
                                handleSellingUnitFieldChange(index, 'base_quantity_per_sell_unit', e.target.value)
                              }
                              inputMode="decimal"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                              Amount of base unit per {entry.unit || 'sell unit'}.
                            </p>
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="text"
                              className="w-full border rounded-md px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                              value={unitsPerBase}
                              readOnly
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                              Number of units per <span className="font-semibold">{unit}</span>.
                            </p>
                          </td>

                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              className="text-xs px-3 py-2 text-white font-medium rounded bg-green-600 hover:bg-green-500"
                              onClick={() => handleRemoveSellingUnitRow(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* errors */}
          {sellingUnitErrors.general && (
            <p className="mt-3 text-xs text-red-600">{sellingUnitErrors.general}</p>
          )}
          {sellingUnits.map((_, idx) =>
            sellingUnitErrors.entries[idx]?.length ? (
              <ul key={`selling-unit-errors-${idx}`} className="mt-1 text-[11px] text-red-600 list-disc list-inside">
                {sellingUnitErrors.entries[idx].map((m, i) => (
                  <li key={`entry-${idx}-err-${i}`}>{m}</li>
                ))}
              </ul>
            ) : null
          )}
        </div>
      </div>
    </div>
  </div>
)}



          {/* HEADER (fixed) */}
          <div className="shrink-0 sticky top-0 z-20 bg-white px-4 sm:px-6 md:pl-10 md:pr-6 pt-4 pb-3 border-b">
  <div className="relative">
    {/* Title + back */}
    <div className="flex items-center gap-3">
      {mode === 'edit' && editChoice && (
        <button
          type="button"
          onClick={() => { setEditChoice(null); setShowExistingProducts(false); }}
          className="text-sm text-gray-700 hover:text-gray-900 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
        >
          ← Back
        </button>
      )}
      <div>
        <h3 id="inventory-modal-title" className="text-xl sm:text-2xl font-bold">
          {mode === 'edit' ? 'EDIT ITEM' : 'ADD NEW ITEM'}
        </h3>
        <p className="text-sm opacity-90">
          {mode === 'edit' ? 'Modify product details or add stock' : 'Create a new product in inventory'}
        </p>
      </div>
    </div>

    {/* Close button — nudged toward the very top-right */}
    <button
  type="button"
  aria-label="Close"
  onClick={() => {
    onClose();
    setShowExistingProducts(false);
    setMaxQuant(false);
    setShowSellingUnitsEditor(false);
  }}
  className="absolute w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-gray-100
             "
  style={{ top: 2, right: 1 }}
>
  <IoMdClose className="w-5 h-5 sm:w-6 sm:h-6" />
</button>

  </div>
</div>


          {/* BODY (scrollable) */}
          <div className="grow min-h-0 overflow-y-auto px-4 sm:px-6 md:px-10 py-4 sm:py-6 hide-scrollbar">
            <form id="modal-form" onSubmit={(e) => { e.preventDefault(); validateInputs(); }}>
              {/* PRODUCT NAME + BROWSE */}
              <div className="relative mb-4">
                <label className={label('product_name')}>Product name</label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" /></svg>
                    </span>
                    <input
                      id="item"
                      ref={firstFieldRef}
                      type="text"
                      placeholder="Item Name"
                      autoComplete="off"
                      className={`${inputClass('product_name')} pl-10 ${selectedExistingProduct ? 'border-green-400 bg-green-50' : ''}`}
                      value={product_name}
                      onFocus={() => {
                        if (blurTimeoutRef.current) {
                          clearTimeout(blurTimeoutRef.current);
                          blurTimeoutRef.current = null;
                        }
                        setSearchFocused(true);
                        setShowExistingProducts(Boolean(product_name && product_name.trim()));
                      }}
                      onBlur={() => {
                        // delay hiding to allow clicks inside the overlay
                        blurTimeoutRef.current = setTimeout(() => {
                          setSearchFocused(false);
                          setShowExistingProducts(false);
                          blurTimeoutRef.current = null;
                        }, 150);
                      }}
                      onChange={(e) => {
                        const v = sanitizeInput(e.target.value);
                        // keep typed value as the primary product name
                        setItemName(v);
                        // update search term used for filtering suggestions
                        setSearchTerm(v);
                        // only mark suggestions available; visibility depends on focus
                        setShowExistingProducts(Boolean(v && v.trim()));
                        // if user had previously selected an existing product, clear it when they edit
                        if (selectedExistingProduct && v !== (selectedExistingProduct.product_name || '')) {
                          setSelectedExistingProduct(null);
                        }
                      }}
                      disabled={selectedExistingProduct || mode === 'edit'}
                    />
                  </div>
                  {/* Suggestions now appear automatically as the user types; manual Browse button removed */}
                </div>

                {selectedExistingProduct && (
                  <div className="mt-2 inline-flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-full px-3 py-1 text-sm">
                    <span className="font-medium">{selectedExistingProduct.product_name}</span>
                    <button
                      type="button"
                      onClick={() => { setDescription(''); setSelectedExistingProduct(null); setItemName(''); setUnit(''); setCategory(''); }}
                      className="ml-2 text-sm text-green-700 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {errorflag('product_name', 'product name')}

                {/* EXISTING PRODUCTS OVERLAY */}
                {mode === 'add' && showExistingProducts && searchFocused && (
                  <div
                    ref={overlayRef}
                    onScroll={handleOverlayScroll}
                    onMouseDown={() => {
                      // prevent input blur from hiding the overlay when interacting with it
                      if (blurTimeoutRef.current) {
                        clearTimeout(blurTimeoutRef.current);
                        blurTimeoutRef.current = null;
                      }
                      setSearchFocused(true);
                    }}
                    className="absolute left-0 top-full mt-2 border border-gray-300 rounded-md p-3 sm:p-4 bg-white max-h-[50vh] sm:max-h-96 overflow-y-auto w-full shadow-lg z-20 hide-scrollbar"
                  >
                    {/* Search is driven by the main product name input; inline search removed to avoid duplication */}

                    <div className="space-y-2">
                      {filteredExistingProducts.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">
                          {searchTerm ? 'No products found matching your search' : 'No existing products available'}
                        </p>
                      ) : (
                        filteredExistingProducts.slice(0, visibleCount).map((product) => (
                          <div
                            key={product.product_id}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectExistingProduct(product); }}
                            className="p-3 sm:p-4 border border-gray-100 rounded-lg cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-sm">{product.product_name}</div>
                                <div className="text-xs text-gray-500">{product.category_name} • {product.unit}</div>
                              </div>
                              <div className="text-xs text-gray-400">ID: {product.product_id}</div>
                            </div>
                            <div className="mt-1 sm:mt-2 text-xs text-gray-400">Available in: {product.branches}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* DESCRIPTION */}
              {!(mode === 'edit' && editChoice === 'addStocks') && (
                <div className="mb-4">
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

              {/* GRID */}
              {/* GRID — desktop matches screenshot, mobile in your custom order */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-4">
  {/* Category — LEFT (row 1) */}
  {!(mode === 'edit' && editChoice === 'addStocks') && (
    <div className="md:col-start-1">
      <DropdownCustom
        value={category_id}
        onChange={(e) => setCategory(e.target.value)}
        label="Category"
        variant="simple"
        error={emptyField.category_id}
        options={[
          { value: '', label: 'Select Category' },
          ...listCategories.map(o => ({ value: o.category_id, label: o.category_name }))
        ]}
      />
      {errorflag('category_id', 'category')}
    </div>
  )}

  {/* Unit (+ Selling Units button) — RIGHT (row 1) */}
  {!(mode === 'edit' && editChoice === 'addStocks') && (
    <div className="md:col-start-2">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
        <div className="flex-1">
          <DropdownCustom
            value={unit}
            onChange={(e) => setUnit(sanitizeInput(e.target.value))}
            label="Unit"
            error={emptyField.unit}
            options={[
              { value: '', label: 'Select Unit' },
              ...constructionUnits.map(u => ({ value: u, label: u }))
            ]}
          />
        </div>
        {!HIDE_SELLING_UNITS && (
          <button
            type="button"
            onClick={() => { if (!unit?.trim()) return; setShowSellingUnitsEditor(p => !p); }}
            disabled={!unit?.trim()}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border transition ${sellingUnitToggleButtonClass}`}
          >
            <span>
              Selling Units &amp; Pricing
              {sellingUnits.filter(s => !s.is_base).length ? ` (${sellingUnits.filter(s => !s.is_base).length})` : ''}
            </span>
          </button>
        )}
      </div>
      {errorflag('unit', 'unit')}
      {!HIDE_SELLING_UNITS && sellingUnitErrors.general && !showSellingUnitsEditor && (
        <p className="mt-1 text-xs text-red-600">{sellingUnitErrors.general}</p>
      )}
    </div>
  )}

  {/* Min + Max thresholds — LEFT (row 2, two-up inside left column) */}
  {!(mode === 'edit' && editChoice === 'addStocks') && (
    <div className="md:col-start-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label('min_threshold')}>Min threshold</label>
          <input
            placeholder="Min Threshold"
            className={`${inputClass('min_threshold')} focus:border-2 focus:border-green-500`}
            value={min_threshold}
            onChange={(e) => setMinThreshold(e.target.value)}
            inputMode="decimal"
          />
          {errorflag('min_threshold', 'value')}
        </div>
        <div>
          <label className={label('max_threshold')}>Max threshold</label>
          <input
            placeholder="Max Threshold"
            className={`${inputClass('max_threshold')} focus:border-2 focus:border-green-500`}
            value={max_threshold}
            onChange={(e) => { const v = e.target.value; setMaxThreshold(v); handleThreshold(quantity_added, v); }}
            inputMode="decimal"
          />
          {errorflag('max_threshold', 'value')}
        </div>
      </div>
    </div>
  )}

  {/* Quantity — RIGHT (row 2) */}
  {!(mode === 'edit' && editChoice === 'edit') && (
    <div className="md:col-start-2">
      <label className={label('quantity_added')}>Quantity</label>
      <input
        type="number"
        step={unit ? getQuantityStep(unit) : "0.001"}
        min={unit ? getQuantityStep(unit) : "0.001"}
        placeholder={unit ? getQuantityPlaceholder(unit) : `${mode === 'add' ? 'Quantity' : 'Add Quantity or Enter 0'}`}
        className={`${inputClass('quantity_added')} focus:border-2 focus:border-green-500`}
        value={quantity_added}
        onChange={(e) => { const v = e.target.value; setQuantity(v); handleThreshold(v, max_threshold); }}
        inputMode="decimal"
      />
      {errorflag('quantity_added', 'value')}
      {unitValidationError.quantity_added && <p className="text-red-600 text-xs mt-1">{unitValidationError.quantity_added}</p>}
      {maxQuant && <p className="mt-1 text-xs italic text-red-600">Quantity exceeds the max threshold!</p>}
    </div>
  )}

  {/* Unit cost — LEFT (row 3) */}
  {!(mode === 'edit' && editChoice === 'edit') && (
    <div className="md:col-start-1">
      <label className={label('unit_cost')}>Unit cost</label>
      <input
        placeholder="Cost"
        className={`${inputClass('unit_cost')} focus:border-2 focus:border-green-500`}
        value={unit_cost}
        onChange={(e) => setPurchasedPrice(e.target.value)}
        inputMode="decimal"
      />
      {errorflag('unit_cost', 'value')}
    </div>
  )}

  {/* Price — RIGHT (row 3) */}
  {!(mode === 'edit' && editChoice === 'addStocks') && (
    <div className="md:col-start-2">
      <label className={label('unit_price')}>Price</label>
      <input
        placeholder="Price"
        className={`${inputClass('unit_price')} focus:border-2 focus:border-green-500`}
        value={unit_price}
        onChange={(e) => setPrice(e.target.value)}
        inputMode="decimal"
      />
      {errorflag('unit_price', 'value')}
    </div>
  )}

  {/* Date Added — LEFT (row 4) */}
  {!(mode === 'edit' && editChoice === 'edit') && (
    <div className="md:col-start-1">
      <DatePickerCustom
        id="date_added"
        value={date_added}
        onChange={(e) => setDatePurchased(e.target.value)}
        label="Enter Date Added"
        error={emptyField.date_added}
        placeholder="mm/dd/yyyy"
        errorMessage={emptyField.date_added ? "Please enter a date!" : null}
      />
    </div>
  )}

  {/* Product Validity — RIGHT (row 4) */}
  {!(mode === 'edit' && editChoice === 'edit') && (
    <div className="md:col-start-2">
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
  )}
</div>

            </form>
          </div>

          {/* FOOTER (fixed, outside scroll) */}
          <div className="shrink-0 bg-white px-4 sm:px-6 md:px-10 py-3 border-t">
            <div className="flex justify-center">
              <button
                type="submit"
                form="modal-form"
                disabled={maxQuant}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-3 ${mode === 'edit' ? 'bg-[#007278] hover:bg-[#009097]' : 'bg-[#119200] hover:bg-[#56be48]'} text-white font-semibold rounded-md px-6 py-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span>{mode === 'edit' ? 'UPDATE' : 'ADD'}</span>
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}

export default ModalForm;
