// ============================================================
// FlexPOS — Toast Notifications & Shared Utilities
// ============================================================

// ── Toast System ──
const TOAST_ICONS = {
  success: 'bi-check-circle-fill',
  error:   'bi-x-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info:    'bi-info-circle-fill'
};

function createToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `fp-toast ${type}`;
  toast.innerHTML = `
    <i class="bi ${TOAST_ICONS[type]} fp-toast-icon"></i>
    <span class="fp-toast-msg">${message}</span>
    <i class="bi bi-x fp-toast-close"></i>
  `;

  toast.querySelector('.fp-toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
  return toast;
}

function dismissToast(toast) {
  toast.classList.add('hiding');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 400);
}

export const Toast = {
  success: (msg, dur) => createToast(msg, 'success', dur),
  error:   (msg, dur) => createToast(msg, 'error',   dur || 5000),
  warning: (msg, dur) => createToast(msg, 'warning', dur),
  info:    (msg, dur) => createToast(msg, 'info',    dur)
};

// Make globally accessible
window.Toast = Toast;

// ── Confirmation Dialog ──
export function confirm(options = {}) {
  return new Promise((resolve) => {
    const {
      title      = 'Are you sure?',
      message    = '',
      confirmText= 'Confirm',
      cancelText = 'Cancel',
      type       = 'danger'
    } = options;

    const iconMap = {
      danger:  { icon: 'bi-trash3-fill',       cls: 'danger' },
      warning: { icon: 'bi-exclamation-triangle-fill', cls: 'warning' },
      success: { icon: 'bi-check-circle-fill',  cls: 'success' }
    };
    const { icon, cls } = iconMap[type] || iconMap.danger;

    let modal = document.getElementById('fp-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'fp-confirm-modal';
      modal.className = 'modal fade';
      modal.setAttribute('tabindex', '-1');
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content text-center">
            <div class="modal-body p-4">
              <div class="fp-confirm-icon mb-3" id="fc-icon-wrap">
                <i class="bi" id="fc-icon"></i>
              </div>
              <h5 class="fw-bold mb-2" id="fc-title"></h5>
              <p class="text-muted mb-4" style="font-size:.875rem" id="fc-msg"></p>
              <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-glass px-4" id="fc-cancel"></button>
                <button class="btn btn-primary px-4" id="fc-confirm"></button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    modal.querySelector('#fc-icon-wrap').className = `fp-confirm-icon ${cls} mb-3`;
    modal.querySelector('#fc-icon').className = `bi ${icon}`;
    modal.querySelector('#fc-title').textContent  = title;
    modal.querySelector('#fc-msg').textContent     = message;
    modal.querySelector('#fc-cancel').textContent  = cancelText;
    modal.querySelector('#fc-confirm').textContent = confirmText;

    const bsModal = new bootstrap.Modal(modal);

    const confirmBtn = modal.querySelector('#fc-confirm');
    const cancelBtn  = modal.querySelector('#fc-cancel');

    const cleanup = (result) => {
      bsModal.hide();
      resolve(result);
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    modal.querySelector('#fc-confirm').addEventListener('click', () => cleanup(true));
    modal.querySelector('#fc-cancel').addEventListener('click', () => cleanup(false));
    modal.addEventListener('hidden.bs.modal', () => resolve(false), { once: true });

    bsModal.show();
  });
}

// ── Currency Formatter ──
export function formatCurrency(amount, settings = null) {
  const cached = settings || JSON.parse(localStorage.getItem('fp_settings_currency') || '{}');
  const symbol = cached.symbol  || '$';
  const dec    = cached.decimal ?? 2;
  return `${symbol}${Number(amount || 0).toFixed(dec)}`;
}

// ── Date Formatters ──
export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function toDateInputValue(ts) {
  if (!ts) return '';
  const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return d.toISOString().split('T')[0];
}

// ── Debounce ──
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Generate ID ──
export function genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Web Audio API sounds ──
export const Sound = {
  _ctx: null,
  _get() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  },
  beep(freq = 880, dur = 0.08, vol = 0.3) {
    try {
      const ctx  = this._get();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type            = 'sine';
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (_) {}
  },
  chime() {
    // Three-note success chime
    setTimeout(() => this.beep(523, 0.1, 0.25), 0);
    setTimeout(() => this.beep(659, 0.1, 0.25), 100);
    setTimeout(() => this.beep(784, 0.15, 0.3),  200);
  },
  error() {
    this.beep(220, 0.2, 0.3);
  }
};

// ── Paginator helper ──
export class Paginator {
  constructor({ data = [], perPage = 25, onRender }) {
    this.allData  = data;
    this.perPage  = perPage;
    this.page     = 1;
    this.onRender = onRender;
  }
  setData(data) { this.allData = data; this.page = 1; this.render(); }
  get totalPages() { return Math.max(1, Math.ceil(this.allData.length / this.perPage)); }
  get pageData()   { const s = (this.page - 1) * this.perPage; return this.allData.slice(s, s + this.perPage); }
  next()  { if (this.page < this.totalPages) { this.page++; this.render(); } }
  prev()  { if (this.page > 1) { this.page--; this.render(); } }
  goTo(n) { this.page = Math.max(1, Math.min(n, this.totalPages)); this.render(); }
  render() {
    if (this.onRender) this.onRender(this.pageData, this.page, this.totalPages, this.allData.length);
  }
  renderControls(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const start = (this.page - 1) * this.perPage + 1;
    const end   = Math.min(this.page * this.perPage, this.allData.length);
    el.innerHTML = `
      <span>Showing ${start}–${end} of ${this.allData.length}</span>
      <div class="fp-pagination-nav">
        <button class="fp-page-btn" onclick="void(0)" id="${containerId}-prev" ${this.page===1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
        <span class="fp-page-btn active" style="pointer-events:none">${this.page} / ${this.totalPages}</span>
        <button class="fp-page-btn" id="${containerId}-next" ${this.page===this.totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
      </div>`;
    el.querySelector(`#${containerId}-prev`)?.addEventListener('click', () => this.prev());
    el.querySelector(`#${containerId}-next`)?.addEventListener('click', () => this.next());
  }
}

// ── Settings cache ──
export function getSettingsCache() {
  try {
    return JSON.parse(localStorage.getItem('fp_settings') || '{}');
  } catch (_) { return {}; }
}
export function saveSettingsCache(data) {
  localStorage.setItem('fp_settings', JSON.stringify(data));
}
