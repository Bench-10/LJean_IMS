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

// SIMPLE PDF EXPORT - NO COMPLEX TABLES, JUST TEXT
export const exportToPDF = (data, filename, options = {}) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const { title = filename, customHeaders = null, dataKeys = null } = options;

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
  const keys = dataKeys || Object.keys(data[0]);
  const colCount = keys.length;
  const colWidth = (pageWidth - margin * 2) / colCount;


  // GET HEADERS AND FORMAT THEM
  const formattedHeaders = customHeaders || keys.map(h => h.replace(/_/g, ' ').toUpperCase());

  
  // START TABLE AT Y=40
  let yPosition = 45;
  const lineHeight = 6;
  const pageHeight = pdf.internal.pageSize.height;

  // DRAW HEADERS
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  let xPosition = margin;
  formattedHeaders.forEach(header => {
    pdf.text(header, xPosition, yPosition);
    xPosition += colWidth;
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
      formattedHeaders.forEach(header => {
        pdf.text(header, xPosition, yPosition);
        xPosition += colWidth;
      });

      // DRAW THICK LINE BELOW HEADERS ON NEW PAGE
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);

      yPosition += lineHeight;
      pdf.setFont('helvetica', 'normal');
    }

    xPosition = margin;
    keys.forEach(key => {
      let value = row[key];
      if (value === null || value === undefined) value = '';
      // LIMIT TEXT LENGTH EXCEPT FOR DATES
      if (typeof value === 'string' && value.length > 15 && !key.toLowerCase().includes('date')) {
        value = value.substring(0, 15) + '...';
      }
      pdf.text(String(value), xPosition, yPosition);
      xPosition += colWidth;
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


// MULTI-CHART PDF EXPORT WITH DASHBOARD LAYOUT PRESERVATION
export const exportChartsAsPDF = async (chartRefs = [], filename = 'analytics-report.pdf', chartIds = []) => {
  if (!chartRefs || chartRefs.length === 0) {
    alert('No charts selected for export');
    return;
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // CAPTURE ALL CHARTS FIRST WITH METADATA
  const capturedCharts = [];
  
  for (let i = 0; i < chartRefs.length; i++) {
    const chartRef = chartRefs[i];
    const chartId = chartIds[i] || `chart-${i}`;
    
    if (!chartRef || !chartRef.current) continue;

    const containerNode = chartRef.current;
    const excludedElements = Array.from(containerNode.querySelectorAll('[data-export-exclude]'));
    const previousDisplays = excludedElements.map(element => element.style.display);
    const restoreExcludedElements = () => {
      excludedElements.forEach((element, index) => {
        const previousDisplay = previousDisplays[index];
        if (previousDisplay) {
          element.style.display = previousDisplay;
        } else {
          element.style.removeProperty('display');
        }
      });
    };

    try {
      // HIDE EXCLUDED ELEMENTS
      excludedElements.forEach(element => {
        element.style.setProperty('display', 'none', 'important');
      });

      // CAPTURE CHART AS IMAGE
      const canvas = await html2canvas(containerNode, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });

      restoreExcludedElements();

      const imgData = canvas.toDataURL('image/png');
      capturedCharts.push({
        id: chartId,
        data: imgData,
        width: canvas.width,
        height: canvas.height
      });

    } catch (error) {
      restoreExcludedElements();
      console.error('Error capturing chart:', error);
    }
  }

  if (capturedCharts.length === 0) {
    alert('No charts were successfully captured');
    return;
  }

  // ADD PROFESSIONAL HEADER
  const addHeader = (pageNum, totalPages) => {
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55); // gray-800
    pdf.text('Analytics Report', 15, 15);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128); // gray-500
    const dateStr = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    pdf.text(`Generated: ${dateStr}`, 15, 21);
    
    // PAGE NUMBER
    pdf.setTextColor(156, 163, 175); // gray-400
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 15, 15, { align: 'right' });
    
    // SEPARATOR LINE
    pdf.setDrawColor(229, 231, 235); // gray-200
    pdf.setLineWidth(0.5);
    pdf.line(15, 24, pageWidth - 15, 24);
  };

  addHeader(1, 1);

  // LAYOUT TO MATCH DASHBOARD INTERFACE
  const margin = 12;
  const headerSpace = 28;
  const gap = 6;
  
  let yPosition = headerSpace;
  
  // FIND KPI CHART
  const kpiChart = capturedCharts.find(c => c.id === 'kpi-summary');
  const otherCharts = capturedCharts.filter(c => c.id !== 'kpi-summary');
  
  // 1. RENDER KPI SUMMARY AT TOP (FULL WIDTH, SHORT HEIGHT)
  if (kpiChart) {
    const availableWidth = pageWidth - (margin * 2);
    const kpiHeight = 25; // Fixed height for KPI row
    
    const imgRatio = kpiChart.width / kpiChart.height;
    let imgWidth = availableWidth;
    let imgHeight = imgWidth / imgRatio;
    
    // Scale to fit fixed height
    if (imgHeight > kpiHeight) {
      imgHeight = kpiHeight;
      imgWidth = imgHeight * imgRatio;
    }
    
    const xPos = margin + (availableWidth - imgWidth) / 2;
    pdf.addImage(kpiChart.data, 'PNG', xPos, yPosition, imgWidth, imgHeight);
    
    yPosition += kpiHeight + gap;
  }
  
  // 2. RENDER CHARTS BELOW IN DASHBOARD LAYOUT
  if (otherCharts.length > 0) {
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - yPosition - margin;
    
    // CHECK IF WE HAVE THE TYPICAL DASHBOARD LAYOUT (TOP PRODUCTS + SALES PERFORMANCE)
    const topProductsChart = otherCharts.find(c => c.id === 'top-products');
    const salesChart = otherCharts.find(c => c.id === 'sales-performance');
    
    // CHECK FOR BRANCH ANALYTICS LAYOUT (BRANCH PERFORMANCE + REVENUE DISTRIBUTION + BRANCH TIMELINE)
    const branchPerformanceChart = otherCharts.find(c => c.id === 'branch-performance');
    const revenueDistributionChart = otherCharts.find(c => c.id === 'revenue-distribution');
    const branchTimelineChart = otherCharts.find(c => c.id === 'branch-timeline');
    
    if (branchPerformanceChart && revenueDistributionChart && branchTimelineChart) {
      // BRANCH ANALYTICS LAYOUT: TOP ROW (PERFORMANCE + PIE) + BOTTOM ROW (TIMELINE)
      const topRowHeight = availableHeight * 0.45;
      const bottomRowHeight = availableHeight * 0.55 - gap;
      
      // TOP LEFT: BRANCH PERFORMANCE (67% width)
      const perfWidth = availableWidth * 0.67;
      const perfRatio = branchPerformanceChart.width / branchPerformanceChart.height;
      let perfImgWidth = perfWidth;
      let perfImgHeight = perfImgWidth / perfRatio;
      
      if (perfImgHeight > topRowHeight) {
        perfImgHeight = topRowHeight;
        perfImgWidth = perfImgHeight * perfRatio;
      }
      
      pdf.addImage(branchPerformanceChart.data, 'PNG', margin, yPosition, perfImgWidth, perfImgHeight);
      
      // TOP RIGHT: REVENUE DISTRIBUTION (33% width)
      const pieWidth = availableWidth * 0.33 - gap;
      const pieRatio = revenueDistributionChart.width / revenueDistributionChart.height;
      let pieImgWidth = pieWidth;
      let pieImgHeight = pieImgWidth / pieRatio;
      
      if (pieImgHeight > topRowHeight) {
        pieImgHeight = topRowHeight;
        pieImgWidth = pieImgHeight * pieRatio;
      }
      
      const pieXPos = margin + perfWidth + gap;
      pdf.addImage(revenueDistributionChart.data, 'PNG', pieXPos, yPosition, pieImgWidth, pieImgHeight);
      
      // BOTTOM: BRANCH TIMELINE (FULL WIDTH)
      const timelineYPos = yPosition + topRowHeight + gap;
      const timelineRatio = branchTimelineChart.width / branchTimelineChart.height;
      let timelineImgWidth = availableWidth;
      let timelineImgHeight = timelineImgWidth / timelineRatio;
      
      if (timelineImgHeight > bottomRowHeight) {
        timelineImgHeight = bottomRowHeight;
        timelineImgWidth = timelineImgHeight * timelineRatio;
      }
      
      const timelineXPos = margin + (availableWidth - timelineImgWidth) / 2;
      pdf.addImage(branchTimelineChart.data, 'PNG', timelineXPos, timelineYPos, timelineImgWidth, timelineImgHeight);
      
    } else if (topProductsChart && salesChart) {
      // DASHBOARD LAYOUT: LEFT COLUMN (TOP PRODUCTS) + RIGHT COLUMN (SALES PERFORMANCE)
      // Top Products takes ~33% width, Sales Performance takes ~67% width
      const leftWidth = availableWidth * 0.33;
      const rightWidth = availableWidth * 0.67 - gap;
      
      // LEFT: TOP PRODUCTS (TALL)
      const leftRatio = topProductsChart.width / topProductsChart.height;
      let leftImgWidth = leftWidth;
      let leftImgHeight = leftImgWidth / leftRatio;
      
      if (leftImgHeight > availableHeight) {
        leftImgHeight = availableHeight;
        leftImgWidth = leftImgHeight * leftRatio;
      }
      
      pdf.addImage(topProductsChart.data, 'PNG', margin, yPosition, leftImgWidth, leftImgHeight);
      
      // RIGHT: SALES PERFORMANCE (TALL)
      const rightRatio = salesChart.width / salesChart.height;
      let rightImgWidth = rightWidth;
      let rightImgHeight = rightImgWidth / rightRatio;
      
      if (rightImgHeight > availableHeight) {
        rightImgHeight = availableHeight;
        rightImgWidth = rightImgHeight * rightRatio;
      }
      
      const rightXPos = margin + leftWidth + gap;
      pdf.addImage(salesChart.data, 'PNG', rightXPos, yPosition, rightImgWidth, rightImgHeight);
      
    } else {
      // FALLBACK: ARRANGE OTHER CHARTS IN GRID
      const cols = otherCharts.length === 1 ? 1 : 2;
      const rows = Math.ceil(otherCharts.length / cols);
      
      const cellWidth = cols === 1 ? availableWidth : (availableWidth - gap) / 2;
      const cellHeight = (availableHeight - (gap * (rows - 1))) / rows;
      
      otherCharts.forEach((chart, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const xStart = margin + (col * (cellWidth + gap));
        const yStart = yPosition + (row * (cellHeight + gap));
        
        const imgRatio = chart.width / chart.height;
        
        let imgWidth = cellWidth;
        let imgHeight = imgWidth / imgRatio;
        
        if (imgHeight > cellHeight) {
          imgHeight = cellHeight;
          imgWidth = imgHeight * imgRatio;
        }
        
        const xPos = xStart + (cellWidth - imgWidth) / 2;
        const yPos = yStart + (cellHeight - imgHeight) / 2;
        
        pdf.addImage(chart.data, 'PNG', xPos, yPos, imgWidth, imgHeight);
      });
    }
  }

  pdf.save(filename);
};