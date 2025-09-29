import jsPDF from 'jspdf';

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