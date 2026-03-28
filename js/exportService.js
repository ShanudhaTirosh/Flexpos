// ============================================================
// FlexPOS — ExportService
// PDF export via jsPDF + CSV/XLSX export via SheetJS
// ============================================================

export const ExportService = {

  // ── Export to CSV ──
  toCSV(data, filename = 'export.csv') {
    if (!data || !data.length) { window.Toast?.warning('No data to export'); return; }
    if (typeof XLSX === 'undefined') {
      // Fallback: pure CSV
      const headers = Object.keys(data[0]).join(',');
      const rows    = data.map(row =>
        Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      this._downloadText(headers + '\n' + rows, filename, 'text/csv');
      return;
    }
    const ws  = XLSX.utils.json_to_sheet(data);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
  },

  // ── Export to XLSX ──
  toXLSX(data, filename = 'export.xlsx', sheetName = 'Data') {
    if (!data || !data.length) { window.Toast?.warning('No data to export'); return; }
    if (typeof XLSX === 'undefined') { console.warn('SheetJS not loaded'); return; }
    const ws  = XLSX.utils.json_to_sheet(data);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  },

  // ── Export table to PDF ──
  toPDF({ title, subtitle, columns, rows, filename = 'report.pdf', chartCanvas = null }) {
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      console.warn('jsPDF not loaded');
      window.Toast?.error('PDF library not available');
      return;
    }

    const { jsPDF: _jsPDF } = window.jspdf || {};
    const PDFClass = _jsPDF || window.jsPDF;
    const doc = new PDFClass({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    let y = 18;

    // Header bar
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageW, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FlexPOS Report', 10, 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(new Date().toLocaleDateString(), pageW - 10, 8.5, { align: 'right' });

    // Title
    y = 22;
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title || 'Report', 10, y);
    y += 5;

    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 120);
      doc.text(subtitle, 10, y);
      y += 6;
    }

    // Chart image
    if (chartCanvas) {
      try {
        const imgData = chartCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, y, 120, 60);
        y += 68;
      } catch (_) {}
    }

    // Table
    if (columns && rows && rows.length) {
      const colWidth = (pageW - 20) / columns.length;
      const rowH     = 7;

      // Header
      doc.setFillColor(240, 240, 250);
      doc.rect(10, y, pageW - 20, rowH, 'F');
      doc.setTextColor(60, 60, 80);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      columns.forEach((col, i) => {
        doc.text(String(col), 12 + i * colWidth, y + 5);
      });
      y += rowH;

      // Rows
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 60);
      rows.forEach((row, ri) => {
        if (y > 185) {
          doc.addPage();
          y = 15;
        }
        if (ri % 2 === 0) {
          doc.setFillColor(248, 248, 252);
          doc.rect(10, y, pageW - 20, rowH, 'F');
        }
        const vals = Array.isArray(row) ? row : columns.map(c => row[c] ?? '');
        vals.forEach((val, i) => {
          doc.text(String(val ?? '').substring(0, 22), 12 + i * colWidth, y + 5);
        });
        y += rowH;
      });
    }

    doc.save(filename);
  },

  // ── Prepare transactions for export ──
  formatTransactions(txns) {
    return txns.map(t => ({
      'Transaction ID': t.id,
      'Date':           t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleString() : '',
      'Customer':       t.customerName || 'Walk-in',
      'Cashier':        t.cashierName  || '',
      'Items':          t.items?.length || 0,
      'Subtotal':       t.subtotal?.toFixed(2),
      'Discount':       t.discount?.toFixed(2),
      'Tax':            t.tax?.toFixed(2),
      'Total':          t.total?.toFixed(2),
      'Payment':        t.paymentMethod,
      'Status':         t.status
    }));
  },

  // ── Prepare products for export ──
  formatProducts(products) {
    return products.map(p => ({
      'Name':      p.name,
      'Category':  p.category,
      'Price':     p.price,
      'Cost':      p.costPrice,
      'Stock':     p.stock,
      'Low Stock': p.lowStockThreshold,
      'Barcode':   p.barcode,
      'Supplier':  p.supplier
    }));
  },

  // ── Download helper ──
  _downloadText(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

export default ExportService;
