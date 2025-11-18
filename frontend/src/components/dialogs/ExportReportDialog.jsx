import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { FaFileExport } from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import { exportChartsAsPDF } from '../../utils/exportUtils';
import useModalLock from '../../hooks/useModalLock';

function ExportReportDialog({ isOpen, onClose, availableCharts = [], meta = {}, exportContainerRef = null }) {
  const [selectedCharts, setSelectedCharts] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCharts([]);
      return;
    }
    setSelectedCharts(availableCharts.map((chart) => chart.id));
  }, [isOpen, availableCharts]);

  const handleToggle = (chartId) => {
    setSelectedCharts((prev) =>
      prev.includes(chartId) ? prev.filter((id) => id !== chartId) : [...prev, chartId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCharts.length === availableCharts.length) {
      setSelectedCharts([]);
      return;
    }
    setSelectedCharts(availableCharts.map((c) => c.id));
  };

  const handleExport = async () => {
    if (selectedCharts.length === 0) {
      alert('Please select at least one chart to export');
      return;
    }

    setExporting(true);
    try {
      const selectedChartData = availableCharts.filter((chart) => selectedCharts.includes(chart.id));
      const chartsToExport = selectedChartData.map((chart) => chart.ref).filter((ref) => ref.current);

      if (chartsToExport.length === 0) {
        alert('Charts are not ready yet. Please wait for charts to load and try again.');
        setExporting(false);
        return;
      }

      const chartConfigs = selectedChartData.map(({ id, label }) => ({ id, label }));
      const now = dayjs();
      const filename = `analytics-report-${now.format('YYYYMMDD-HHmm')}.pdf`;
      await exportChartsAsPDF(chartsToExport, filename, chartConfigs, {
        meta,
        quality: 'high',
        containerRef: exportContainerRef,
        selectedChartIds: chartConfigs.map(({ id }) => id)
      });
      onClose?.();
      setSelectedCharts([]);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClose = useCallback(() => {
    if (exporting) return;
    onClose?.();
  }, [exporting, onClose]);

  // apply modal lock (no background scroll + back button closes this dialog)
  useModalLock(isOpen, handleClose);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={handleClose}
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-[500px] max-w-[92%] bg-white rounded-lg shadow-xl border border-gray-200 p-6 animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FaFileExport className="text-2xl text-green-600" />
            <h2 className="text-2xl font-bold text-gray-800">Export Report</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-600 top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 "
            aria-label="Close"
          >
            <IoMdClose className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4">
          Select the charts you want to include in your PDF report.
        </p>

        {/* Chart selection */}
        <div className="border border-gray-200 rounded-lg p-4 mb-6 max-h-[400px] overflow-y-auto">
          {/* Select all */}
          <label className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 mb-2">
            <input
              type="checkbox"
              checked={selectedCharts.length === availableCharts.length && availableCharts.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
            />
            <span className="font-semibold text-gray-700">Select All</span>
          </label>

          {/* Individual charts */}
          {availableCharts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No charts available to export</div>
          ) : (
            availableCharts.map((chart) => (
              <label
                key={chart.id}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCharts.includes(chart.id)}
                  onChange={() => handleToggle(chart.id)}
                  className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <span className="text-gray-700">{chart.label}</span>
              </label>
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selectedCharts.length} of {availableCharts.length} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedCharts.length === 0 || exporting}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FaFileExport />
                  Export PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportReportDialog;
