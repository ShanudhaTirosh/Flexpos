// ============================================================
// FlexPOS — Products Page
// ============================================================

import { guard }              from '../router.js';
import { buildSidebar, buildTopbar, filterNavByRole } from '../layout.js';
import { initSidebar, startClock } from '../sidebar.js';
import { initTheme }          from '../theme.js';
import { populateSidebarUser } from '../auth.js';
import { Toast, confirm, formatCurrency, formatDateTime, Paginator, debounce } from '../utils.js';
import { ExportService }      from '../exportService.js';
import { BarcodeService }     from '../barcodeService.js';
import { ImageService }       from '../imageService.js';
import { db }                 from '../firebase-config.js';
import {
  collection, query, orderBy, onSnapshot,
  doc, addDoc, updateDoc, deleteDoc,
  getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

initTheme();
document.getElementById('sidebar-mount').innerHTML = buildSidebar('products');
document.getElementById('topbar-mount').innerHTML  = buildTopbar('Products', 'Catalog management');
initSidebar();
startClock();

const userDoc = await guard();
if (!userDoc) throw new Error('Unauthorized');
populateSidebarUser(userDoc);
filterNavByRole(userDoc.role);

// ── State ──
let allProducts = [];
let sortField   = 'name';
let sortDir     = 1;
let editingId   = null;
let currentImageBase64 = null;

const paginator = new Paginator({ perPage: 25, onRender: renderTable });

// ── DOM Refs ──
const tbody         = document.getElementById('products-tbody');
const searchInput   = document.getElementById('product-search');
const filterCat     = document.getElementById('filter-category');
const filterStock   = document.getElementById('filter-stock');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawer        = document.getElementById('product-drawer');

// ── Real-time product listener ──
onSnapshot(collection(db, 'products'), snap => {
  allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  refreshFilters();
  applyFilters();
}, err => Toast.error('Failed to load products'));

function refreshFilters() {
  const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  const current = filterCat.value;
  filterCat.innerHTML = `<option value="">All Categories</option>` +
    cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
  // Category datalist for drawer
  document.getElementById('category-datalist').innerHTML =
    cats.map(c => `<option value="${c}">`).join('');
}

function applyFilters() {
  const q   = searchInput.value.toLowerCase();
  const cat = filterCat.value;
  const stk = filterStock.value;

  let filtered = allProducts.filter(p => {
    const matchQ = !q || p.name?.toLowerCase().includes(q) || p.barcode?.includes(q) || p.supplier?.toLowerCase().includes(q);
    const matchC = !cat || p.category === cat;
    const matchS = !stk ||
      (stk === 'low'  && p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)) ||
      (stk === 'out'  && p.stock === 0);
    return matchQ && matchC && matchS;
  });

  // Sort
  filtered.sort((a, b) => {
    const av = a[sortField] ?? '';
    const bv = b[sortField] ?? '';
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
  });

  document.getElementById('product-count-badge').textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  paginator.setData(filtered);
  paginator.render();
  paginator.renderControls('products-pagination');
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="fp-empty"><i class="bi bi-box-seam fp-empty-icon"></i><div class="fp-empty-title">No products found</div><div class="fp-empty-text">Add your first product to get started</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => {
    const stockCls = p.stock === 0 ? 'fp-badge-danger' : p.stock <= (p.lowStockThreshold || 10) ? 'fp-badge-warning' : 'fp-badge-success';
    const stockLbl = p.stock === 0 ? 'Out of Stock' : p.stock <= (p.lowStockThreshold || 10) ? `Low (${p.stock})` : p.stock;
    return `<tr>
      <td>
        ${p.imageBase64
          ? `<img class="product-thumb" src="${p.imageBase64}" alt="${p.name}" />`
          : `<div class="product-thumb-placeholder"><i class="bi bi-box-seam"></i></div>`}
      </td>
      <td class="td-main">${p.name}</td>
      <td><span class="fp-badge fp-badge-muted">${p.category || '—'}</span></td>
      <td class="td-main">${formatCurrency(p.price)}</td>
      <td><span class="fp-badge ${stockCls}">${stockLbl}</span></td>
      <td style="font-family:monospace;font-size:.75rem">${p.barcode || '—'}</td>
      <td>${p.supplier || '—'}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-glass btn-icon" data-action="edit" data-id="${p.id}" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-glass btn-icon" data-action="barcode" data-id="${p.id}" title="Print Barcode"><i class="bi bi-upc"></i></button>
          <button class="btn btn-danger-glass btn-icon" data-action="delete" data-id="${p.id}" title="Delete"><i class="bi bi-trash3"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Action buttons
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    const id = btn.dataset.id;
    const product = allProducts.find(p => p.id === id);
    if (btn.dataset.action === 'edit')    btn.addEventListener('click', () => openDrawer(product));
    if (btn.dataset.action === 'delete')  btn.addEventListener('click', () => deleteProduct(id, product?.name));
    if (btn.dataset.action === 'barcode') btn.addEventListener('click', () => {
      if (product?.barcode) BarcodeService.printBarcodeCard(product);
      else Toast.warning('No barcode assigned to this product');
    });
  });
}

// ── Sorting ──
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    sortDir = (sortField === field) ? -sortDir : 1;
    sortField = field;
    document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    applyFilters();
  });
});

// ── Search & Filter Events ──
searchInput.addEventListener('input',  debounce(applyFilters, 200));
filterCat.addEventListener('change',   applyFilters);
filterStock.addEventListener('change', applyFilters);

// ── Drawer ──
function openDrawer(product = null) {
  editingId = product?.id || null;
  currentImageBase64 = null;
  document.getElementById('drawer-title').textContent = product ? 'Edit Product' : 'Add Product';

  // Reset form
  ['p-name','p-category','p-supplier','p-price','p-cost','p-stock','p-low-stock','p-barcode'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('product-image').value = '';
  document.getElementById('img-preview').classList.add('d-none');
  document.getElementById('img-upload-zone').querySelector('.upload-hint').textContent = 'Max 2MB · Compressed to <100KB';
  document.getElementById('barcode-preview-wrap').style.display = 'none';
  document.getElementById('qr-preview-wrap').style.display = 'none';

  if (product) {
    document.getElementById('p-name').value      = product.name || '';
    document.getElementById('p-category').value  = product.category || '';
    document.getElementById('p-supplier').value  = product.supplier || '';
    document.getElementById('p-price').value     = product.price || '';
    document.getElementById('p-cost').value      = product.costPrice || '';
    document.getElementById('p-stock').value     = product.stock || 0;
    document.getElementById('p-low-stock').value = product.lowStockThreshold || 10;
    document.getElementById('p-barcode').value   = product.barcode || '';

    if (product.imageBase64) {
      currentImageBase64 = product.imageBase64;
      const preview = document.getElementById('img-preview');
      preview.src = product.imageBase64;
      preview.classList.remove('d-none');
    }
    if (product.barcode) renderBarcodePreview(product.barcode);
  }

  drawerOverlay.classList.add('open');
  drawer.classList.add('open');
}

function closeDrawer() {
  drawerOverlay.classList.remove('open');
  drawer.classList.remove('open');
  editingId = null;
}

document.getElementById('add-product-btn').addEventListener('click', () => openDrawer());
document.getElementById('close-drawer-btn').addEventListener('click', closeDrawer);
document.getElementById('cancel-drawer-btn').addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ── Image Upload ──
ImageService.initUploadZone(
  document.getElementById('img-upload-zone'),
  document.getElementById('img-preview'),
  (base64) => { currentImageBase64 = base64; }
);

// ── Barcode ──
document.getElementById('gen-barcode-btn').addEventListener('click', () => {
  const bc = BarcodeService.generateEAN13();
  document.getElementById('p-barcode').value = bc;
  renderBarcodePreview(bc);
});

document.getElementById('p-barcode').addEventListener('input', debounce(e => {
  const val = e.target.value.trim();
  if (val) renderBarcodePreview(val);
  else document.getElementById('barcode-preview-wrap').style.display = 'none';
}, 400));

function renderBarcodePreview(value) {
  document.getElementById('barcode-preview-wrap').style.display = 'block';
  BarcodeService.renderBarcode(document.getElementById('barcode-canvas'), value, { lineColor: '#6366f1' });
}

document.getElementById('print-barcode-btn').addEventListener('click', () => {
  const name    = document.getElementById('p-name').value;
  const barcode = document.getElementById('p-barcode').value;
  const price   = document.getElementById('p-price').value;
  const cat     = document.getElementById('p-category').value;
  if (!barcode) { Toast.warning('No barcode to print'); return; }
  BarcodeService.printBarcodeCard({ name, barcode, price, category: cat });
});

document.getElementById('show-qr-btn').addEventListener('click', () => {
  const name    = document.getElementById('p-name').value;
  const barcode = document.getElementById('p-barcode').value;
  const price   = document.getElementById('p-price').value;
  const wrap    = document.getElementById('qr-preview-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if (wrap.style.display === 'block') {
    BarcodeService.renderQR(document.getElementById('qr-container'), { name, barcode, price }, 140);
  }
});

// ── Save Product ──
document.getElementById('save-product-btn').addEventListener('click', async () => {
  const name  = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const stock = parseInt(document.getElementById('p-stock').value);

  if (!name)           { Toast.error('Product name is required'); return; }
  if (isNaN(price))    { Toast.error('Price is required'); return; }
  if (isNaN(stock))    { Toast.error('Stock quantity is required'); return; }

  const barcode = document.getElementById('p-barcode').value.trim() || BarcodeService.generateEAN13();

  const data = {
    name,
    category:          document.getElementById('p-category').value.trim(),
    supplier:          document.getElementById('p-supplier').value.trim(),
    price,
    costPrice:         parseFloat(document.getElementById('p-cost').value) || 0,
    stock,
    lowStockThreshold: parseInt(document.getElementById('p-low-stock').value) || 10,
    barcode,
    imageBase64:       currentImageBase64 || null,
    updatedAt:         serverTimestamp()
  };

  const btn = document.getElementById('save-product-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="fp-spinner mx-auto" style="width:16px;height:16px;border-width:2px"></div>';

  try {
    if (editingId) {
      await updateDoc(doc(db, 'products', editingId), data);
      Toast.success('Product updated');
    } else {
      await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      Toast.success('Product added');
    }
    closeDrawer();
  } catch (err) {
    Toast.error('Save failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Save Product';
  }
});

// ── Delete ──
async function deleteProduct(id, name) {
  const ok = await confirm({
    title: 'Delete Product?',
    message: `"${name}" will be permanently removed.`,
    type: 'danger',
    confirmText: 'Delete'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'products', id));
    Toast.success('Product deleted');
  } catch (err) {
    Toast.error('Delete failed: ' + err.message);
  }
}

// ── Export ──
document.getElementById('export-btn').addEventListener('click', () => {
  ExportService.toCSV(ExportService.formatProducts(allProducts), 'products.csv');
  Toast.success('Export started');
});

// ── CSV Import ──
document.getElementById('import-csv-btn').addEventListener('click', () =>
  document.getElementById('csv-file-input').click()
);
document.getElementById('csv-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { Toast.error('SheetJS not loaded'); return; }
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const wb   = XLSX.read(ev.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      let count  = 0;
      for (const row of rows) {
        if (!row.name && !row.Name) continue;
        await addDoc(collection(db, 'products'), {
          name:              row.name || row.Name,
          category:          row.category || row.Category || '',
          price:             parseFloat(row.price || row.Price) || 0,
          costPrice:         parseFloat(row.cost || row.costPrice || row['Cost Price']) || 0,
          stock:             parseInt(row.stock || row.Stock) || 0,
          lowStockThreshold: parseInt(row.lowStock || row['Low Stock']) || 10,
          barcode:           String(row.barcode || row.Barcode || BarcodeService.generateEAN13()),
          supplier:          row.supplier || row.Supplier || '',
          imageBase64:       null,
          createdAt:         serverTimestamp(),
          updatedAt:         serverTimestamp()
        });
        count++;
      }
      Toast.success(`Imported ${count} products`);
    } catch (err) {
      Toast.error('Import failed: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
});
