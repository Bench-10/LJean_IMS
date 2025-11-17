import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api.js';
import { IoMdClose } from "react-icons/io";
import { useAuth } from '../authentication/Authentication';
import ConfirmationDialog from './dialogs/ConfirmationDialog.jsx';
import FormLoading from './common/FormLoading';
import DatePickerCustom from '../components/DatePickerCustom';
import useModalLock from "../hooks/useModalLock";
import toast from 'react-hot-toast'; 

// SEARCHABLE DROPDOWN
const SearchableSaleDropdown = React.memo(function SearchableSaleDropdown({ saleHeader = [], deliveryData = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Create a Set of delivered sale IDs for O(1) lookup instead of O(n) .some() check
  const deliveredSaleIds = React.useMemo(() => {
    const ids = new Set();
    deliveryData.forEach(delivery => {
      ids.add(String(delivery.sales_information_id));
    });
    return ids;
  }, [deliveryData]);

  const options = React.useMemo(() => {
    // Pre-filter saleHeader to only include deliverable items not already delivered
    const availableSales = saleHeader.filter(row =>
      row.is_for_delivery && !deliveredSaleIds.has(String(row.sales_information_id))
    );

    // Create options array
    const allOptions = availableSales.map((row) => ({
      id: String(row.sales_information_id),
      label: `${row.sales_information_id} — ${row.charge_to || 'Unknown'}${
        row.address ? ' (' + String(row.address).slice(0, 30) + (String(row.address).length > 30 ? '...' : '') + ')' : ''
      }`,
      address: row.address || '',
    }));

    // Apply search filter if query exists
    if (!query) return allOptions;
    const lowerQuery = query.toLowerCase();
    return allOptions.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
  }, [saleHeader, deliveredSaleIds, query]);

  const selectedLabel = React.useMemo(() => {
    if (!value) return '';
    const found = options.find((o) => o.id === String(value));
    return found ? found.label : '';
  }, [value, options]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-11 text-left border border-gray-400 rounded-lg px-3 sm:px-4 flex items-center justify-between bg-white"
      >
        <span className="truncate text-xs sm:text-sm text-gray-800">{selectedLabel || 'Select sale id'}</span>
        <svg className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 011.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by sale id, name or address"
              className="w-full h-9 px-3 border rounded text-xs sm:text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-48 sm:max-h-56 overflow-auto">
            {options.length === 0 ? (
              <div className="p-3 text-xs sm:text-sm text-gray-500">No matching sales</div>
            ) : (
              options.slice(0, 50).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-xs sm:text-sm break-words"
                >
                  <div className="font-medium text-gray-800">{opt.label}</div>
                  {opt.address && <div className="text-xs text-gray-500 mt-0.5 break-words">{opt.address}</div>}
                </button>
              ))
            )}
            {options.length > 50 && (
              <div className="p-2 text-xs text-gray-500 border-t text-center">
                Showing first 50 results. Use search to find more.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// STATUS DROPDOWN COMPONENT
const StatusDropdown = React.memo(function StatusDropdown({ status, onChange, mode }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open && dropdownRef.current) {
      // Scroll the dropdown into view when it opens
      setTimeout(() => {
        dropdownRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }, 50);
    }
  }, [open]);

  const getStatusValue = React.useCallback(() => {
    if (status.pending) return 'out';
    if (status.is_delivered) return 'delivered';
    return 'undelivered';
  }, [status.pending, status.is_delivered]);

  const statusOptions = React.useMemo(() => [
    { value: 'out', label: 'OUT FOR DELIVERY', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-400' },
    ...(mode === 'edit' ? [
      { value: 'delivered', label: 'DELIVERED', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-400' },
      { value: 'undelivered', label: 'UNDELIVERED', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-400' }
    ] : [])
  ], [mode]);

  const currentStatus = React.useMemo(() => {
    const found = statusOptions.find(opt => opt.value === getStatusValue());
    if (found) return found;

    // Fallback: mode may restrict available options (e.g. add-mode only exposes 'out')
    // If the incoming `status` indicates a value not present in options, synthesize
    // a reasonable display object so the component doesn't crash.
    const value = getStatusValue();
    if (value === 'delivered') {
      return { value: 'delivered', label: 'DELIVERED', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-400' };
    }
    if (value === 'undelivered') {
      return { value: 'undelivered', label: 'UNDELIVERED', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-400' };
    }

    // Default to the first available option or a neutral object
    return statusOptions[0] || { value: 'out', label: 'OUT FOR DELIVERY', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-400' };
  }, [statusOptions, getStatusValue]);

  const handleSelect = React.useCallback((val) => {
    if (val === 'out') onChange({ is_delivered: false, pending: true });
    if (val === 'delivered') onChange({ is_delivered: true, pending: false });
    if (val === 'undelivered') onChange({ is_delivered: false, pending: false });
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={wrapperRef} className="flex flex-col flex-1">
      <label className="text-sm font-medium mb-2 text-gray-700">Status:</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`h-10 w-full border-2 rounded-lg px-3 text-sm font-medium flex items-center justify-between transition-all duration-200 focus:ring-2 focus:ring-offset-1 focus:outline-none focus:ring-blue-400 ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${currentStatus.dot}`}></div>
            <span>{currentStatus.label}</span>
          </div>
          <svg className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 011.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <div ref={dropdownRef} className="absolute z-50 mt-1 w-full bg-white border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2.5 text-left text-sm font-medium flex items-center gap-2.5 transition-colors ${
                  opt.value === getStatusValue() 
                    ? `${opt.bg} ${opt.text}` 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${opt.dot}`}></div>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>                                                
    </div>
  );
});

const AddDeliveryInformation = React.memo(function AddDeliveryInformation({
  openAddDelivery,
  onClose,
  saleHeader,
  deliveryData,
  getDeliveries,
  fetchProductsData,
  mode,
  deliveryEditData,
}) {
  const { user } = useAuth();

  const [openDialog, setDialog] = useState(false);
  const message = mode === 'edit' ? 'Are you sure you want to edit this?' : 'Are you sure you want to add this?';
  const [loading, setLoading] = useState(false);

  const [courierName, setCourierName] = useState('');
  const [salesId, setSalesId] = useState('');
  const [address, setAddress] = useState('');
  const [deliveredDate, setDeliveredDate] = useState('');
  const [status, setStatus] = useState({ is_delivered: false, pending: true });
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' });


    useEffect(() => {
    if (!openAddDelivery) {
      setDialog(false);
    }
  }, [openAddDelivery]);

  useEffect(() => {
    if (openAddDelivery) {
      if (mode === 'edit' && deliveryEditData) {
        setCourierName(deliveryEditData.courier_name);
        setSalesId(deliveryEditData.sales_information_id);
        setAddress(deliveryEditData.destination_address);
        setDeliveredDate(deliveryEditData.delivered_date);
        setStatus({ is_delivered: deliveryEditData.is_delivered, pending: deliveryEditData.is_pending });
      } else {
        setCourierName('');
        setSalesId('');
        setAddress('');
        setDeliveredDate('');
        setStatus({ is_delivered: false, pending: true });
      }
    }
  }, [openAddDelivery]);

  async function handleSubmit(mode) {
    try {
      setLoading(true);

      const payload = {
        courierName,
        salesId: Number(salesId),
        address,
        currentBranch: user.branch_id,
        deliveredDate,
        status,
        userID: user.user_id,
        userFullName: user.full_name,
      };

      if (mode === 'add') {
        const response = await api.post(`/api/delivery/`, payload);
        getDeliveries((prevData) => [...prevData, response.data]);
        toast.success('Successfully added delivery');
      } else {
        const delivery = await api.put(`/api/delivery/${deliveryEditData.sales_information_id}`, payload);
        getDeliveries((prevData) =>
          prevData.map((item) =>
            item.sales_information_id === Number(salesId)
              ? { ...item, is_delivered: delivery.data }
              : item
          )
        );
        if (fetchProductsData) await fetchProductsData();
        
        // Show success toast for delivery status change
        const statusText = status.is_delivered ? 'delivered' : status.pending ? 'out for delivery' : 'undelivered';
        toast.success(`Delivery status changed to ${statusText}`);
      }

      onClose();
    } catch (error) {
      console.error('Error submitting delivery:', error);
      const serverMessage = error?.response?.data?.message;
      setErrorDialog({
        open: true,
        message: serverMessage || 'Failed to update delivery status. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  }

  useModalLock(openAddDelivery, onClose);

  if (!openAddDelivery) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 md:p-6 z-[9998] backdrop-blur-sm">
      {loading && <FormLoading message={mode === 'edit' ? 'Updating delivery...' : 'Adding delivery...'} />}

      {openDialog && (
        <ConfirmationDialog
          mode={mode}
          message={message}
          submitFunction={() => handleSubmit(mode)}
          onClose={() => setDialog(false)}
        />
      )}

      {errorDialog.open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setErrorDialog({ open: false, message: '' })} />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-lg bg-white shadow-2xl rounded-2xl border border-red-100 overflow-hidden"
          >
            {/* Header with warning icon */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-800">Action Blocked</h2>
                  <p className="text-sm text-red-600 font-medium">Insufficient Stock</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {errorDialog.message}
              </div>

              {/* Additional help text */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">What you can do:</p>
                    <ul className="space-y-1 text-amber-700">
                      <li>• Add more stock to the affected products</li>
                      <li>• Cancel this delivery and create a new one with reduced quantities</li>
                      <li>• Contact inventory manager for assistance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition"
                onClick={() => setErrorDialog({ open: false, message: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition"
                onClick={() => setErrorDialog({ open: false, message: '' })}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[9999] w-full max-w-[95vw] sm:max-w-[500px] md:max-w-[600px] lg:max-w-[650px] xl:max-w-[700px] rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto hide-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="text-lg sm:text-xl md:text-3xl font-bold mb-5 sm:mb-6 pr-8 text-center sm:text-left">
          {mode === 'edit' ? 'EDIT DELIVERY DETAILS' : 'DELIVERY DETAILS'}
        </h1>

        <form onSubmit={(e) => { e.preventDefault(); setDialog(true); }} className="space-y-4 sm:space-y-5 md:space-y-4">
          <div className="flex flex-col sm:flex-row md:flex-row gap-4 sm:gap-5 md:gap-6">
            <input
              type="text"
              placeholder="Courier Name"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="flex-1 min-w-0 h-11 py-2 border border-gray-400 rounded-lg px-3 sm:px-4 text-sm focus:ring-2 focus:ring-green-300 focus:outline-none"
              required
            />

            {mode === 'edit' ? (
              <input
                value={salesId}
                readOnly
                className="w-full sm:w-[45%] md:w-[40%] h-11 border border-gray-400 rounded-lg px-3 sm:px-4 text-sm bg-gray-50"
              />
            ) : (
              <div className="w-full sm:w-[45%] md:w-[40%]">
                <SearchableSaleDropdown
                  saleHeader={saleHeader}
                  deliveryData={deliveryData}
                  value={salesId}
                  onChange={(val) => {
                    setSalesId(val);
                    const corres = saleHeader.find((r) => String(r.sales_information_id) === String(val));
                    setAddress(corres ? corres.address : '');
                  }}
                />
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Destination Address"
            value={address}
            readOnly
            className="w-full h-10 border border-gray-400 rounded-lg px-3 sm:px-4 text-sm bg-gray-50 focus:ring-2 focus:ring-green-300 focus:outline-none"
          />

          <div className="flex flex-col sm:flex-row md:flex-row gap-4 sm:gap-5 md:gap-6">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium mb-2 text-gray-700">Delivery Date:</label>
              <DatePickerCustom
                value={deliveredDate}
                onChange={(e) => setDeliveredDate(e.target.value)}
                placeholder="Select delivery date"
              />
            </div>

            <StatusDropdown 
              status={status} 
              onChange={setStatus} 
              mode={mode} 
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              className={`w-full h-11 ${mode === 'edit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-semibold rounded-lg text-sm tracking-wide transition disabled:opacity-50`}
              disabled={!courierName || !salesId || !address || !deliveredDate}
            >
              {mode === 'edit' ? 'CONFIRM CHANGES' : 'CONFIRM DELIVERY'}
            </button>
          </div>
        </form>

        <button
  type="button"
  onClick={onClose}
  aria-label="Close"
  title="Close"
  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
>
  <IoMdClose className="w-5 h-5 sm:w-6 sm:h-6" />
</button>
      </div>
    </div>
  );
});

export default AddDeliveryInformation;
