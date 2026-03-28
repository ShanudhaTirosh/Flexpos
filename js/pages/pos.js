// ============================================================
// FlexPOS — POS Page Logic
// ============================================================

import { guard }              from '../router.js';
import { buildSidebar, buildTopbar, filterNavByRole } from '../layout.js';
import { initSidebar, startClock } from '../sidebar.js';
import { initTheme }          from '../theme.js';
import { populateSidebarUser } from '../auth.js';
import { Toast, Sound, formatCurrency, getSettingsCache, debounce } from '../utils.js';
import { db }                 from '../firebase-config.js';
import {
  collection, query, where, orderBy, onSnapshot,
  getDocs, doc, getDoc, addDoc, updateDoc,
  serverTimestamp, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

initTheme();
document.getElementById('sidebar-mount').innerHTML = buildSidebar('pos');
document.getElementById('topbar-mount').innerHTML  = buildTopbar('Point of Sale');
initSidebar();
startClock();

const userDoc = await guard();
if (!userDoc) throw new Error('Unauthorized');
populateSidebarUser(userDoc);
filterNavByRole(userDoc.role);

const settings = getSettingsCache();
const TAX_RATE = settings.taxRate || 0;
const TAX_NAME = settings.taxName || 'Tax';

// ── State ──
let allProducts = [];
let categories  = ['all'];
let cartItems   = [];
let selectedCustomer = null;
let orderDiscountVal  = 0;
let orderDiscountType = 'pct'; // 'pct' | 'fixed'
let payMethod = 'cash';

// Load cart from localStorage
try {
  const saved = localStorage.getItem('fp_cart');
  if (saved) cartItems = JSON.parse(saved);
} catch (_) {}

// ── DOM Refs ──
const productGrid = document.getElementById('product-grid');
const cartItemsEl = document.getElementById('cart-items');
const cartTotals  = document.getElementById('cart-totals');
const cartCount   = document.getElementById('cart-count');
const checkoutBtn = document.getElementById('checkout-btn');
const posSearch   = document.getElementById('pos-search');

// ── Load Products (onSnapshot) ──
const unsubProducts = onSnapshot(
  collection(db, 'products'),
  snap => {
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build category tabs
    const cats = ['all', ...new Set(allProducts.map(p => p.category).filter(Boolean))];
    categories = cats;
    const tabsEl = document.getElementById('cat-tabs');
    tabsEl.innerHTML = cats.map(c => `
      <button class="cat-tab ${c === currentCat ? 'active' : ''}" data-cat="${c}">
        <i class="bi ${c === 'all' ? 'bi-grid-3x3' : 'bi-tag'}"></i>
        ${c === 'all' ? 'All' : c}
        <span class="cat-tab-count">${c === 'all' ? allProducts.length : allProducts.filter(p => p.category === c).length}</span>
      </button>`).join('');

    document.querySelectorAll('.cat-tab').forEach(btn =>
      btn.addEventListener('click', () => {
        currentCat = btn.dataset.cat;
        document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProducts();
      })
    );
    renderProducts();
  },
  err => { Toast.error('Failed to load products: ' + err.message); }
);

let currentCat    = 'all';
let searchQuery   = '';

function renderProducts() {
  let filtered = currentCat === 'all'
    ? allProducts
    : allProducts.filter(p => p.category === currentCat);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name?.toLowerCase().includes(q) || p.barcode?.includes(q)
    );
  }

  if (!filtered.length) {
    productGrid.innerHTML = `<div style="grid-column:1/-1"><div class="fp-empty"><i class="bi bi-search fp-empty-icon"></i><div class="fp-empty-title">No products found</div><div class="fp-empty-text">Try a different search or category</div></div></div>`;
    return;
  }

  productGrid.innerHTML = filtered.map(p => {
    const stockClass = p.stock === 0 ? 'stock-empty' : p.stock <= (p.lowStockThreshold || 10) ? 'stock-low' : 'stock-ok';
    const stockLabel = p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`;
    return `<div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}" data-id="${p.id}">
      ${p.imageBase64
        ? `<img class="product-card-img" src="${p.imageBase64}" alt="${p.name}" />`
        : `<div class="product-card-img-placeholder"><i class="bi bi-box-seam"></i></div>`}
      <div class="product-card-name">${p.name}</div>
      <div class="product-card-price">${formatCurrency(p.price)}</div>
      <div class="product-card-stock">
        <span class="stock-dot ${stockClass}"></span>${stockLabel}
      </div>
      <div class="product-add-btn"><i class="bi bi-plus"></i></div>
    </div>`;
  }).join('');

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const product = allProducts.find(p => p.id === card.dataset.id);
      if (product) addToCart(product);
    });
  });
}

// ── Cart Logic ──
function addToCart(product) {
  Sound.beep();
  const existing = cartItems.find(i => i.productId === product.id);
  if (existing) {
    if (existing.qty >= product.stock) { Toast.warning(`Only ${product.stock} in stock`); return; }
    existing.qty++;
  } else {
    cartItems.push({
      productId: product.id,
      name:      product.name,
      price:     product.price,
      stock:     product.stock,
      qty:       1,
      discount:  0,
      discountType: 'pct'
    });
  }
  saveCart();
  renderCart();
  Toast.success(`${product.name} added`, 1200);
}

function removeFromCart(productId) {
  cartItems = cartItems.filter(i => i.productId !== productId);
  saveCart();
  renderCart();
}

function updateQty(productId, newQty) {
  const item = cartItems.find(i => i.productId === productId);
  if (!item) return;
  const qty = parseInt(newQty);
  if (isNaN(qty) || qty <= 0) { removeFromCart(productId); return; }
  if (qty > item.stock) { Toast.warning(`Only ${item.stock} in stock`); return; }
  item.qty = qty;
  saveCart();
  renderCart();
}

function saveCart() {
  try { localStorage.setItem('fp_cart', JSON.stringify(cartItems)); } catch (_) {}
}

function calcTotals() {
  let subtotal    = 0;
  let itemDiscAmt = 0;

  cartItems.forEach(item => {
    const linePrice = item.price * item.qty;
    subtotal += linePrice;
    if (item.discount > 0) {
      itemDiscAmt += item.discountType === 'pct'
        ? linePrice * item.discount / 100
        : Math.min(item.discount * item.qty, linePrice);
    }
  });

  const afterItemDisc = subtotal - itemDiscAmt;
  const orderDisc = orderDiscountType === 'pct'
    ? afterItemDisc * orderDiscountVal / 100
    : Math.min(orderDiscountVal, afterItemDisc);

  const afterDisc = afterItemDisc - orderDisc;
  const tax       = afterDisc * TAX_RATE / 100;
  const grand     = afterDisc + tax;

  return { subtotal, itemDiscAmt, orderDisc, tax, grand };
}

function renderCart() {
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  cartCount.textContent = count;

  if (!cartItems.length) {
    cartItemsEl.innerHTML = `<div class="cart-empty"><i class="bi bi-cart3"></i><span>Cart is empty</span><span style="font-size:.72rem">Select products to start selling</span></div>`;
    cartTotals.style.display = 'none';
    checkoutBtn.disabled = true;
    return;
  }

  cartItemsEl.innerHTML = cartItems.map(item => {
    const lineTotal = item.price * item.qty;
    const discAmt = item.discount > 0
      ? (item.discountType === 'pct' ? lineTotal * item.discount / 100 : item.discount * item.qty)
      : 0;
    const netTotal = lineTotal - discAmt;
    return `<div class="cart-item" data-id="${item.productId}">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatCurrency(item.price)} each</div>
        ${item.discount ? `<div class="cart-item-discount"><i class="bi bi-tag-fill me-1"></i>${item.discountType==='pct' ? item.discount+'%' : formatCurrency(item.discount)} off</div>` : ''}
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" data-action="dec" data-id="${item.productId}"><i class="bi bi-dash"></i></button>
        <input class="qty-input" type="number" value="${item.qty}" min="1" max="${item.stock}" data-id="${item.productId}" />
        <button class="qty-btn" data-action="inc" data-id="${item.productId}"><i class="bi bi-plus"></i></button>
      </div>
      <div class="cart-item-total">${formatCurrency(netTotal)}</div>
      <div class="cart-item-remove" data-id="${item.productId}" title="Remove"><i class="bi bi-x"></i></div>
    </div>`;
  }).join('');

  // Cart item events
  cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const item = cartItems.find(i => i.productId === id);
      if (!item) return;
      if (btn.dataset.action === 'inc') updateQty(id, item.qty + 1);
      else                               updateQty(id, item.qty - 1);
    });
  });
  cartItemsEl.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('change', () => updateQty(input.dataset.id, input.value));
  });
  cartItemsEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });

  // Totals
  cartTotals.style.display = 'block';
  checkoutBtn.disabled = false;

  const t = calcTotals();
  document.getElementById('total-subtotal').textContent   = formatCurrency(t.subtotal);
  document.getElementById('total-item-discount').textContent = `-${formatCurrency(t.itemDiscAmt)}`;
  document.getElementById('total-tax').textContent        = formatCurrency(t.tax);
  document.getElementById('total-grand').textContent      = formatCurrency(t.grand);
  document.getElementById('tax-label').textContent        = `${TAX_NAME} (${TAX_RATE}%)`;
}

// Initial render
renderCart();

// ── Search ──
posSearch.addEventListener('input', debounce(e => {
  searchQuery = e.target.value.trim();
  renderProducts();

  // Barcode: if exactly 13 digits
  if (/^\d{13}$/.test(searchQuery)) {
    const product = allProducts.find(p => p.barcode === searchQuery);
    if (product) {
      addToCart(product);
      posSearch.value = '';
      searchQuery = '';
      renderProducts();
    }
  }
}, 200));

// ── Discount type toggle ──
document.getElementById('disc-pct').addEventListener('click', () => {
  orderDiscountType = 'pct';
  document.getElementById('disc-pct').classList.add('active');
  document.getElementById('disc-fixed').classList.remove('active');
  renderCart();
});
document.getElementById('disc-fixed').addEventListener('click', () => {
  orderDiscountType = 'fixed';
  document.getElementById('disc-fixed').classList.add('active');
  document.getElementById('disc-pct').classList.remove('active');
  renderCart();
});
document.getElementById('order-discount-val').addEventListener('input', e => {
  orderDiscountVal = parseFloat(e.target.value) || 0;
  renderCart();
});

// ── Clear Cart ──
document.getElementById('clear-cart-btn').addEventListener('click', async () => {
  if (!cartItems.length) return;
  const ok = await window.confirm?.({
    title: 'Clear Cart?',
    message: 'All items will be removed.',
    type: 'danger',
    confirmText: 'Clear'
  }) ?? window.confirm('Clear cart?');
  if (!ok) return;
  cartItems = [];
  selectedCustomer = null;
  document.getElementById('customer-chip-text').textContent = 'Add Customer (optional)';
  document.getElementById('customer-chip').className = 'customer-chip';
  document.getElementById('remove-customer-btn').classList.add('d-none');
  saveCart();
  renderCart();
});

// ── Customer Selection ──
const customerModal = new bootstrap.Modal(document.getElementById('customerModal'));
const customerSearch = document.getElementById('customer-search');

document.getElementById('customer-chip').addEventListener('click', e => {
  if (e.target.id === 'remove-customer-btn' || e.target.closest('#remove-customer-btn')) {
    selectedCustomer = null;
    document.getElementById('customer-chip-text').textContent = 'Add Customer (optional)';
    document.getElementById('customer-chip').className = 'customer-chip';
    document.getElementById('remove-customer-btn').classList.add('d-none');
    return;
  }
  customerModal.show();
  loadCustomers();
});

let allCustomers = [];
async function loadCustomers() {
  const snap = await getDocs(collection(db, 'customers'));
  allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCustomerResults('');
}

function renderCustomerResults(q) {
  const filtered = q
    ? allCustomers.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q))
    : allCustomers;

  const el = document.getElementById('customer-results');
  if (!filtered.length) {
    el.innerHTML = `<div class="fp-empty" style="padding:24px"><div class="fp-empty-title">No customers found</div></div>`;
    return;
  }
  el.innerHTML = filtered.slice(0, 20).map(c => `
    <div class="d-flex align-items-center gap-3 p-2 rounded cursor-pointer customer-row" data-id="${c.id}" style="cursor:pointer;border-radius:8px;transition:background .2s">
      <div style="width:36px;height:36px;background:var(--glass-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;color:var(--accent)">
        ${(c.name || 'U')[0].toUpperCase()}
      </div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:.85rem">${c.name}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${c.phone || ''} ${c.email ? '· ' + c.email : ''}</div>
      </div>
      <span class="fp-badge fp-badge-primary"><i class="bi bi-star-fill me-1"></i>${c.loyaltyPoints || 0} pts</span>
    </div>`).join('');

  el.querySelectorAll('.customer-row').forEach(row => {
    row.addEventListener('mouseenter', () => row.style.background = 'var(--glass-bg)');
    row.addEventListener('mouseleave', () => row.style.background = '');
    row.addEventListener('click', () => {
      selectedCustomer = allCustomers.find(c => c.id === row.dataset.id);
      document.getElementById('customer-chip-text').textContent = selectedCustomer.name;
      document.getElementById('customer-chip').className = 'customer-chip has-customer';
      document.getElementById('remove-customer-btn').classList.remove('d-none');
      customerModal.hide();
    });
  });
}

customerSearch.addEventListener('input', debounce(e => renderCustomerResults(e.target.value.trim().toLowerCase()), 200));

// ── Payment Modal ──
const paymentModal  = new bootstrap.Modal(document.getElementById('paymentModal'));
const receiptModal  = new bootstrap.Modal(document.getElementById('receiptModal'));

checkoutBtn.addEventListener('click', () => openPayment());

function openPayment() {
  if (!cartItems.length) return;
  const t = calcTotals();
  document.getElementById('pay-total').textContent = formatCurrency(t.grand);

  // Quick cash amounts
  const grand = t.grand;
  const roundUps = [
    Math.ceil(grand / 5) * 5,
    Math.ceil(grand / 10) * 10,
    Math.ceil(grand / 20) * 20,
    Math.ceil(grand / 50) * 50
  ].filter((v, i, arr) => v >= grand && arr.indexOf(v) === i).slice(0, 4);
  document.getElementById('quick-amounts').innerHTML = roundUps.map(v =>
    `<button class="quick-amt-btn" data-val="${v}">${formatCurrency(v)}</button>`).join('');
  document.querySelectorAll('.quick-amt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('cash-received').value = btn.dataset.val;
      updateChange();
    });
  });

  document.getElementById('cash-received').value = '';
  document.getElementById('change-due').textContent = '$0.00';
  paymentModal.show();
}

// Cash change calc
document.getElementById('cash-received').addEventListener('input', updateChange);
function updateChange() {
  const t = calcTotals();
  const received = parseFloat(document.getElementById('cash-received').value) || 0;
  const change   = received - t.grand;
  const el = document.getElementById('change-due');
  el.textContent = formatCurrency(Math.max(0, change));
  el.style.color  = change < 0 ? 'var(--danger)' : 'var(--success)';
}

// Payment tabs
['cash', 'card', 'digital'].forEach(method => {
  document.getElementById(`pay-${method}-tab`).addEventListener('click', e => {
    e.preventDefault();
    payMethod = method;
    ['cash', 'card', 'digital'].forEach(m => {
      document.getElementById(`pay-${m}-tab`).classList.toggle('active', m === method);
      document.getElementById(`pay-panel-${m}`).classList.toggle('d-none', m !== method);
    });
  });
});

// ── Complete Sale ──
document.getElementById('complete-payment-btn').addEventListener('click', async () => {
  const t = calcTotals();
  const btn = document.getElementById('complete-payment-btn');

  if (payMethod === 'cash') {
    const received = parseFloat(document.getElementById('cash-received').value) || 0;
    if (received < t.grand) { Toast.error('Insufficient cash received'); return; }
  }

  // Validate stock
  for (const item of cartItems) {
    const prodDoc = allProducts.find(p => p.id === item.productId);
    if (!prodDoc || prodDoc.stock < item.qty) {
      Toast.error(`Insufficient stock for "${item.name}"`);
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="fp-spinner mx-auto" style="width:18px;height:18px;border-width:2px"></div>';

  try {
    const cashReceived = payMethod === 'cash'
      ? parseFloat(document.getElementById('cash-received').value) || 0 : 0;
    const reference = payMethod === 'card'
      ? document.getElementById('card-ref').value
      : document.getElementById('digital-ref').value;

    const txnData = {
      items: cartItems.map(i => ({
        productId:    i.productId,
        name:         i.name,
        qty:          i.qty,
        price:        i.price,
        discount:     i.discount || 0,
        discountType: i.discountType || 'pct'
      })),
      subtotal:      t.subtotal,
      itemDiscount:  t.itemDiscAmt,
      discount:      t.orderDisc,
      tax:           t.tax,
      total:         t.grand,
      paymentMethod: payMethod,
      cashReceived:  cashReceived,
      change:        Math.max(0, cashReceived - t.grand),
      reference:     reference || '',
      customerId:    selectedCustomer?.id    || null,
      customerName:  selectedCustomer?.name  || null,
      cashierId:     userDoc.uid,
      cashierName:   userDoc.name,
      status:        'completed',
      createdAt:     serverTimestamp()
    };

    // Write transaction + update stock in batch
    const batch = writeBatch(db);

    const txnRef = doc(collection(db, 'transactions'));
    batch.set(txnRef, txnData);

    cartItems.forEach(item => {
      batch.update(doc(db, 'products', item.productId), {
        stock:     increment(-item.qty),
        updatedAt: serverTimestamp()
      });
    });

    // Update customer loyalty + spending
    if (selectedCustomer?.id) {
      const loyaltyPts = Math.floor(t.grand);
      batch.update(doc(db, 'customers', selectedCustomer.id), {
        loyaltyPoints: increment(loyaltyPts),
        totalSpent:    increment(t.grand)
      });
    }

    await batch.commit();

    Sound.chime();
    paymentModal.hide();

    // Show receipt
    showReceipt({ ...txnData, id: txnRef.id, cashReceived });

    // Clear cart
    cartItems = [];
    selectedCustomer = null;
    orderDiscountVal = 0;
    document.getElementById('order-discount-val').value = 0;
    document.getElementById('customer-chip-text').textContent = 'Add Customer (optional)';
    document.getElementById('customer-chip').className = 'customer-chip';
    document.getElementById('remove-customer-btn').classList.add('d-none');
    saveCart();
    renderCart();

    Toast.success('Sale completed!');
  } catch (err) {
    Toast.error('Checkout failed: ' + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Complete Sale';
  }
});

// ── Receipt Generation ──
function showReceipt(txn) {
  const bizName = settings.businessName || 'FlexPOS Business';
  const bizAddr = settings.businessAddress || '';
  const footer  = settings.receiptFooter || 'Thank you for your purchase!';
  const date    = new Date().toLocaleString();

  const html = `<div class="receipt-wrapper">
    <div class="receipt-header">
      <div class="receipt-biz-name">${bizName}</div>
      ${bizAddr ? `<div>${bizAddr}</div>` : ''}
      <div>${date}</div>
    </div>
    <hr class="receipt-divider" />
    <div class="receipt-row"><span>Receipt #:</span><span>${txn.id?.slice(-8).toUpperCase()}</span></div>
    <div class="receipt-row"><span>Cashier:</span><span>${txn.cashierName}</span></div>
    ${txn.customerName ? `<div class="receipt-row"><span>Customer:</span><span>${txn.customerName}</span></div>` : ''}
    <hr class="receipt-divider" />
    ${txn.items.map(item => `
      <div class="receipt-item-row">
        <span class="receipt-item-qty">${item.qty}x</span>
        <span class="receipt-item-name">${item.name}</span>
        <span class="receipt-item-price">${formatCurrency(item.price * item.qty)}</span>
      </div>`).join('')}
    <hr class="receipt-divider" />
    <div class="receipt-totals">
      <div class="receipt-row"><span>Subtotal:</span><span>${formatCurrency(txn.subtotal)}</span></div>
      ${txn.discount > 0 ? `<div class="receipt-row"><span>Discount:</span><span>-${formatCurrency(txn.discount)}</span></div>` : ''}
      ${txn.tax > 0 ? `<div class="receipt-row"><span>${TAX_NAME} (${TAX_RATE}%):</span><span>${formatCurrency(txn.tax)}</span></div>` : ''}
      <div class="receipt-row receipt-grand"><span>TOTAL:</span><span>${formatCurrency(txn.total)}</span></div>
      <div class="receipt-row"><span>Payment:</span><span>${txn.paymentMethod}</span></div>
      ${txn.cashReceived > 0 ? `<div class="receipt-row"><span>Received:</span><span>${formatCurrency(txn.cashReceived)}</span></div>` : ''}
      ${txn.change > 0 ? `<div class="receipt-row"><span>Change:</span><span>${formatCurrency(txn.change)}</span></div>` : ''}
    </div>
    <hr class="receipt-divider" />
    <div class="receipt-footer">${footer}</div>
  </div>`;

  document.getElementById('receipt-content').innerHTML = html;
  receiptModal.show();
}

document.getElementById('print-receipt-btn').addEventListener('click', () => window.print());

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (e.key === 'F2') {
    e.preventDefault();
    posSearch.focus();
    posSearch.select();
  } else if (e.key === 'F4') {
    e.preventDefault();
    if (!checkoutBtn.disabled) openPayment();
  } else if (e.key === 'F8') {
    e.preventDefault();
    document.getElementById('clear-cart-btn').click();
  } else if (e.key === 'Escape') {
    paymentModal.hide();
    receiptModal.hide();
    customerModal.hide();
  }
});

// F2 focus on search when in the search field (Enter = add first result)
posSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const visible = productGrid.querySelectorAll('.product-card:not(.out-of-stock)');
    if (visible.length) visible[0].click();
  }
});
