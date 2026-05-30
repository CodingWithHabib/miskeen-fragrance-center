/* ════════════════════════════════════════════════════════════════
   PRODUCTS MODULE — Product Display & Management
════════════════════════════════════════════════════════════════ */

import { STORE, products, showToast } from '../config.js';
import { esc, generateStars, formatCurrency, parseCurrency } from './utils.js';
import { createProduct, modifyProduct, removeProduct, updateProductStock, formatProductForDisplay, generateWhatsAppOrderMessage, processWhatsAppOrder } from './services.js';

let currentFilter  = 'all';
let searchQuery    = '';
let selectedSizes  = {};
let quantities     = {};

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════════════════ */

function initializeProducts() {
  initializeProductFilters();
  initializeSearchFunctionality();
  console.log('✅ Products module initialized');
}

function initializeProductFilters() {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => filterProducts(btn.dataset.category || 'all'));
  });
}

function initializeSearchFunctionality() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      searchQuery = searchInput.value.trim();
      renderAllProducts();
    }, 300));
  }
}

/* ════════════════════════════════════════════════════════════════
   FILTERING & SEARCH
════════════════════════════════════════════════════════════════ */

function filterProducts(category) {
  currentFilter = category;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const cat = btn.dataset.category || btn.getAttribute('data-category') || 'all';
    btn.classList.toggle('active', cat === category);
  });
  renderAllProducts();
}

function handleSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) { searchQuery = searchInput.value.trim(); renderAllProducts(); }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT RENDERING
════════════════════════════════════════════════════════════════ */

const WA_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L.057 23.882l6.221-1.452A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.82 9.82 0 01-5.012-1.373l-.36-.213-3.694.862.879-3.584-.234-.371A9.816 9.816 0 012.182 12C2.182 6.57 6.569 2.182 12 2.182S21.818 6.57 21.818 12 17.431 21.818 12 21.818z"/></svg>`;

function renderProductCard(product) {
  const formatted = formatProductForDisplay(product);
  const safeId    = esc(product.id);

  const imgHTML = formatted.hasImage
    ? `<img src="${esc(formatted.imageUrl)}" alt="${esc(formatted.displayName)}" loading="lazy" decoding="async">`
    : `<div class="pcard-img-ph"><div class="icon">🌺</div><span>${formatted.displayCat}</span></div>`;

  const sizePills = formatted.sizes.length > 0 ? `
    <div class="pcard-sizes" id="pills-${safeId}">
      ${formatted.sizes.map((size, i) => `<button class="sz-pill${i === 0 ? ' active' : ''}" onclick="window.selectSize('${safeId}', ${i}, this)">${esc(size.ml)}</button>`).join('')}
    </div>
    <div class="sz-price-display" id="szprice-${safeId}">${esc(formatted.sizes[0].price)}</div>
    <div class="sz-qty-row">
      <span class="sz-qty-label">QTY</span>
      <div class="sz-qty-ctrl">
        <button class="sz-qty-btn" onclick="window.changeQuantity('${safeId}', -1)" aria-label="Decrease">−</button>
        <div class="sz-qty-num" id="qty-${safeId}">1</div>
        <button class="sz-qty-btn" onclick="window.changeQuantity('${safeId}', +1)" aria-label="Increase">+</button>
      </div>
      <span class="sz-total" id="sztotal-${safeId}">Total: <strong>${esc(formatted.sizes[0].price)}</strong></span>
    </div>` : '';

  return `<div class="pcard" id="pcard-${safeId}">
    ${formatted.displayBadge ? `<div class="pcard-badge">${formatted.displayBadge}</div>` : ''}
    <div class="stock-indicator" id="stock-${safeId}"></div>
    <div class="pcard-img" style="cursor:pointer;" onclick="window.location.href='product.html?id=${safeId}'" title="View details">${imgHTML}</div>
    <div class="pcard-body">
      <div class="pcard-cat">${formatted.displayCat}</div>
      <div class="pcard-name" style="cursor:pointer;" onclick="window.location.href='product.html?id=${safeId}'">${formatted.displayName}</div>
      <div class="pcard-desc">${formatted.displayDesc}</div>
      ${formatted.sizes.length > 0 ? sizePills : `<div class="pcard-footer"><div class="pcard-price">${formatted.displayPrice} <small>/ ${esc(formatted.sizes[0]?.ml || 'N/A')}</small></div></div>`}
      <div style="display:flex;gap:.5rem;margin-top:.5rem;">
        <button class="btn-wa-card" id="order-btn-${safeId}" onclick="window.orderOnWhatsApp('${safeId}')" style="flex:1;">
          ${WA_ICON_SVG} ORDER ON WHATSAPP
        </button>
        <button class="pcard-view-btn" onclick="window.location.href='product.html?id=${safeId}'" title="View full details"
          style="width:42px;border:1.5px solid var(--border);background:transparent;display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;transition:all .2s;flex-shrink:0;"
          onmouseover="this.style.background='var(--forest)';this.style.borderColor='var(--forest)';this.style.color='var(--sand)'"
          onmouseout="this.style.background='transparent';this.style.borderColor='var(--border)';this.style.color='inherit'">
          👁
        </button>
      </div>
    </div>
  </div>`;
}

function renderFeaturedProducts() {
  const container = document.getElementById('featured-grid');
  if (!container) return;

  const featured = products.filter(p => p.featured).slice(0, 4);
  container.innerHTML = featured.length
    ? featured.map(renderProductCard).join('')
    : `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">✨</span><h3>No Featured Products</h3><p>Mark products as featured in the Admin Panel.</p></div>`;

  setTimeout(applyStockIndicators, 0);
}

function renderAllProducts() {
  const container = document.getElementById('all-products-grid');
  if (!container) return;

  let filtered = currentFilter === 'all' ? products : products.filter(p => p.cat === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => (p.name||'').toLowerCase().includes(q) || (p.desc||'').toLowerCase().includes(q) || (p.cat||'').toLowerCase().includes(q));
  }

  container.innerHTML = filtered.length
    ? filtered.map(renderProductCard).join('')
    : `<div class="empty-state" style="grid-column:1/-1;"><span class="empty-icon">🔍</span><h3>No Products Found</h3><p>${searchQuery ? `No results for "${esc(searchQuery)}"` : 'No products in this category yet.'}</p></div>`;

  const countEl = document.getElementById('products-results-count');
  if (countEl) countEl.textContent = filtered.length ? `Showing ${filtered.length} fragrance${filtered.length !== 1 ? 's' : ''}` : '';

  updateProductSelectOptions();
  setTimeout(applyStockIndicators, 0);
}

/* ════════════════════════════════════════════════════════════════
   SIZE & QUANTITY SELECTION
════════════════════════════════════════════════════════════════ */

function selectSize(productId, sizeIndex, buttonElement) {
  const product = products.find(p => p.id === productId);
  if (!product?.sizes) return;

  selectedSizes[productId] = sizeIndex;

  const pillsContainer = buttonElement.closest('.pcard-sizes');
  pillsContainer?.querySelectorAll('.sz-pill').forEach((pill, i) => pill.classList.toggle('active', i === sizeIndex));

  const priceEl = document.getElementById(`szprice-${productId}`);
  if (priceEl) priceEl.textContent = product.sizes[sizeIndex].price;

  calculateTotal(productId);
}

function changeQuantity(productId, delta) {
  quantities[productId] = Math.max(1, Math.min(99, (quantities[productId] || 1) + delta));
  const qtyEl = document.getElementById(`qty-${productId}`);
  if (qtyEl) qtyEl.textContent = quantities[productId];
  calculateTotal(productId);
}

function calculateTotal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product?.sizes) return;
  const sizeIndex = selectedSizes[productId] || 0;
  const size      = product.sizes[sizeIndex];
  const qty       = quantities[productId] || 1;
  if (size) {
    const total = parseCurrency(size.price) * qty;
    const el    = document.getElementById(`sztotal-${productId}`);
    if (el) el.innerHTML = `Total: <strong>${formatCurrency(total)}</strong>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   WHATSAPP ORDER PROCESSING
════════════════════════════════════════════════════════════════ */

async function orderOnWhatsApp(productId) {
  try {
    const product = products.find(p => p.id === productId);
    if (!product) { showToast('Product not found', 'error'); return; }

    const sizeIndex  = selectedSizes[productId] || 0;
    const size       = product.sizes[sizeIndex];
    const qty        = quantities[productId] || 1;

    if (!size) { showToast('Please select a size', 'warn'); return; }

    const total    = formatCurrency(parseCurrency(size.price) * qty);
    const orderData = { product: product.name, size: size.ml, quantity: qty, total, timestamp: new Date().toISOString() };

    processWhatsAppOrder(orderData).catch(err => console.warn('Failed to log order:', err));

    const message  = generateWhatsAppOrderMessage(orderData);
    const waNumber = STORE.wa.replace(/\D/g, '');
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    showToast('Opening WhatsApp...', 'success');
  } catch (error) {
    console.error('Error processing WhatsApp order:', error);
    showToast('Failed to process order', 'error');
  }
}

/* ════════════════════════════════════════════════════════════════
   STOCK INDICATORS
════════════════════════════════════════════════════════════════ */

// FIX: implemented — reads from window.firebaseStock and updates the indicator badge on each card
function applyStockIndicators() {
  const stockData = window.firebaseStock || {};

  products.forEach(product => {
    const indicator = document.getElementById(`stock-${product.id}`);
    if (!indicator) return;

    const stock = stockData[product.id];
    const qty   = stock ? Number(stock.quantity ?? 0) : null;

    if (qty === null) {
      // No stock data tracked yet — hide the indicator
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = 'block';
    if (qty === 0) {
      indicator.textContent = 'Out of Stock';
      indicator.style.cssText = 'display:block;font-size:.55rem;padding:.15rem .5rem;border-radius:4px;background:rgba(220,50,50,.18);color:#e05050;border:1px solid rgba(220,50,50,.3);margin-bottom:.3rem;';
    } else if (qty <= 5) {
      indicator.textContent = `Only ${qty} left`;
      indicator.style.cssText = 'display:block;font-size:.55rem;padding:.15rem .5rem;border-radius:4px;background:rgba(255,152,0,.15);color:#ff9800;border:1px solid rgba(255,152,0,.3);margin-bottom:.3rem;';
    } else {
      indicator.textContent = 'In Stock';
      indicator.style.cssText = 'display:block;font-size:.55rem;padding:.15rem .5rem;border-radius:4px;background:rgba(76,175,80,.12);color:#4caf50;border:1px solid rgba(76,175,80,.25);margin-bottom:.3rem;';
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
════════════════════════════════════════════════════════════════ */

function updateProductSelectOptions() {
  const opts = '<option value="">-- Select Fragrance --</option>' +
    products.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  ['cf-product','rv-product'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

function debounce(func, wait) {
  let timeout;
  return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}

export {
  initializeProducts, filterProducts, handleSearch,
  renderFeaturedProducts, renderAllProducts,
  selectSize as selectProductSize,
  changeQuantity as changeProductQuantity,
  orderOnWhatsApp as orderProductViaWhatsApp,
  applyStockIndicators,
};
