import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';

// SIMPLE EXPORT UTILITIES

// CSV EXPORT - SIMPLE AND RELIABLE
export const exportToCSV = (data, filename, customHeaders = null, dataKeys = null) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // USE DATA KEYS FOR ACCESSING VALUES, CUSTOM HEADERS FOR DISPLAY
  const keys = dataKeys || Object.keys(data[0]);
  const headers = customHeaders || keys;
  
  const csvContent = [
    headers.join(','), // HEADER ROW
    ...data.map(row =>
      keys.map(key => {
        let value = row[key];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');


  // DOWNLOAD CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

};

// SIMPLE PDF EXPORT WITH CATEGORY SUMMARY FOR INVENTORY
export const exportToPDF = (data, filename, options = {}) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const { title = filename, customHeaders = null, dataKeys = null, showCategorySummary = false, columnWidths = null, disableTextTruncation = false } = options;

  // CREATE PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });


  // FUNCTION TO DRAW TITLE AND DATE ON CURRENT PAGE
  const drawHeader = () => {
    pdf.setFontSize(16);
    pdf.text(title.toUpperCase(), 20, 20);
    pdf.setFontSize(10);
    pdf.text(`Exported: ${new Date().toLocaleDateString()}`, 20, 30);
  };


  // DRAW HEADER ON FIRST PAGE
  drawHeader();


  const margin = 20;
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const lineHeight = 6;
  let yPosition = 45;

  // CATEGORY SUMMARY TABLE (IF ENABLED FOR INVENTORY)
  if (showCategorySummary && data.length > 0 && data[0].category_name) {
    // Calculate category counts
    const categoryCounts = {};
    data.forEach(item => {
      const category = item.category_name || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Sort categories alphabetically
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => a[0].localeCompare(b[0]));

    // DRAW CATEGORY SUMMARY TITLE
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CATEGORY SUMMARY', margin, yPosition);
    yPosition += 8;

    // DRAW CATEGORY SUMMARY TABLE
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Headers
    const categoryColWidth = 100;
    const countColWidth = 40;
    pdf.text('Category', margin, yPosition);
    pdf.text('Item Count', margin + categoryColWidth, yPosition);
    
    // Header line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition + 2, margin + categoryColWidth + countColWidth, yPosition + 2);
    yPosition += lineHeight;

    // Category rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    sortedCategories.forEach(([category, count]) => {
      // Check if need new page
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        drawHeader();
        yPosition = 45;
        
        // Redraw summary header
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CATEGORY SUMMARY (continued)', margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(9);
        pdf.text('Category', margin, yPosition);
        pdf.text('Item Count', margin + categoryColWidth, yPosition);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition + 2, margin + categoryColWidth + countColWidth, yPosition + 2);
        yPosition += lineHeight;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
      }

      pdf.text(category, margin, yPosition);
      pdf.text(String(count), margin + categoryColWidth, yPosition);
      
      // Row line
      pdf.setLineWidth(0.1);
      pdf.line(margin, yPosition + 2, margin + categoryColWidth + countColWidth, yPosition + 2);
      yPosition += lineHeight;
    });

    // Total row
    const totalItems = data.length;
    pdf.setFont('helvetica', 'bold');
    yPosition += 2;
    pdf.text('TOTAL ITEMS', margin, yPosition);
    pdf.text(String(totalItems), margin + categoryColWidth, yPosition);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition + 2, margin + categoryColWidth + countColWidth, yPosition + 2);
    
    // Add spacing before product table
    yPosition += 15;
    
    // Check if we need a new page for the product table
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      drawHeader();
      yPosition = 45;
    }
    
    // DRAW PRODUCT TABLE TITLE
    pdf.setFontSize(12);
    pdf.text('PRODUCT INVENTORY DETAILS', margin, yPosition);
    yPosition += 8;
  }

  // PRODUCT TABLE
  const keys = dataKeys || Object.keys(data[0]);
  const colCount = keys.length;
  
  // Use custom column widths if provided, otherwise equal widths
  let colWidths;
  if (columnWidths && Array.isArray(columnWidths) && columnWidths.length === colCount) {
    colWidths = columnWidths;
  } else {
    const colWidth = (pageWidth - margin * 2) / colCount;
    colWidths = new Array(colCount).fill(colWidth);
  }

  // GET HEADERS AND FORMAT THEM
  const formattedHeaders = customHeaders || keys.map(h => h.replace(/_/g, ' ').toUpperCase());

  // DRAW HEADERS
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  let xPosition = margin;
  formattedHeaders.forEach((header, index) => {
    pdf.text(header, xPosition, yPosition);
    xPosition += colWidths[index];
  });

  // DRAW THICK LINE BELOW HEADERS
  pdf.setLineWidth(0.5); // THICK LINE
  pdf.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);

  yPosition += lineHeight;

  // DRAW DATA ROWS
  pdf.setFont('helvetica', 'normal');
  data.forEach((row, index) => {
    // CHECK IF NEED A NEW PAGE
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      drawHeader(); // DRAW TITLE AND DATE ON NEW PAGE
      yPosition = 45;

      // REDRAW TABLE HEADERS ON NEW PAGE
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      xPosition = margin;
      formattedHeaders.forEach((header, index) => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });

      // DRAW THICK LINE BELOW HEADERS ON NEW PAGE
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);

      yPosition += lineHeight;
      pdf.setFont('helvetica', 'normal');
    }

    xPosition = margin;
    keys.forEach((key, index) => {
      let value = row[key];
      if (value === null || value === undefined) value = '';
      
      // Special formatting for quantity fields - show decimals only if present
      if (key.toLowerCase().includes('quantity') && !isNaN(value) && value !== '') {
        const numValue = Number(value);
        value = numValue % 1 === 0 ? numValue.toString() : numValue.toString();
      }
      
      // LIMIT TEXT LENGTH EXCEPT FOR DATES, PRODUCT NAMES, AND CATEGORIES (unless disabled)
      if (!disableTextTruncation && typeof value === 'string' && value.length > 15 && !key.toLowerCase().includes('date') && !key.toLowerCase().includes('product_name') && !key.toLowerCase().includes('category')) {
        value = value.substring(0, 15) + '...';
      }
      pdf.text(String(value), xPosition, yPosition);
      xPosition += colWidths[index];  
    });

    // DRAW THIN LINE AFTER EACH ROW
    pdf.setLineWidth(0.1); // THIN LINE
    pdf.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);

    yPosition += lineHeight;
  });

  // SAVE PDF
  pdf.save(`${filename}.pdf`);
};


export const formatForExport = (data, excludeFields = []) => {
  return data.map(item => {
    const cleanItem = { ...item };
    excludeFields.forEach(field => delete cleanItem[field]);
    return cleanItem;

  });

};


const QUALITY_SCALE = {
  low: 2,
  medium: 2,
  high: 3,
  ultra: 4
};

// ANALYTICS EXPORT: SINGLE-PAGE DASHBOARD SNAPSHOT (SCREENSHOT STYLE)
// Instead of exporting individual charts, this captures the main dashboard
// container as one image (minus any elements marked data-export-exclude), so
// the PDF mirrors the desktop layout the user sees.
export const exportChartsAsPDF = async (chartRefs = [], filename = 'analytics-report.pdf', chartConfigs = [], options = {}) => {
  const {
    meta: rawMeta = {},
    quality = 'high',
    title: fallbackTitle = 'Analytics Report',
    pageSize = 'a4',
    orientation = 'landscape',
    margin = 10,
    // optional: pass the main container ref explicitly as options.containerRef
    containerRef,
    selectedChartIds = []
  } = options ?? {};

  const selectedIds = new Set(
    Array.isArray(selectedChartIds) && selectedChartIds.length
      ? selectedChartIds.filter(Boolean)
      : chartConfigs.map((cfg) => cfg?.id).filter(Boolean)
  );

  // Determine what to capture. Prefer a dedicated containerRef if provided.
  // Otherwise, fall back to the first chartRef's parent node.
  let targetElement = containerRef?.current || null;
  if (!targetElement && Array.isArray(chartRefs) && chartRefs[0]?.current) {
    const node = chartRefs[0].current;
    // Walk up to a reasonably large wrapper (e.g., analytics root)
    targetElement = node.closest?.('[data-analytics-root]') || node.parentElement || node;
  }

  if (!targetElement) {
    alert('Analytics view is not ready to export.');
    return;
  }

  const resolveScale = (value) => {
    if (typeof value === 'number' && value > 0) return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (QUALITY_SCALE[normalized]) return QUALITY_SCALE[normalized];
    }
    return QUALITY_SCALE.medium;
  };

  const scale = resolveScale(quality);
  const pdf = new jsPDF({ orientation, unit: 'mm', format: pageSize });

  const removeUnselectedSections = (root, allowedIds) => {
    if (!(root instanceof HTMLElement) || !allowedIds?.size) return;
    Array.from(root.querySelectorAll('[data-export-section]')).forEach((node) => {
      const sectionId = node.getAttribute('data-export-section');
      if (!sectionId) return;
      if (!allowedIds.has(sectionId)) {
        node.remove();
      }
    });
  };

  const cleanupEmptyContainers = (root) => {
    if (!(root instanceof HTMLElement)) return;
    Array.from(root.querySelectorAll('[data-export-grid]')).forEach((grid) => {
      if (!grid.querySelector('[data-export-section]')) {
        grid.remove();
      }
    });
  };

  const adjustGridLayouts = (root) => {
    if (!(root instanceof HTMLElement)) return;
    
    // Adjust chart grids
    Array.from(root.querySelectorAll('[data-export-grid]')).forEach((grid) => {
      const directSections = Array.from(grid.children).filter((child) => child.matches('[data-export-section]'));
      if (!directSections.length) return;
      if (directSections.length === 1) {
        const onlySection = directSections[0];
        onlySection.style.setProperty('grid-column', '1 / -1', 'important');
        onlySection.style.setProperty('width', '100%', 'important');
      } else {
        directSections.forEach((section) => {
          section.style.removeProperty('grid-column');
          section.style.removeProperty('width');
        });
      }
    });

    // Preserve KPI grid layout when KPI section is included
    Array.from(root.querySelectorAll('[data-export-section="kpi-summary"]')).forEach((kpiGrid) => {
      const kpiCards = kpiGrid.querySelectorAll('[data-kpi-card]');
      if (kpiCards.length > 0) {
        // Ensure grid stays as is (4 columns on desktop)
        kpiGrid.style.setProperty('display', 'grid', 'important');
        kpiGrid.style.setProperty('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))', 'important');
        kpiGrid.style.setProperty('gap', '1rem', 'important');
      }
    });
  };

  const toDateTimeString = (value) => {
    const dateValue = value ? new Date(value) : new Date();
    if (Number.isNaN(dateValue.getTime())) {
      return new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return dateValue.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizeFilters = (filters) => {
    if (!Array.isArray(filters)) return [];
    return filters
      .map((entry) => ({
        label: entry?.label ?? '',
        value: entry?.value != null ? String(entry.value) : ''
      }))
      .filter((entry) => entry.label || entry.value);
  };

  const normalizeKpis = (kpis) => {
    if (!Array.isArray(kpis)) return [];
    return kpis
      .map((entry) => ({
        key: entry?.key ?? '',
        label: entry?.label ?? '',
        value: Number(entry?.value ?? 0),
        previous: (() => {
          const numeric = Number(entry?.previous);
          return Number.isFinite(numeric) ? numeric : null;
        })(),
        format: entry?.format ?? 'number'
      }))
      .filter((entry) => entry.label);
  };

  const meta = {
    title: rawMeta.title || fallbackTitle,
    subtitle: rawMeta.subtitle || '',
    generatedAt: toDateTimeString(rawMeta.generatedAt)
  };

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);

  // Clone the target element into an off-screen staging area and strip filters
  const staging = document.createElement('div');
  const rect = targetElement.getBoundingClientRect();
  const widthPx = Math.ceil(rect.width || targetElement.scrollWidth || targetElement.offsetWidth || 1200);
  let heightPx = Math.ceil(rect.height || targetElement.scrollHeight || targetElement.offsetHeight || 600);

  staging.style.position = 'fixed';
  staging.style.left = '-100000px';
  staging.style.top = '0';
  staging.style.width = `${widthPx}px`;
  staging.style.height = `${heightPx}px`;
  staging.style.pointerEvents = 'none';
  staging.style.opacity = '1';
  staging.style.background = '#ffffff';
  staging.style.overflow = 'hidden';
  staging.style.zIndex = '-1';

  const clone = targetElement.cloneNode(true);
  clone.style.margin = '0';
  clone.style.width = `${widthPx}px`;
  clone.style.height = `${heightPx}px`;
  clone.style.maxWidth = 'none';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'hidden';

  // Remove any filter or control elements marked for exclusion
  Array.from(clone.querySelectorAll('[data-export-exclude]')).forEach((el) => el.remove());

  staging.appendChild(clone);
  document.body.appendChild(staging);

  if (selectedIds.size) {
    removeUnselectedSections(clone, selectedIds);
    cleanupEmptyContainers(clone);
    adjustGridLayouts(clone);
  }

  if (selectedIds.size && !clone.querySelector('[data-export-section]')) {
    if (staging.parentNode) staging.parentNode.removeChild(staging);
    alert('The selected charts are not ready to export yet. Please ensure they are visible and try again.');
    return;
  }

  const adjustedHeight = Math.ceil(clone.scrollHeight || heightPx);
  heightPx = Math.max(adjustedHeight, 200);
  staging.style.height = `${heightPx}px`;
  clone.style.height = `${heightPx}px`;

  let canvas;
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      logging: false,
      width: widthPx,
      height: heightPx,
      windowWidth: widthPx,
      windowHeight: heightPx,
      scrollX: 0,
      scrollY: 0,
      allowTaint: true,
      foreignObjectRendering: false,
      imageTimeout: 20000
    });
  } catch (error) {
    console.error('Error capturing analytics view:', error);
    alert('Unable to export the analytics view. Please try again.');
    if (staging.parentNode) staging.parentNode.removeChild(staging);
    return;
  } finally {
    if (staging.parentNode) staging.parentNode.removeChild(staging);
  }

  // Title/header above the screenshot
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(meta.title, margin, margin + 4);
  if (meta.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(meta.subtitle, margin, margin + 10);
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Generated ${meta.generatedAt}`, margin, margin + 16);

  const availableHeight = pageHeight - (margin + 20); // space for header
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const imgRatio = imgWidth && imgHeight ? imgWidth / imgHeight : 1;

  let renderWidth = contentWidth;
  let renderHeight = renderWidth / imgRatio;
  if (renderHeight > availableHeight) {
    renderHeight = availableHeight;
    renderWidth = renderHeight * imgRatio;
    if (renderWidth > contentWidth) {
      renderWidth = contentWidth;
      renderHeight = renderWidth / imgRatio;
    }
  }

  const x = margin + (contentWidth - renderWidth) / 2;
  const y = margin + 22; // below header text

  pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', x, y, renderWidth, renderHeight, undefined, 'SLOW');
  pdf.save(filename);
};

const PX_TO_MM = 0.264583;

export const exportElementAsPDF = async (element, filename = 'record.pdf') => {
  if (!element) {
    console.warn('exportElementAsPDF: No element provided');
    return;
  }

  const excludedElements = Array.from(element.querySelectorAll('[data-export-exclude]'));
  const previousDisplays = excludedElements.map(el => el.style.display);

  const restoreExcluded = () => {
    excludedElements.forEach((el, index) => {
      const prev = previousDisplays[index];
      if (prev) {
        el.style.display = prev;
      } else {
        el.style.removeProperty('display');
      }
    });
  };

  try {
    excludedElements.forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });

    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidthMm = canvas.width * PX_TO_MM;
    const imgHeightMm = canvas.height * PX_TO_MM;
    const maxWidth = pageWidth - 20; // 10mm margin either side
    const maxHeight = pageHeight - 20; // 10mm top/bottom margin
    const scale = Math.min(maxWidth / imgWidthMm, maxHeight / imgHeightMm, 1);

    const renderWidth = imgWidthMm * scale;
    const renderHeight = imgHeightMm * scale;
    const x = (pageWidth - renderWidth) / 2;
    const y = 10;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight);
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } catch (error) {
    console.error('Error exporting element as PDF:', error);
    alert('Unable to export the document. Please try again.');
  } finally {
    restoreExcluded();
  }
};
