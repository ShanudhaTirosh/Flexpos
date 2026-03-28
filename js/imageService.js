// ============================================================
// FlexPOS — ImageService
// Client-side Canvas compression → Base64 storage in Firestore
// No Firebase Storage used
// ============================================================

const MAX_FILE_SIZE   = 2 * 1024 * 1024; // 2MB input limit
const TARGET_MAX_BYTES = 100 * 1024;      // 100KB output target
const MAX_DIMENSION   = 512;             // px

export const ImageService = {

  // ── Validate and compress a File object ──
  async compressFile(file) {
    if (!file) throw new Error('No file provided');
    if (!file.type.startsWith('image/')) throw new Error('File must be an image');
    if (file.size > MAX_FILE_SIZE) throw new Error('Image must be under 2MB');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const base64 = this._compress(img);
            resolve(base64);
          } catch (err) { reject(err); }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  // ── Compress an HTMLImageElement to Base64 ──
  _compress(img) {
    let width  = img.naturalWidth;
    let height = img.naturalHeight;

    // Scale down if too large
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
    }

    const canvas  = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // Try quality levels until under target size
    let quality = 0.85;
    let base64  = canvas.toDataURL('image/jpeg', quality);

    while (base64.length > TARGET_MAX_BYTES * 1.37 && quality > 0.15) {
      quality -= 0.1;
      base64   = canvas.toDataURL('image/jpeg', quality);
    }

    return base64;
  },

  // ── Compress from a dataURL (e.g., from drag-drop preview) ──
  async compressDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => { try { resolve(this._compress(img)); } catch (e) { reject(e); } };
      img.onerror = () => reject(new Error('Failed to load dataURL'));
      img.src = dataURL;
    });
  },

  // ── Estimate Base64 size in bytes ──
  estimateSize(base64) {
    const len = (base64.split(',')[1] || base64).length;
    return Math.round(len * 0.75);
  },

  // ── Human-readable size ──
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  // ── Wire up an upload zone element ──
  initUploadZone(zoneEl, previewEl, onBase64) {
    if (!zoneEl) return;

    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    zoneEl.appendChild(input);

    zoneEl.addEventListener('click', () => input.click());

    zoneEl.addEventListener('dragover', e => {
      e.preventDefault();
      zoneEl.classList.add('drag-over');
    });
    zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('drag-over'));
    zoneEl.addEventListener('drop', async e => {
      e.preventDefault();
      zoneEl.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) await this._handleFile(file, previewEl, onBase64, zoneEl);
    });

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (file) await this._handleFile(file, previewEl, onBase64, zoneEl);
      input.value = '';
    });
  },

  async _handleFile(file, previewEl, onBase64, zoneEl) {
    try {
      const base64 = await this.compressFile(file);
      const sizeKB  = (this.estimateSize(base64) / 1024).toFixed(1);

      if (previewEl) {
        previewEl.src   = base64;
        previewEl.style.display = 'block';
      }
      if (zoneEl) {
        const hint = zoneEl.querySelector('.upload-hint');
        if (hint) hint.textContent = `Image compressed to ${sizeKB} KB`;
      }
      if (onBase64) onBase64(base64);
    } catch (err) {
      console.error('ImageService error:', err);
      window.Toast?.error(err.message || 'Image processing failed');
    }
  }
};

export default ImageService;
