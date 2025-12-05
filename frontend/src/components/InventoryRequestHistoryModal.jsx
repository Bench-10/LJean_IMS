import React, { useState, useEffect } from "react";
import { IoMdClose } from "react-icons/io";
import { MdHistory } from "react-icons/md";
import api from "../utils/api.js";
import ChartLoading from "./common/ChartLoading";
import NoInfoFound from "./common/NoInfoFound";
import useModalLock from "../hooks/useModalLock";

function InventoryRequestHistoryModal({
  open,
  onClose,
  pendingId,
  formatDateTime,
}) {
  useModalLock(open, onClose);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && pendingId) {
      fetchHistory();
    }
  }, [open, pendingId]);

  const fetchHistory = async () => {
    if (!pendingId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/items/pending/${pendingId}/history`);
      setHistory(response.data || []);
    } catch (err) {
      console.error("Error fetching inventory request history:", err);
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeLocal = (value) => {
    if (!value) return "—";
    if (formatDateTime) return formatDateTime(value);

    try {
      return new Date(value).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType?.toLowerCase()) {
      case "created":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "request_changes":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "resubmitted":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatActionDescription = (actionType, actionDescription) => {
    if (actionDescription) return actionDescription;

    switch (actionType?.toLowerCase()) {
      case "created":
        return "Inventory request was created";
      case "approved":
        return "Request was approved";
      case "rejected":
        return "Request was rejected";
      case "request_changes":
        return "Changes were requested";
      case "resubmitted":
        return "Request was resubmitted after changes";
      case "cancelled":
        return "Request was cancelled";
      default:
        return actionType || "Action performed";
    }
  };

  const renderPayloadChanges = (oldPayload, newPayload) => {
    if (!oldPayload && !newPayload) return null;

    const oldData = oldPayload?.productData || oldPayload || {};
    const newData = newPayload?.productData || newPayload || {};

    const changes = [];

    const fields = [
      { key: "product_name", label: "Product Name" },
      { key: "description", label: "Description" },
      { key: "category_name", label: "Category" },
      { key: "unit_name", label: "Unit" },
      { key: "quantity_added", label: "Quantity" },
      { key: "unit_price", label: "Unit Price" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "min_threshold", label: "Min Threshold" },
      { key: "max_threshold", label: "Max Threshold" },
    ];

    fields.forEach(({ key, label }) => {
      const oldValue = oldData[key];
      const newValue = newData[key];

      if (oldValue !== newValue && (oldValue != null || newValue != null)) {
        changes.push({
          field: label,
          oldValue: oldValue || "—",
          newValue: newValue || "—",
        });
      }
    });

    if (changes.length === 0) return null;

    return (
      <div className="mt-3 p-2 sm:p-3 bg-gray-50 rounded-lg border">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Changes Made:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {changes.map((change, index) => (
            <div key={index} className="text-xs bg-white p-2 rounded border">
              <span className="font-medium">{change.field}:</span>{" "}
              <span className="text-red-600 line-through">{change.oldValue}</span>{" "}
              <span className="text-gray-400">→</span>{" "}
              <span className="text-green-600">{change.newValue}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[450] p-2 sm:p-4 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border border-green-100 w-full max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-green-700 p-3 sm:p-4 rounded-t-lg flex justify-between items-center gap-3 flex-shrink-0 sticky top-0 z-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-white font-bold text-lg lg:text-2xl flex items-center gap-2">
              <MdHistory className="text-2xl" />
              Request History
            </h1>

          </div>

          <button
            onClick={onClose}
            className="text-white hover:bg-black/10 p-1.5 rounded-lg"
            aria-label="Close"
            title="Close"
          >
            <IoMdClose className="text-2xl" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-green-50/30 hide-scrollbar relative">
          {loading ? (
            <div className="py-10">
              <ChartLoading message="Loading request history..." />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <div className="text-red-600 font-medium mb-2">Error loading history</div>
              <div className="text-sm text-gray-600">{error}</div>
            </div>
          ) : history.length === 0 ? (
              <div className="flex h-full min-h-[180px] items-center justify-center text-center">
    <NoInfoFound message="No history found for this request." />
  </div>
          ) : (
            <div className="space-y-4">
              {[...history].reverse().map((entry, index) => (
                <div
                  key={entry.id || index}
                  className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm"
                >
                  {/* Header with action and timestamp */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${getActionColor(
                          entry.action_type
                        )}`}
                      >
                        {entry.action_type
                          ? entry.action_type.charAt(0).toUpperCase() + entry.action_type.slice(1).toLowerCase()
                          : "Action"}
                      </span>
                      <span className="text-sm text-gray-500">
                        by {entry.user_name || "Unknown"} ({entry.user_role || "Unknown Role"})
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTimeLocal(entry.action_date)}
                    </span>
                  </div>

                  {/* Action description */}
                  <div className="text-sm text-gray-700 mb-2">
                    {formatActionDescription(entry.action_type, entry.action_description)}
                  </div>

                  {/* Additional data if present */}
                  {entry.additional_data && entry.action_type === "request_changes" && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="text-sm font-medium text-yellow-800 mb-2">Change Request Details:</h4>
                      {(() => {
                        try {
                          const data = typeof entry.additional_data === "string"
                            ? JSON.parse(entry.additional_data)
                            : entry.additional_data;

                          return (
                            <div className="space-y-2">
                              {data.change_type && (
                                <div className="text-sm">
                                  <span className="font-medium text-yellow-700">Type of Change:</span>{" "}
                                  <span className="text-yellow-900 capitalize">
                                    {data.change_type.replace(/_/g, " ")}
                                  </span>
                                </div>
                              )}
                              {data.comment || data.change_request_comment ? (
                                <div className="mt-2">
                                  <div className="text-sm text-yellow-800 mb-1">
                                    <span className="font-medium">Change requested by </span>
                                    <span className="font-semibold">{entry.user_name || 'Unknown'}</span>
                                    <span className="text-gray-500"> {entry.user_role ? `(${entry.user_role})` : ''}</span>
                                  </div>

                                  <div className="text-yellow-900 mt-1 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400 text-sm">
                                    <div className="italic font-bold">{data.comment || data.change_request_comment}</div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        } catch (e) {
                          return (
                            <div className="text-sm text-yellow-900">
                              {typeof entry.additional_data === "string"
                                ? entry.additional_data
                                : JSON.stringify(entry.additional_data, null, 2)}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}

                  {/* Additional data for rejected actions */}
                  {entry.additional_data && entry.action_type === "rejected" && (() => {
                    try {
                      const parsed = typeof entry.additional_data === 'string'
                        ? JSON.parse(entry.additional_data)
                        : entry.additional_data;

                      if (parsed.rejection_reason && parsed.rejection_reason.trim() !== "") {
                        return (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <h4 className="text-sm font-medium text-red-800 mb-2">Rejection Reason:</h4>
                            <div className="text-red-900 text-sm">{parsed.rejection_reason}</div>
                          </div>
                        );
                      }
                      return null;
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* Additional data for other actions (skip if we've already shown structured details) */}
                  {entry.additional_data && (() => {
                    try {
                      const parsed = typeof entry.additional_data === 'string'
                        ? JSON.parse(entry.additional_data)
                        : entry.additional_data;

                      const hasStructuredFields = parsed && (
                        parsed.comment || 
                        parsed.change_request_comment || 
                        parsed.change_type || 
                        parsed.cancellation_reason !== undefined ||
                        parsed.rejection_reason !== undefined ||
                        parsed.auto_rejected !== undefined
                      );

                      // If this payload has structured fields (we already rendered them above), don't render raw JSON again
                      if (hasStructuredFields) return null;

                      return (
                        <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                          {typeof entry.additional_data === "string"
                            ? entry.additional_data
                            : JSON.stringify(entry.additional_data, null, 2)}
                        </div>
                      );
                    } catch (e) {
                      // If parsing fails, fall back to printing whatever we have
                      return (
                        <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                          {typeof entry.additional_data === "string"
                            ? entry.additional_data
                            : JSON.stringify(entry.additional_data, null, 2)}
                        </div>
                      );
                    }
                  })()}

                  {/* Payload changes - only show for created and resubmitted actions */}
                  {(entry.action_type === "created" || entry.action_type === "resubmitted") &&
                    renderPayloadChanges(entry.old_payload, entry.new_payload)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-4 sm:px-4 py-3 sm:py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-1.5 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-md text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default InventoryRequestHistoryModal;