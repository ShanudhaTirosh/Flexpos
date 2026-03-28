// ============================================================
// FlexPOS — BarcodeService
// EAN-13 generation + JsBarcode rendering + QRCode.js
// ============================================================

export const BarcodeService = {

  // ── Generate a valid EAN-13 barcode number ──
  generateEAN13() {
    // First 12 digits (random, starting with country prefix 200 for internal)
    const digits = [2, 0, 0];
    for (let i = 0; i < 9; i++) digits.push(Math.floor(Math.random() * 10));

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    digits.push(check);

    return digits.join('');
  },

  // ── Render barcode onto a canvas element ──
  renderBarcode(canvasEl, value, options = {}) {
    if (!canvasEl || !value) return;
    if (typeof JsBarcode === 'undefined') {
      console.warn('JsBarcode not loaded');
      return;
    }
    try {
      JsBarcode(canvasEl, value, {
        format:      'EAN13',
        lineColor:   options.color   || 'currentColor',
        width:       options.width   || 2,
        height:      options.height  || 60,
        displayValue: true,
        fontSize:    12,
        margin:      10,
        background:  'transparent',
        ...options
      });
    } catch (err) {
      console.error('Barcode render error:', err, value);
    }
  },

  // ── Render to an <svg> element ──
  renderBarcodeSVG(svgEl, value, options = {}) {
    if (!svgEl || !value) return;
    if (typeof JsBarcode === 'undefined') return;
    try {
      JsBarcode(svgEl, value, {
        format: 'EAN13',
        lineColor: '#000',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 8,
        ...options
      });
    } catch (err) {
      console.error('Barcode SVG error:', err);
    }
  },

  // ── Render QR code into a container element ──
  renderQR(containerEl, data, size = 140) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      console.warn('QRCode.js not loaded');
      containerEl.textContent = data;
      return;
    }
    new QRCode(containerEl, {
      text:           typeof data === 'object' ? JSON.stringify(data) : String(data),
      width:          size,
      height:         size,
      colorDark:      '#000000',
      colorLight:     '#ffffff',
      correctLevel:   QRCode.CorrectLevel.M
    });
  },

  // ── Print a barcode card ──
  printBarcodeCard(product) {
    const win = window.open('', '_blank', 'width=400,height=300');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode - ${product.name}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 20px; }
          h3 { font-size: 14px; margin-bottom: 4px; }
          p { font-size: 11px; color: #666; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <h3>${product.name}</h3>
        <p>${product.category || ''} &bull; $${Number(product.price).toFixed(2)}</p>
        <canvas id="bc"></canvas>
        <script>
          window.onload = () => {
            JsBarcode('#bc', '${product.barcode}', {
              format: 'EAN13', width: 2, height: 60, displayValue: true
            });
            window.print();
            window.close();
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  },

  // ── Validate EAN-13 checksum ──
  validateEAN13(code) {
    if (!code || code.length !== 13) return false;
    const digits = code.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === digits[12];
  }
};

export default BarcodeService;
