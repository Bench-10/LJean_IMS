import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../authentication/Authentication';
import { IoMdAdd } from "react-icons/io";
import toTwoDecimals from '../utils/fixedDecimalPlaces.js';
import { currencyFormat } from '../utils/formatCurrency.js';
import ConfirmationDialog from './dialogs/ConfirmationDialog.jsx';
import FormLoading from './common/FormLoading';
import dayjs from 'dayjs';
import api from '../utils/api.js';
import {
  getQuantityStep,
  validateQuantity,
  getQuantityPlaceholder,
  allowsFractional
} from '../utils/unitConversion';
import { IoMdClose } from "react-icons/io";



function AddSaleModalForm({ openSaleModal, setOpenSaleModal, productsData, setSaleHeader, fetchProductsData }) {


  const { user } = useAuth();

  let productsToSell = productsData;

  //THIS PREVENTS USER WITH COMBINE ROLES OF MANAGER AND SALES ASSOCIATE TO SELL PRODUCTS FROM ALL BRANCHES
  if (user && user.role && user.role.some(role => ['Branch Manager'].includes(role))) {

    productsToSell = productsData.filter(product => product.branch_id === user.branch_id);

  }


  const dateToday = dayjs().format("YYYY-MM-DD");
  const dateTodayReadable = dayjs().format("MMMM D, YYYY");


  //HEADER INFORMATION
  const [chargeTo, setChargeTo] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(dateToday);

  // NEW: Delivery indicator
  const [isForDelivery, setIsForDelivery] = useState(false);





  //FOR DIALOG
  const [openDialog, setDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('');

  // LOADING STATE
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    setDate(dateToday)
  }, [openSaleModal]);


  const getSellingUnitsForProduct = (product) => {
    if (!product) return [];

    const parsedUnits = Array.isArray(product.selling_units)
      ? product.selling_units.reduce((acc, entry) => {
          const unitLabel = typeof entry?.unit === 'string' ? entry.unit.trim() : '';
          if (!unitLabel) return acc;

          const price = Number(entry.unit_price);
          const baseQuantity = Number(entry.base_quantity_per_sell_unit);

          if (!Number.isFinite(price) || price <= 0) return acc;
          if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return acc;

          acc.push({
            unit: unitLabel,
            unit_price: price,
            base_quantity_per_sell_unit: baseQuantity,
            units_per_base: Number(entry.units_per_base) || null,
            is_base: Boolean(entry.is_base)
          });
          return acc;
        }, [])
      : [];

    if (parsedUnits.length > 0) {
      return parsedUnits.sort((a, b) => {
        if (a.is_base === b.is_base) {
          return a.unit.localeCompare(b.unit);
        }
        return a.is_base ? -1 : 1;
      });
    }

    const fallbackUnit = typeof product.unit === 'string' ? product.unit.trim() : '';
    const fallbackPrice = Number(product.unit_price);

    if (!fallbackUnit || !Number.isFinite(fallbackPrice) || fallbackPrice <= 0) {
      return [];
    }

    return [{
      unit: fallbackUnit,
      unit_price: fallbackPrice,
      base_quantity_per_sell_unit: 1,
      units_per_base: 1,
      is_base: true
    }];
  };


  const getSelectedUnitConfig = (row, product) => {
    if (!row) return null;
    const sellingUnits = Array.isArray(row.sellingUnits) && row.sellingUnits.length > 0
      ? row.sellingUnits
      : getSellingUnitsForProduct(product);

    if (!sellingUnits || sellingUnits.length === 0) {
      return null;
    }

    const matched = sellingUnits.find(entry => entry.unit === row.unit);
    if (matched) {
      return matched;
    }

    return sellingUnits.find(entry => entry.is_base) || sellingUnits[0];
  };

  const createEmptySaleRow = () => ({
    product_id: '',
    quantity: '',
    unit: '',
    unitPrice: 0,
    amount: 0,
    sellingUnits: [],
    baseQuantityPerSellUnit: 1
  });


  //PRODUCT INPUT INFORMATION
  const [productSelected, setProductSelected] = useState([]);
  const [rows, setRows] = React.useState([
    createEmptySaleRow()
  ]);




  //CALCULATING AMOUNT AND VAT
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [vat, setVat] = useState(0);
  const [amountNetVat, setAmount] = useState(0);
  const [totalAmountDue, setTotalAmountDue] = useState(0);


  //FOR SEARCHABLE DROPDOWN
  const [searchTerms, setSearchTerms] = useState({});
  const [showDropdowns, setShowDropdowns] = useState({});


  //SEARCH TERM ERROR HANDLING
  const [someEmpy, setSomeEmpty] = useState(false);
  const [emptyQuantity, setEmptyQuantiy] = useState(false);
  const [quantityValidationErrors, setQuantityValidationErrors] = useState({});


  //QUANTITY VALIDATION
  const [exceedQuanity, setExceedQuanity] = useState([]);



  //TO RESET THE FORM ONCE CLOSED
  const closeModal = () => {
    setOpenSaleModal(false);

    setRows([createEmptySaleRow()]);
    setProductSelected([]);
    setAmount(0);
    setTotalAmountDue(0);
    setChargeTo('');
    setTin('');
    setAddress('');
    setDate('');
    setVat(0);
    setSearchTerms({});
    setShowDropdowns({});
    setEmptyQuantiy(false);
    setSomeEmpty(false);
    setExceedQuanity([]);
    setQuantityValidationErrors({});
    setAdditionalDiscount(0);
    setDeliveryFee(0);
    setIsForDelivery(false);


  };


  //MULTIPLY THE AMOUNT BY THE PRODUCT'S UNIT PRICE
  const createAnAmount = (index, sourceRows = rows) =>{

    const currentRows = Array.isArray(sourceRows) ? [...sourceRows] : [...rows];
    const currentRow = { ...currentRows[index] };
    const currentId = currentRow.product_id;
    const currentKey = currentId !== undefined && currentId !== null ? String(currentId) : null;

    const product = productsToSell.find(p => p.product_id === currentId);
    if (!product) {
      currentRows[index] = currentRow;
      preventEmptyQuantity(currentRows);
      totalAmount(currentRows);
      setRows(currentRows);
      return;
    }

    const selectedUnitConfig = getSelectedUnitConfig(currentRow, product);
    if (!currentRow.unit && selectedUnitConfig?.unit) {
      currentRow.unit = selectedUnitConfig.unit;
    }
    const resolvedUnitPrice = Number(selectedUnitConfig?.unit_price ?? currentRow.unitPrice ?? 0);
    const resolvedBaseQuantity = Number(selectedUnitConfig?.base_quantity_per_sell_unit ?? currentRow.baseQuantityPerSellUnit ?? 1);

    currentRow.sellingUnits = Array.isArray(currentRow.sellingUnits) && currentRow.sellingUnits.length > 0
      ? currentRow.sellingUnits
      : getSellingUnitsForProduct(product);
    currentRow.unitPrice = Number.isFinite(resolvedUnitPrice) && resolvedUnitPrice > 0 ? resolvedUnitPrice : 0;
    currentRow.baseQuantityPerSellUnit = Number.isFinite(resolvedBaseQuantity) && resolvedBaseQuantity > 0 ? resolvedBaseQuantity : 1;

    const currentQuantity = Number(currentRow.quantity) || 0;
    const unit = currentRow.unit;

    // Validate quantity for unit
    if (unit && currentQuantity > 0) {
      const validation = validateQuantity(currentQuantity, unit);
      if (!validation.valid) {
        setQuantityValidationErrors(prev => ({
          ...prev,
          [index]: validation.error
        }));

        currentRow.amount = 0;
        currentRows[index] = currentRow;
        preventEmptyQuantity(currentRows);
        totalAmount(currentRows);
        setRows(currentRows);
        return;
      } else {
        setQuantityValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      }
    } else {
      setQuantityValidationErrors(prev => {
        if (!prev[index]) return prev;
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }

    const availableInventoryDisplay = Number(product.quantity) || 0;
    const availableSaleQuantity = currentRow.baseQuantityPerSellUnit > 0
      ? availableInventoryDisplay / currentRow.baseQuantityPerSellUnit
      : availableInventoryDisplay;
    const tolerance = 1e-9;

    if (currentKey && currentQuantity > 0 && currentQuantity - availableSaleQuantity > tolerance) {
      setExceedQuanity(prev => prev.includes(currentKey) ? prev : [...prev, currentKey]);
    } else if (currentKey) {
      setExceedQuanity(prev => prev.includes(currentKey) ? prev.filter(q => q !== currentKey) : prev);
    }

    const productAmount = Number((currentQuantity * currentRow.unitPrice).toFixed(2));
    currentRow.amount = Number.isFinite(productAmount) ? productAmount : 0;

    currentRows[index] = currentRow;

    preventEmptyQuantity(currentRows);
    totalAmount(currentRows);
    setRows(currentRows);

  };


  //DISABLE BUTTON IF THERE ARE QUANTITY FEILDS THAT ARE CURRENTLY EMPTY
  const preventEmptyQuantity = (updatedRows) => {

    if (!updatedRows) {
      setEmptyQuantiy(false);

      return
    };

    const emptyQuantity = updatedRows.some(row => !row.product_id || row.product_id === '' || !row.quantity || Number(row.quantity) === 0)

    setEmptyQuantiy(emptyQuantity);

  };


  //ADDS ALL THE AMOUNT OF ALL THE PRODUCTS PRESENT IN THE SALE
  const totalAmount = (newData) => {

    const final = newData.reduce((sum, product) => {
      const value = Number(product.amount);
      return sum + (isNaN(value) ? 0 : value);

    }, 0);

    setAmount(final);
    vatAmount(final)

  };


  //CALCULATES THE VAT AND TOTAL AMOUNT
  const vatAmount = (amount) => {
    const vatCalculated = amount * 0.12;
    setVat(vatCalculated);


    calculateTotalAmount(amount, vatCalculated, additionalDiscount, deliveryFee);
  };

  //CENTRALIZED TOTAL CALCULATION
  const calculateTotalAmount = (netAmount, vatAmount, discount, delivery) => {
    const total = (netAmount + vatAmount + delivery) - discount;
    setTotalAmountDue(Math.max(0, total));
  };

  //HANDLE DISCOUNT CHANGE
  const handleDiscountChange = (discountAmount) => {
    setAdditionalDiscount(discountAmount);
    calculateTotalAmount(amountNetVat, vat, discountAmount, deliveryFee);
  };

  //HANDLE DELIVERY FEE CHANGE
  const handleDeliveryFeeChange = (feeAmount) => {
    setDeliveryFee(feeAmount);
    calculateTotalAmount(amountNetVat, vat, additionalDiscount, feeAmount);
  };


  //REMOVES THE SPECIFIC ROW
  const removeSaleRow = (index) => {

    const removedRow = rows[index];
  const removedProductId = removedRow?.product_id;
  const removedProductKey = removedProductId !== undefined && removedProductId !== null ? String(removedProductId) : null;
    const newRows = rows.filter((_, i) => i !== index);


    const newProductSelected = {};
    Object.keys(productSelected).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {

        newProductSelected[keyIndex] = productSelected[keyIndex];
      } else if (keyIndex > index) {

        newProductSelected[keyIndex - 1] = productSelected[keyIndex];
      }

    });


    const newSearchTerms = {};
    Object.keys(searchTerms).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {

        newSearchTerms[keyIndex] = searchTerms[keyIndex];
      } else if (keyIndex > index) {

        newSearchTerms[keyIndex - 1] = searchTerms[keyIndex];
      }

    });


    const newValidationErrors = {};
    Object.keys(quantityValidationErrors).forEach(key => {
      const keyIndex = parseInt(key);
      if (keyIndex < index) {
        newValidationErrors[keyIndex] = quantityValidationErrors[keyIndex];
      } else if (keyIndex > index) {
        newValidationErrors[keyIndex - 1] = quantityValidationErrors[keyIndex];
      }
    });


    setProductSelected(newProductSelected);
    setSearchTerms(newSearchTerms);
    setQuantityValidationErrors(newValidationErrors);
    setRows(newRows);
    totalAmount(newRows);
    preventEmptyQuantity(newRows);

    if (removedProductKey) {
      setExceedQuanity(prev => prev.filter(id => id !== removedProductKey));
    }

  };


  //HANDLES SEARCH INPUT FOR DROPDOWN
  const handleSearchChange = (index, value) => {
    setSearchTerms(prev => ({
      ...prev,
      [index]: value
    }));
    setShowDropdowns(prev => ({
      ...prev,
      [index]: true
    }));


  };
  // Stores references to each input field (for focusing or validation)
  const inputRefs = useRef([]);

  const rowRefs = useRef([]); // store references to each row
  const desktopScrollRef = useRef(null); // Reference to the desktop scrollable container
  const mobileScrollRef = useRef(null); // Reference to the mobile scrollable container

  // Handles adding a new product row and auto-scrolls to the latest row
  const handleAddRow = () => {
    setRows(prevRows => {
      const updatedRows = [
        ...prevRows,
        { product_id: '', quantity: 0, unit: '', unitPrice: 0, amount: 0 },
      ];

      preventEmptyQuantity(updatedRows);

      // Wait for React to actually render the new row first
      // Wait for render
      setTimeout(() => {
        const container =
          window.innerWidth >= 1024
            ? desktopScrollRef.current
            : mobileScrollRef.current;

        if (container) {
          // Always scroll to the very bottom smoothly
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 150); // small delay ensures layout is updated

      return updatedRows; // ⏱ Slightly longer delay ensures DOM updated

      return updatedRows;
    });
  };

  const handleEmptysearchterm = () => {

    const anyEmpty = Object.values(searchTerms).some(val => !val || val.trim() === "");
    setSomeEmpty(anyEmpty);

  };

  useEffect(() => {
    handleEmptysearchterm();

  }, [searchTerms]);


  //HANDLES PRODUCT SELECTION FROM DROPDOWN
  const selectProduct = (index, product) => {
    const sellingUnits = getSellingUnitsForProduct(product);
    const defaultUnitConfig = sellingUnits.find(entry => entry.is_base) || sellingUnits[0] || null;
    const defaultUnit = defaultUnitConfig?.unit || '';
    const defaultPrice = Number(defaultUnitConfig?.unit_price ?? product.unit_price ?? 0);
    const defaultBaseQty = Number(defaultUnitConfig?.base_quantity_per_sell_unit ?? 1) || 1;

    const newRows = [...rows];
    newRows[index] = {
      ...newRows[index],
      product_id: product.product_id,
      quantity: '',
      unit: defaultUnit,
      unitPrice: Number.isFinite(defaultPrice) ? defaultPrice : 0,
      amount: 0,
      sellingUnits,
      baseQuantityPerSellUnit: defaultBaseQty
    };

    preventEmptyQuantity(newRows);
    totalAmount(newRows);
    setRows(newRows);
    
    setProductSelected(prev => ({
      ...prev,
      [index]: String(product.product_id)
    }));

    setSearchTerms(prev => ({
      ...prev,
      [index]: product.product_name
    }));

    setShowDropdowns(prev => ({
      ...prev,
      [index]: false
    }));

  const productKey = String(product.product_id);
  setExceedQuanity(prev => prev.filter(id => id !== productKey));
    setQuantityValidationErrors(prev => {
      if (!prev[index]) return prev;
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  };


  const handleUnitChange = (index, unitValue) => {
    const currentRow = rows[index];
    if (!currentRow) return;

    const product = productsToSell.find(p => p.product_id === currentRow.product_id);
    const sellingUnits = Array.isArray(currentRow.sellingUnits) && currentRow.sellingUnits.length > 0
      ? currentRow.sellingUnits
      : getSellingUnitsForProduct(product);

    const unitConfig = sellingUnits.find(entry => entry.unit === unitValue) || null;
    const resolvedPrice = Number(unitConfig?.unit_price ?? currentRow.unitPrice ?? 0);
    const resolvedBaseQuantity = Number(unitConfig?.base_quantity_per_sell_unit ?? currentRow.baseQuantityPerSellUnit ?? 1);

    const newRows = [...rows];
    newRows[index] = {
      ...currentRow,
      unit: unitValue,
      unitPrice: Number.isFinite(resolvedPrice) && resolvedPrice > 0 ? resolvedPrice : 0,
      baseQuantityPerSellUnit: Number.isFinite(resolvedBaseQuantity) && resolvedBaseQuantity > 0 ? resolvedBaseQuantity : 1,
      sellingUnits
    };

    createAnAmount(index, newRows);
  };


  //FILTERS PRODUCTS BASED ON SEARCH TERM
  const getFilteredProducts = (index) => {
    const searchTerm = searchTerms[index] || '';
    return productsToSell.filter(product => {
      const isNotSelected = !Object.values(productSelected).includes(String(product.product_id)) ||
        String(rows[index].product_id) === String(product.product_id);
      const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      return isNotSelected && matchesSearch;
    });
  };


  //SUBMIT THE DATA
  const submitSale = async () => {
    try {
      setLoading(true);

      const headerInformationAndTotal = {
        chargeTo,
        tin,
        address,
        date,
        branch_id: user.branch_id,
        userID: user.user_id,
        vat,
        amountNetVat,
        totalAmountDue,
        transactionBy: user.full_name,
        additionalDiscount,
        deliveryFee,
        isForDelivery


      };

      const saleData = {
        headerInformationAndTotal,
        productRow: rows
          .filter(row => row.product_id && Number(row.quantity) > 0)
          .map(row => ({
            product_id: row.product_id,
            quantity: Number(row.quantity),
            unit: row.unit,
            unitPrice: Number(row.unitPrice),
            amount: Number(row.amount)
          }))
      };

      const data = await api.post(`/api/sale`, saleData);
      setSaleHeader((prevData) => [...prevData, data.data]);

      setEmptyQuantiy(false);
      setSomeEmpty(false);
      closeModal();

      //RE-FETCH WITH THE LATEST PRODUCT DATA(FRONTEND)
      fetchProductsData();
    } catch (error) {
      console.error('Error submitting sale:', error);
    } finally {
      setLoading(false);
    }
  };




  if (!user) return; // PREVENRTS RENDERING THE REST OF THE COMPONENT IF USER IS STILL EMPTY


  return (
    <div>
      {/* Loading overlay */}
      {loading && (
        <FormLoading message="Processing sale..." />
      )}

      {openDialog &&

        <ConfirmationDialog
          mode={dialogMode}
          message={"Are you sure you want to add the informaion to the sale?"}
          submitFunction={() => submitSale()}
          onClose={() => { setDialog(false); setDialogMode('') }}

        />

      }

      {openSaleModal && user && user.role && user.role.some(role => ['Sales Associate'].includes(role)) && (
        <div
          className="fixed inset-0 bg-black/35 bg-opacity-50 z-[9998] backdrop-blur-sm transition-opacity"
          style={{ pointerEvents: 'auto' }} onClick={closeModal}
        />
      )}

      <dialog className='bg-transparent fixed top-0 bottom-0 z-[9999] rounded-lg animate-popup' open={openSaleModal && user && user.role.some(role => ['Sales Associate'].includes(role))}>
        <div className="relative flex flex-col border border-gray-300 bg-white h-[90vh] max-h-[700px] w-[90vw] lg:w-[1100px] rounded-lg shadow-2xl animate-popup" >


          {/* FIXED HEADER */}
          <div className='bg-gradient-to-r from-green-700 to-green-800 text-white lg:px-8 px-5 py-6 rounded-t-lg'>
            <div className='flex justify-between items-start'>
              <div>
                <h3 className="font-bold lg:text-2xl text-xl mb-2">
                  CHARGE SALES INVOICE
                </h3>
                <div className="flex flex-wrap gap-x-8 gap-y-1 lg:text-sm text-xs ">
                  <div>
                    <span className="ml-2 font-semibold">{user.branch_name}</span>
                  </div>
                  <div>
                    <span className="text-green-100">Address:</span>
                    <span className="ml-2 font-semibold">{user.address}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeModal}
                className='absolute top-3 right-3 sm:top-4 sm:right-4 p-2 z-10 hover:bg-green-800 rounded-full transition-colors'
                aria-label="Close Modal"
              >
                <IoMdClose className='w-5 h-5 sm:w-6 sm:h-6' />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto lg:px-8 px-4 py-6 hide-scrollbar">
            {/*FORMS */}
            <form onSubmit={(e) => { e.preventDefault(); setDialog(true); setDialogMode('add') }} className='w-full flex-1 flex flex-col'>


              {/*CUSTOMER INFORMATION*/}

              <div className='mb-6'>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm'>

                  <div className='w-full'>
                    <label className='block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide'>Charge To</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-3 lg:py-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white shadow-sm'
                      placeholder="Customer name"
                      value={chargeTo}
                      onChange={(e) => setChargeTo(e.target.value)}
                    />
                  </div>

                  <div className='w-full'>
                    <label className='block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide'>TIN</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-3 lg:py-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white shadow-sm'
                      placeholder="Tax Identification Number"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                    />
                  </div>

                  <div className='w-full'>
                    <label className='block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide'>Address</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-3 lg:py-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white shadow-sm'
                      placeholder="Customer address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className='w-full'>
                    <label className='block text-xs font-bold mb-2 text-gray-600 uppercase tracking-wide'>Date</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-3 lg:py-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed shadow-sm'
                      value={dateTodayReadable}
                      readOnly
                    />
                  </div>

                </div>
              </div>



              {/*PRODUCT INFORMATION*/}
              <div className='mb-6'>
                <div className='lg:flex flex-row justify-between items-center mb-4'>
                  <h3 className='lg:text-lg text-xl font-semibold text-gray-800 lg:pb-0 pb-5'>
                    Product Details
                  </h3>

                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full lg:w-auto justify-center bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-2 px-6 text-white rounded-lg shadow-md transition-all duration-200 flex items-center gap-x-2"
                  >
                    <IoMdAdd className="text-base lg:text-lg" />
                    <span className="text-xs lg:text-sm lg:py-0 py-1 font-medium">
                      ADD NEW ROW
                    </span>
                  </button>
                </div>


                {/* Desktop Table View */}
                <div ref={desktopScrollRef}
                  className="hidden lg:block h-[180px] max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg mb-8 bg-white shadow-sm hide-scrollbar"
                >
                  <table className="w-full divide-y divide-gray-200 text-sm ">
                    <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 ">
                      <tr>
                        <th className="w-12"></th>
                        <th className="px-4 py-3 text-xs text-center font-bold text-gray-700 uppercase tracking-wider w-80">
                          PRODUCT
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          QUANTITY
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          UNIT
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          UNIT PRICE
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          AMOUNT
                        </th>

                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          ACTION
                        </th>

                      </tr>

                    </thead>

                    <tbody

                      className="bg-white divide-y divide-gray-200"
                    >
                      {rows.map((row, idx) => (
                        <tr
                          key={idx}
                          ref={el => (rowRefs.current[idx] = el)}
                          className="hover:bg-gray-50 transition-colors"
                        >

                          {/* 🔹 Item number column (no header title) */}
                          <td className="text-center text-sm text-gray-600 font-medium w-12">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 relative w-80">
                            <div className="relative">
                              <input
                                ref={(el) => {
                                  if (el) inputRefs.current[idx] = el;
                                }}
                                type="text"
                                className="border w-full rounded-md px-2 py-1.5"
                                placeholder="Search products..."
                                value={searchTerms[idx] || ""}
                                onChange={(e) => handleSearchChange(idx, e.target.value)}
                                onFocus={() =>
                                  setShowDropdowns((prev) => ({ ...prev, [idx]: true }))
                                }
                                onBlur={() =>
                                  setTimeout(() => {
                                    setShowDropdowns((prev) => ({ ...prev, [idx]: false }));
                                  }, 200)
                                }
                              />

                              {/* Dropdown */}
                              {showDropdowns[idx] && (
                                <div
                                  className="absolute z-[100] bg-white border border-gray-300 max-h-40 overflow-y-auto shadow-lg rounded-md w-full mt-1 hide-scrollbar"
                                  style={{ top: '100%', left: 0 }}
                                >
                                  {getFilteredProducts(idx).length > 0 ? (
                                    getFilteredProducts(idx).map((product) => (
                                      <div
                                        key={product.product_id}
                                        className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                                        onPointerDown={(e) => {
                                          e.preventDefault();
                                          selectProduct(idx, product);
                                        }}
                                      >
                                        <div className="font-medium text-sm">{product.product_name}</div>
                                        <div className="font-light text-xs">Quantity: {product.quantity}</div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-2 text-gray-500 text-sm">No products found</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>



                          <td className="px-2 relative">
                            <div className="relative">
                              <input
                                type="number"
                                step={row.unit ? getQuantityStep(row.unit) : "0.001"}
                                min={row.unit ? getQuantityStep(row.unit) : "0.001"}
                                className="border w-full rounded-md px-2 py-1.5"
                                value={row.quantity}
                                onChange={e => {
                                  const newRows = [...rows];
                                  newRows[idx].quantity = e.target.value;
                                  setRows(newRows);
                                }}
                                onKeyUp={() => createAnAmount(idx)}
                                placeholder={row.unit ? getQuantityPlaceholder(row.unit) : "0"}
                              />
                              {quantityValidationErrors[idx] && (
                                <div
                                  className="absolute left-0 w-full text-xs text-red-600 mt-1 z-10 bg-white pointer-events-none"
                                  style={{ bottom: '-3em' }}
                                >
                                  {quantityValidationErrors[idx]}
                                </div>
                              )}
                              {exceedQuanity.includes(row.product_id) && (
                                <div
                                  className="absolute left-0 w-full text-xs text-red-600 mt-1 z-10 bg-white pointer-events-none"
                                  style={{ bottom: '-1.5em' }}
                                >
                                  *Not enough stock available
                                </div>
                              )}
                            </div>
                          </td>


                          <td className="px-2">
                              <select
                                className="border w-full rounded-md px-2 py-1.5"
                                value={row.unit || ''}
                                onChange={e => handleUnitChange(idx, e.target.value)}
                                disabled={!row.product_id}
                              >
                                <option value="" disabled>
                                  {row.product_id ? 'Select unit' : 'Choose product first'}
                                </option>
                                {Array.isArray(row.sellingUnits) && row.sellingUnits.map(unitOption => (
                                  <option key={unitOption.unit} value={unitOption.unit}>
                                    {`${unitOption.unit} (${currencyFormat(toTwoDecimals(unitOption.unit_price))})`}
                                  </option>
                                ))}
                              </select>
                          </td>


                          <td className="px-2">
                            <input type="text" className="border w-full rounded-md px-2 py-1.5" value={row.unitPrice} onChange={e => {
                              const newRows = [...rows];
                              newRows[idx].unitPrice = e.target.value;
                              setRows(newRows);
                            }} readOnly />
                          </td>


                          <td className="px-2">
                            <input type="text" className="border w-full rounded-md px-2 py-1.5" value={row.amount} onChange={e => {
                              const newRows = [...rows];
                              newRows[idx].amount = e.target.value;
                              setRows(newRows);
                            }} onKeyUp={(e) => setAmount(e.target.value)} readOnly />
                          </td>


                          <td className="px-2 text-center">
                            <button
                              type="button"
                              className="bg-green-600 py-2 px-4 text-white mb-6 rounded-sm"
                               onClick={() => {removeSaleRow(idx); preventEmptyQuantity()}}

                            >
                              Remove
                            </button>

                          </td>
                        </tr>
                      ))}

                    </tbody>

                  </table>
                </div>

                {/* Mobile Card View */}
                <div
                  ref={mobileScrollRef}
                  className="lg:hidden max-h-[300px] overflow-y-auto space-y-4 mb-8 hide-scrollbar">
                  {rows.map((row, idx) => (
                    <div
                      key={idx}
                      ref={(el) => (rowRefs.current[idx] = el)} // attach ref here
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >

                      {/* ✅ Item number */}
                      <div className="text-sm text-right font-semibold text-gray-700 mb-2">
                        Item {idx + 1}
                      </div>

                      {/* Product Search */}
                      <div className='mb-3'>
                        <label className='block text-xs font-bold mb-1 text-gray-600 uppercase'>Product</label>
                        <div className='relative'>
                          <input
                            type="text"
                            className="border w-full rounded-md px-3 py-2 text-sm "
                            placeholder="Search products..."
                            value={searchTerms[idx] || ''}
                            onChange={(e) => handleSearchChange(idx, e.target.value)}
                            onFocus={() => setShowDropdowns(prev => ({ ...prev, [idx]: true }))}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowDropdowns(prev => ({ ...prev, [idx]: false }));
                              }, 150);
                            }}
                          />

                          {showDropdowns[idx] && (
                            <div className='absolute top-[100%] z-[200] bg-white w-[100%] border border-gray-300 max-h-40 overflow-y-auto rounded-lg shadow-lg hide-scrollbar'>
                              {getFilteredProducts(idx).length > 0 ? (
                                getFilteredProducts(idx).map((product) => (
                                  <div
                                    key={product.product_id}
                                    className='p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100'
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectProduct(idx, product);
                                    }}
                                  >
                                    <div className='font-medium text-sm'>{product.product_name}</div>
                                    <div className='font-light text-xs'>Quantity: {product.quantity}</div>
                                  </div>
                                ))
                              ) : (
                                <div className='p-2 text-gray-500 text-sm'>No products found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity and Unit */}
                      <div className='grid grid-cols-2 gap-3 mb-3'>
                        <div>
                          <label className='block text-xs font-bold mb-1 text-gray-600 uppercase'>Quantity</label>
                          <div className="relative">
                            <input
                              type="number"
                              step={row.unit ? getQuantityStep(row.unit) : "0.001"}
                              min={row.unit ? getQuantityStep(row.unit) : "0.001"}
                              className="border w-full rounded-md px-3 py-2 text-sm"
                              value={row.quantity}
                              onChange={e => {
                                const newRows = [...rows];
                                newRows[idx].quantity = e.target.value;
                                setRows(newRows);
                              }}
                              onKeyUp={() => createAnAmount(idx)}
                              placeholder={row.unit ? getQuantityPlaceholder(row.unit) : "0"}
                            />
                            {quantityValidationErrors[idx] && (
                              <div className="text-xs text-red-600 mt-1">
                                {quantityValidationErrors[idx]}
                              </div>
                            )}
                            {exceedQuanity.includes(row.product_id) && (
                              <div className="text-xs text-red-600 mt-1">
                                *Not enough stock available
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className='block text-xs font-bold mb-1 text-gray-600 uppercase'>Unit</label>
                          <input
                            type="text"
                            className="border w-full rounded-md px-3 py-2 text-sm bg-gray-50"
                            value={row.unit}
                            readOnly
                          />
                        </div>
                      </div>

                      {/* Unit Price and Amount */}
                      <div className='grid grid-cols-2 gap-3 mb-3'>
                        <div>
                          <label className='block text-xs font-bold mb-1 text-gray-600 uppercase'>Unit Price</label>
                          <input
                            type="text"
                            className="border w-full rounded-md px-3 py-2 text-sm bg-gray-50"
                            value={row.unitPrice}
                            readOnly
                          />
                        </div>

                        <div>
                          <label className='block text-xs font-bold mb-1 text-gray-600 uppercase'>Amount</label>
                          <input
                            type="text"
                            className="border w-full rounded-md px-3 py-2 text-sm bg-gray-50 font-semibold"
                            value={row.amount}
                            readOnly
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type='button'
                        onClick={() => { removeSaleRow(idx); preventEmptyQuantity() }}
                        className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-medium text-sm py-2 px-4 rounded-md transition-colors"
                      >
                        Remove Item
                      </button>
                    </div>
                  ))}
                </div>


                {/* NEW: Additional Discount and Delivery Fee Fields */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3 my-2 p-3 rounded-lg border'>

                  {/* Delivery Checkbox */}
                  <div className='w-full flex items-center'>
                    <input
                      type="checkbox"
                      id="isForDelivery"
                      className='mr-2'
                      checked={isForDelivery}
                      onChange={(e) => setIsForDelivery(e.target.checked)}
                    />
                    <label htmlFor="isForDelivery" className='text-xs font-medium text-gray-700 uppercase tracking-wide cursor-pointer'>
                      For Delivery
                    </label>
                  </div>

                  <div className='w-full'>
                    <label className='block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide'>Delivery Fee</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed'
                      value={deliveryFee}
                      disabled={!isForDelivery}
                      onKeyDown={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                          e.preventDefault();
                        }
                      }}
                      onChange={e => handleDeliveryFeeChange(Number(e.target.value) || 0)}
                      placeholder="Enter delivery fee"
                    />
                  </div>

                  <div className='w-full'>
                    <label className='block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide'>Additional Discount</label>
                    <input
                      type="text"
                      className='w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all'
                      value={additionalDiscount}
                      onKeyDown={(e) => {
                        if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                          e.preventDefault();
                        }
                      }}
                      onChange={e => handleDiscountChange(Number(e.target.value) || 0)}
                      placeholder="Enter additional discount"
                    />
                  </div>

                </div>
              </div>

              {/*TOTAL AND SUBMIT BUTTON*/}
              <div className='bg-gray-50 border-t border-gray-200 lg:px-8 px-4 lg:py-4 py-2 rounded-b-lg'>
                {/* TOTAL CALCULATIONS SECTION*/}
                <div className='bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm'>
                  <div className='flex flex-wrap justify-between items-center gap-4 mb-3'>
                    <div className='flex flex-wrap gap-x-8 gap-y-2'>
                      <div className='text-sm'>
                        <span className='text-xs font-bold text-gray-600'>VAT:</span>
                        <span className='ml-2 font-semibold text-gray-800'>{currencyFormat(toTwoDecimals(vat))}</span>
                      </div>
                      <div className='text-sm'>
                        <span className='text-xs font-bold text-gray-600'>AMOUNT NET VAT:</span>
                        <span className='ml-2 font-medium'>{currencyFormat(toTwoDecimals(amountNetVat))}</span>
                      </div>

                      {/* NEW: Additional Discount and Delivery Fee Summary */}
                      {deliveryFee > 0 && (
                        <div className='text-sm'>
                          <span className='text-xs font-bold text-blue-600'>Delivery Fee:</span>
                          <span className='ml-2 font-medium text-blue-600'>{currencyFormat(toTwoDecimals(deliveryFee))}</span>
                        </div>
                      )}
                      {additionalDiscount > 0 && (
                        <div className='text-sm'>
                          <span className='text-xs font-bold text-red-600'>Additional Discount:</span>
                          <span className='ml-2 font-medium text-red-600'>-{currencyFormat(toTwoDecimals(additionalDiscount))}</span>
                        </div>
                      )}

                    </div>
                  </div>
                  <div className='border-t border-gray-300 pt-3'>
                    <div className='lg:text-xl text-base font-bold text-right'>
                      <span className='text-gray-700'>TOTAL AMOUNT DUE: </span>
                      <span className='text-green-700'>{currencyFormat(toTwoDecimals(totalAmountDue))}</span>
                    </div>
                  </div>
                </div>

                {/*SUBMIT BUTTON*/}
                <div className='text-center'>
                  <button
                    disabled={!amountNetVat || !totalAmountDue || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0 || Object.keys(quantityValidationErrors).length > 0}
                    type='submit'
                    className={`py-2 lg:py-3 px-12 lg:text-base text-sm font-semibold rounded-lg transition-all duration-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}>
                    Confirm Sale
                  </button>

                  {(!amountNetVat || !totalAmountDue || !chargeTo || !tin || !address || someEmpy || emptyQuantity || exceedQuanity.length > 0 || Object.keys(quantityValidationErrors).length > 0) &&
                    <p className='font-thin italic text-xs lg:text-sm text-red-500 mt-3'>*Please complete the required fields</p>
                  }
                </div>
              </div>

            </form>

          </div>

        </div>

      </dialog>

    </div>
  )

}

export default AddSaleModalForm
