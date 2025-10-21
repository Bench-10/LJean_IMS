import React from 'react';
import { currencyFormat } from '../utils/formatCurrency';

function InventoryItemDetailsDialog({ open, onClose, user, item }) {
  if (!open || !item) return null;

  const isBranchManager = user?.role?.some(role => ['Branch Manager'].includes(role));
  const isInventoryStaff = user?.role?.some(role => ['Inventory Staff'].includes(role));
  const status = item.quantity <= item.min_threshold ? 'Low Stock' : item.quantity >= item.max_threshold ? 'Max Stock' : 'In Stock';
  const statusClass = item.quantity <= item.min_threshold ? 'bg-[#f05959] text-red-900' : item.quantity >= item.max_threshold ? 'bg-[#1e5e1b] text-white' : 'bg-[#61E85C] text-green-700';

  const handleOverlayClick = () => {
    if (onClose) onClose();
  };

  const handleDialogClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
          style={{ pointerEvents: 'auto' }}
          onClick={handleOverlayClick}
        />
      )}

      <dialog className="bg-transparent fixed top-0 bottom-0 z-[9999]" open={open} onClick={handleOverlayClick}>
        <div
          className="relative flex flex-col border border-gray-600/40 bg-white max-h-[90vh] w-[95vw] max-w-[600px] min-w-[320px] rounded-xl p-4 sm:p-7 animate-popup mx-auto my-4"
          onClick={handleDialogClick}
        >
          <button
            type="button"
            className="btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={onClose}
          >
            ✕
          </button>

          <div className="pt-2 px-2 lg:px-8 w-full flex-1 flex flex-col">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-gray-800">{item.product_name}</h2>
                <div className={`border rounded-full px-4 py-1 mr-3 lg:mr-0 text-sm font-medium ${statusClass}`}>
                  {status}
                </div>
              </div>
              <p className="text-xs text-gray-500">Review the current details of this inventory item.</p>
            </div>

            <div className="col-span-2 mb-6">
                <label className="text-xs font-bold text-gray-600">DESCRIPTION</label>
                <div className="p-3 bg-gray-50 border rounded-lg text-sm min-h-[64px] whitespace-pre-line">
                  {item.description || <span className="text-gray-400 italic">No description provided.</span>}
                </div>
              </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-600">ITEM ID</label>
                <div className="p-2 bg-gray-50 border rounded-lg text-sm">{item.product_id}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">CATEGORY</label>
                <div className="p-2 bg-gray-50 border rounded-lg text-sm">{item.category_name}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">UNIT</label>
                <div className="p-2 bg-gray-50 border rounded-lg text-sm">{item.unit}</div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">UNIT PRICE</label>
                <div className="p-2 bg-gray-50 border rounded-lg text-sm text-right">{currencyFormat(item.unit_price)}</div>
              </div>
              {isBranchManager && (
                <div>
                  <label className="text-xs font-bold text-gray-600">UNIT COST</label>
                  <div className="p-2 bg-gray-50 border rounded-lg text-sm text-right">{currencyFormat(item.unit_cost)}</div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-600">QUANTITY</label>
                <div className="p-2 bg-gray-50 border rounded-lg text-sm text-right">{Number(item.quantity).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600">MIN THRESHOLD</label>
                  <div className="p-2 bg-gray-50 border rounded-lg text-sm text-right">{Number(item.min_threshold).toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">MAX THRESHOLD</label>
                  <div className="p-2 bg-gray-50 border rounded-lg text-right text-sm whitespace-nowrap overflow-hidden text-ellipsis">{Number(item.max_threshold).toLocaleString()}</div>
                </div>
              </div>
              
            </div>

          </div>
        </div>
      </dialog>
    </div>
  );
}

export default InventoryItemDetailsDialog;
