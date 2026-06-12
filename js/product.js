/* ════════════════════════════════════════════════════════════════
   PRODUCT DETAIL PAGE (product.js)
   Handles: Fetching product, reviews, cart, wishlist, related products
   Depends on: Firebase JS SDK (CDN), js/config.js (STORE)
════════════════════════════════════════════════════════════════ */

/* ─── Firebase SDK (same versions as existing codebase) ─── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs,
  addDoc, query, where, orderBy, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ─── Local config ─── */
import { STORE } from './config.js';
import { buildWhatsAppUrl } from './modules/utils.js';

/* ════════════════════════════════════════════════════════════════
   FIREBASE SETUP
════════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey:            "AIzaSyDy9cBRGlQR507rKrcvaaeS465aMVjA7YE",
  authDomain:        "miskeen-fragrance-center.firebaseapp.com",
  projectId:         "miskeen-fragrance-center",
  storageBucket:     "miskeen-fragrance-center.firebasestorage.app",
  messagingSenderId: "607611380770",
  appId:             "1:607611380770:web:6a6c69c0c6f4497f1c967b",
  databaseURL:       "https://miskeen-fragrance-center-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig, 'pdp-instance'); // named to avoid conflict with main page
const db  = getFirestore(app);

/* ════════════════════════════════════════════════════════════════
   PAGE STATE
════════════════════════════════════════════════════════════════ */

const state = {
  product:      null,   // current product object
  reviews:      [],     // reviews for this product
  selectedSize: 0,      // index of selected size pill
  qty:          1,      // order quantity
  reviewRating: 0,      // star rating in review form
  cart:         [],     // cart items (localStorage-persisted)
  wishlist:     [],     // wishlist IDs (localStorage-persisted)
  productId:    null,   // extracted from URL
};

/* ════════════════════════════════════════════════════════════════
   UTILITY HELPERS
════════════════════════════════════════════════════════════════ */

/** Safe HTML escape — prevents XSS in rendered strings */
function esc(str) {
  if (typeof str !== 'string') return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/** Parse "PKR 1,200" → 1200 */
function parsePKR(str) {
  if (typeof str !== 'string') return 0;
  return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

/** Format 1200 → "PKR 1,200" */
function formatPKR(num) {
  return `PKR ${Math.round(num).toLocaleString('en-PK')}`;
}

/** Generate ★ star string from numeric rating */
function stars(n) {
  const r = Math.max(0, Math.min(5, Math.round(parseFloat(n) || 0)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

/** Relative time: "3d ago" */
function relTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d ago`;
  return d.toLocaleDateString('en-PK', { month:'short', day:'numeric' });
}

/** Show toast notification */
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.parentNode?.removeChild(t), 2700);
}

/* ════════════════════════════════════════════════════════════════
   URL PARAMETER HANDLING
════════════════════════════════════════════════════════════════ */

/**
 * Extract and validate product ID from URL query string.
 * Returns string ID or null if invalid/missing.
 */
function getProductIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  // Basic validation: must be a non-empty alphanumeric/dash string
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  return id;
}

/* ════════════════════════════════════════════════════════════════
   FIREBASE DATA FETCHING
════════════════════════════════════════════════════════════════ */

/** Fetch a single product document by ID */
async function fetchProduct(productId) {
  const ref  = doc(db, 'products', productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Fetch approved reviews for a specific product */
async function fetchReviews(productId, productName) {
  try {
    // Try querying by productId field first, fall back to name
    const q = query(
      collection(db, 'reviews'),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter to this product — reviews store product name as string
    return all.filter(r =>
      r.productId === productId || r.product === productName
    );
  } catch (err) {
    console.warn('Could not load reviews:', err);
    return [];
  }
}

/** Fetch 4 related products from same category, excluding current */
async function fetchRelated(category, excludeId) {
  try {
    const q = query(
      collection(db, 'products'),
      where('cat', '==', category),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.id !== excludeId)
      .slice(0, 4);
  } catch (err) {
    console.warn('Could not load related:', err);
    return [];
  }
}

/* ════════════════════════════════════════════════════════════════
   UI RENDERING
════════════════════════════════════════════════════════════════ */

/** Show/hide full-page loading state */
function setLoading(show) {
  document.getElementById('pdp-loading').style.display = show ? 'flex' : 'none';
}

/** Show error state with optional message */
function showError(msg) {
  setLoading(false);
  const el = document.getElementById('pdp-error');
  el.style.display = 'flex';
  if (msg) document.getElementById('pdp-error-msg').textContent = msg;
}

/** Render the full product into the page */
function renderProduct(product) {
  const p = product;

  /* ── SEO & metadata ── */
  document.title = `${p.name} — Miskeen Fragrance Center`;
  document.querySelector('meta[name="description"]')
    ?.setAttribute('content', p.desc || p.name);

  /* ── Open Graph tags for social media sharing ── */
  document.querySelector('meta[property="og:title"]')
    ?.setAttribute('content', `${p.name} — Miskeen Fragrance Center`);
  document.querySelector('meta[property="og:description"]')
    ?.setAttribute('content', p.desc || `Premium ${p.cat || 'attar'} - ${p.name}`);
  document.querySelector('meta[property="og:image"]')
    ?.setAttribute('content', p.img || '');
  document.querySelector('meta[property="og:url"]')
    ?.setAttribute('content', window.location.href);

  /* ── Structured Data (Product Schema) ── */
  const schemaScript = document.getElementById('product-schema');
  if (schemaScript) {
    const firstPrice = p.sizes?.[0]?.price || '0';
    const numericPrice = parsePKR(firstPrice);
    const structuredData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": p.name || "Product",
      "description": p.desc || `Premium ${p.cat || 'attar'}`,
      "image": p.img || "",
      "category": p.cat || "Attar",
      "offers": {
        "@type": "Offer",
        "price": numericPrice,
        "priceCurrency": "PKR",
        "availability": p.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock"
      }
    };
    schemaScript.textContent = JSON.stringify(structuredData);
  }

  /* ── Canonical URL ── */
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) {
    canonicalLink.href = window.location.href;
  }

  /* ── Breadcrumb ── */
  document.getElementById('bc-name').textContent = p.name || 'Product';
  const catLink = document.getElementById('bc-cat-link');
  catLink.textContent = capitalise(p.cat || 'Products');

  /* ── Category & name ── */
  document.getElementById('pdp-cat').textContent  = (p.cat || '').toUpperCase();
  document.getElementById('pdp-name').textContent = p.name || '';

  /* ── Image ── */
  const wrap = document.getElementById('pdp-img-wrap');
  if (p.img) {
    // Swap out placeholder for actual image
    const img = document.createElement('img');
    img.alt     = esc(p.name || 'Product image');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src     = p.img;
    img.onerror = () => { img.src = ''; img.style.display = 'none'; };
    document.getElementById('pdp-img-placeholder').remove();
    wrap.insertBefore(img, wrap.firstChild);
  }

  /* ── Stock badge on image ── */
  const stockDot = document.createElement('div');
  stockDot.className = 'pdp-stock-dot';
  stockDot.innerHTML = `<span class="stock-dot ${p.inStock === false ? 'out' : 'in'}"></span>
    <span>${p.inStock === false ? 'Out of Stock' : 'In Stock'}</span>`;
  wrap.appendChild(stockDot);

  /* ── Product badge (BESTSELLER / NEW / PREMIUM) ── */
  if (p.badge) {
    const badge = document.createElement('div');
    badge.className   = 'pdp-badge';
    badge.textContent = p.badge;
    wrap.appendChild(badge);
  }

  /* ── Inline stock indicator ── */
  const stockInline = document.getElementById('pdp-stock-inline');
  document.getElementById('stock-dot-inline').className  = `stock-dot ${p.inStock === false ? 'out' : 'in'}`;
  document.getElementById('stock-label-inline').textContent = p.inStock === false ? 'Out of Stock' : 'In Stock';

  /* ── Size pills ── */
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  if (sizes.length > 0) {
    const section  = document.getElementById('pdp-size-section');
    const sizesEl  = document.getElementById('pdp-sizes');
    section.style.display = 'block';
    sizesEl.innerHTML = sizes.map((sz, i) =>
      `<button class="pdp-sz-pill${i === 0 ? ' active' : ''}"
         onclick="PDP.selectSize(${i}, this)">${esc(sz.ml)}</button>`
    ).join('');

    // Show first size price
    updatePriceDisplay();
  } else if (p.price) {
    document.getElementById('pdp-price').textContent = esc(p.price);
  }

  /* ── Description ── */
  document.getElementById('pdp-desc').textContent = p.desc || '';

  /* ── Meta tags (category, featured badge) ── */
  const metaEl = document.getElementById('pdp-meta');
  const tags   = [p.cat, p.badge, p.featured ? 'FEATURED' : ''].filter(Boolean);
  metaEl.innerHTML = tags.map(t =>
    `<span class="pdp-meta-tag">${esc(t)}</span>`
  ).join('');

  /* ── Disable order button if out of stock ── */
  if (p.inStock === false) {
    const btn = document.getElementById('btn-order-wa');
    btn.disabled    = true;
    btn.textContent = 'OUT OF STOCK';
  }

  /* ── Wishlist state ── */
  updateWishlistButton();

  /* ── Cart button state ── */
  updateCartButton();

  /* ── Show content ── */
  setLoading(false);
  document.getElementById('pdp-content').style.display = 'block';
}

/** Update price & total display based on selected size & qty */
function updatePriceDisplay() {
  const p     = state.product;
  if (!p) return;
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  const size  = sizes[state.selectedSize];

  if (size) {
    const unit  = parsePKR(size.price);
    const total = unit * state.qty;
    document.getElementById('pdp-price').textContent     = esc(size.price);
    document.getElementById('pdp-size-label').textContent = esc(size.ml);
    document.getElementById('pdp-total').textContent     = formatPKR(total);
  }
}

/** Render reviews section */
function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');

  if (!reviews.length) {
    list.innerHTML = `<p class="no-reviews">Be the first to review this fragrance!</p>`;
    updateRatingSummary([], 0);
    return;
  }

  list.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <div>
          <div class="review-author">${esc(r.name || 'Anonymous')}</div>
          ${r.city ? `<div class="review-city">📍 ${esc(r.city)}</div>` : ''}
        </div>
        <div class="review-stars">${stars(r.rating)}</div>
      </div>
      <div class="review-text">${esc(r.text || '')}</div>
      <div class="review-date">${relTime(r.createdAt)}</div>
    </div>
  `).join('');

  // Update summary stats
  const avg = reviews.reduce((s, r) => s + (parseFloat(r.rating) || 0), 0) / reviews.length;
  updateRatingSummary(reviews, avg);

  // Update rating display on the info panel
  document.getElementById('pdp-stars').textContent       = stars(avg);
  document.getElementById('pdp-rating-num').textContent  = avg.toFixed(1);
  document.getElementById('pdp-review-count').textContent = `(${reviews.length} review${reviews.length !== 1 ? 's' : ''})`;
}

/** Build the rating summary block (avg + bar chart) */
function updateRatingSummary(reviews, avg) {
  const summary = document.getElementById('reviews-summary');
  if (!reviews.length) { summary.style.display = 'none'; return; }
  summary.style.display = 'flex';

  document.getElementById('avg-rating').textContent      = avg.toFixed(1);
  document.getElementById('avg-stars').textContent       = stars(avg);
  document.getElementById('total-reviews-count').textContent = `${reviews.length} review${reviews.length !== 1 ? 's' : ''}`;

  // Distribution bars
  const barsEl = document.getElementById('rating-bars');
  const counts = [5,4,3,2,1].map(n => reviews.filter(r => Math.round(r.rating) === n).length);
  barsEl.innerHTML = [5,4,3,2,1].map((star, i) => {
    const pct = reviews.length ? Math.round((counts[i] / reviews.length) * 100) : 0;
    return `<div class="rating-bar-row">
      <span class="rating-bar-label">${star}★</span>
      <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct}%"></div></div>
      <span class="rating-bar-pct">${pct}%</span>
    </div>`;
  }).join('');
}

/** Render related products grid */
function renderRelated(products) {
  const section = document.getElementById('related-section');
  const grid    = document.getElementById('related-grid');

  if (!products.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  grid.innerHTML = products.map(p => {
    const firstPrice = Array.isArray(p.sizes) && p.sizes[0] ? p.sizes[0].price : (p.price || '—');
    const imgHTML = p.img
      ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'">`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:.25;font-size:2.5rem;">🌺</div>`;
    return `
      <div class="mini-pcard" onclick="window.location.href='product.html?id=${esc(p.id)}'" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')window.location.href='product.html?id=${esc(p.id)}'">
        <div class="mini-pcard-img">${imgHTML}</div>
        <div class="mini-pcard-body">
          <div class="mini-pcard-cat">${esc(p.cat || '').toUpperCase()}</div>
          <div class="mini-pcard-name">${esc(p.name || '')}</div>
          <div class="mini-pcard-price">${esc(firstPrice)}</div>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════
   CART LOGIC (localStorage)
════════════════════════════════════════════════════════════════ */

const CART_KEY = 'miskeen_cart_v1';
const WISH_KEY = 'miskeen_wish_v1';

function loadCart()     { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } }
function saveCart(c)    { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { console.warn(e); } }
function loadWishlist() { try { return JSON.parse(localStorage.getItem(WISH_KEY) || '[]'); } catch { return []; } }
function saveWishlist(w){ try { localStorage.setItem(WISH_KEY, JSON.stringify(w)); } catch (e) { console.warn(e); } }

function isInCart() {
  const p    = state.product;
  const size = (p?.sizes || [])[state.selectedSize];
  return state.cart.some(i => i.productId === p?.id && i.size === size?.ml);
}

function updateCartButton() {
  const btn = document.getElementById('btn-add-cart');
  if (!btn) return;
  if (isInCart()) {
    btn.classList.add('in-cart');
    btn.textContent = '✓ IN CART';
  } else {
    btn.classList.remove('in-cart');
    btn.textContent = '🛒 ADD TO CART';
  }
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = state.cart.reduce((s, i) => s + (i.qty || 1), 0);
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

function renderCartDrawer() {
  const listEl  = document.getElementById('cart-items-list');
  const footer  = document.getElementById('cart-footer');

  if (!state.cart.length) {
    listEl.innerHTML = `<div class="cart-empty"><span>🛒</span><p>Your cart is empty</p></div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  listEl.innerHTML = state.cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.img ? `<img src="${esc(item.img)}" alt="${esc(item.name)}" loading="lazy">` : '🌺'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-size">${esc(item.size)} · Qty ${item.qty}</div>
        <div class="cart-item-price">${esc(item.price)}</div>
      </div>
      <button class="cart-item-remove" onclick="PDP.removeFromCart(${idx})" title="Remove">✕</button>
    </div>
  `).join('');

  // Calculate total
  const total = state.cart.reduce((s, i) => s + (parsePKR(i.price) * (i.qty || 1)), 0);
  document.getElementById('cart-total').textContent = formatPKR(total);
}

function updateWishlistButton() {
  const isWishlisted = state.wishlist.includes(state.product?.id);
  ['btn-wish-icon', 'btn-wish-main'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('wishlisted', isWishlisted);
    if (id === 'btn-wish-icon')  btn.textContent = isWishlisted ? '♥' : '♡';
    if (id === 'btn-wish-main')  btn.textContent = isWishlisted ? '♥ WISHLISTED' : '♡ WISHLIST';
  });
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC API (window.PDP) — called from HTML onclick handlers
════════════════════════════════════════════════════════════════ */

const PDP = {

  /** Select a size pill */
  selectSize(index, buttonEl) {
    state.selectedSize = index;
    document.querySelectorAll('.pdp-sz-pill').forEach((b, i) => {
      b.classList.toggle('active', i === index);
    });
    updatePriceDisplay();
    updateCartButton(); // check if new size is in cart
  },

  /** Change order quantity */
  changeQty(delta) {
    state.qty = Math.max(1, Math.min(99, state.qty + delta));
    document.getElementById('pdp-qty').textContent = state.qty;
    updatePriceDisplay();
  },

  /** Open/close cart drawer */
  toggleCartDrawer() {
    const overlay = document.getElementById('cart-overlay');
    const drawer  = document.getElementById('cart-drawer');
    const isOpen  = drawer.classList.contains('open');
    overlay.classList.toggle('open', !isOpen);
    drawer.classList.toggle('open', !isOpen);
    if (!isOpen) renderCartDrawer();
  },

  /** Add current product + selected size to cart */
  addToCart() {
    const p    = state.product;
    if (!p) return;
    const size = (p.sizes || [])[state.selectedSize];

    if (isInCart()) {
      toast('Already in your cart!', 'warn');
      PDP.toggleCartDrawer();
      return;
    }

    const item = {
      productId: p.id,
      name:      p.name,
      size:      size?.ml  || '',
      price:     size?.price || p.price || '',
      qty:       state.qty,
      img:       p.img || '',
    };

    state.cart.push(item);
    saveCart(state.cart);
    updateCartButton();
    toast('Added to cart! 🛒', 'success');
  },

  /** Remove item from cart by index */
  removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart(state.cart);
    updateCartButton();
    renderCartDrawer();
    toast('Removed from cart', 'info');
  },

  /** Toggle wishlist for current product */
  toggleWishlist() {
    const id  = state.product?.id;
    if (!id) return;
    const idx = state.wishlist.indexOf(id);
    if (idx === -1) {
      state.wishlist.push(id);
      toast('Added to wishlist ♥', 'success');
    } else {
      state.wishlist.splice(idx, 1);
      toast('Removed from wishlist', 'info');
    }
    saveWishlist(state.wishlist);
    updateWishlistButton();
  },

  /** Order current selection on WhatsApp */
  orderWhatsApp() {
    const p    = state.product;
    if (!p) return;

    if (p.inStock === false) {
      toast('This product is currently out of stock', 'warn');
      return;
    }

    const size = (p.sizes || [])[state.selectedSize];
    const unit = parsePKR(size?.price || p.price || '0');
    const total = formatPKR(unit * state.qty);
    // Pre-filled Arabic-style WhatsApp greeting (matching existing codebase style)
    const msg = [
      `السلام عليكم`,
      ``,
      `I'd like to order:`,
      ``,
      `🌺 *${p.name}*`,
      `📦 Size: ${size?.ml || 'N/A'}`,
      `🔢 Quantity: ${state.qty}`,
      `💰 Total: ${total}`,
      ``,
      `Please confirm availability and delivery details.`,
      ``,
      `Product link: ${window.location.href}`,
    ].join('\n');

    window.open(buildWhatsAppUrl(STORE.wa, msg), '_blank', 'noopener,noreferrer');
    toast('Opening WhatsApp…', 'success');
  },

  /** Send entire cart to WhatsApp */
  checkoutWhatsApp() {
    if (!state.cart.length) return;
    const lines = state.cart.map((item, i) =>
      `${i + 1}. *${item.name}* — ${item.size} × ${item.qty} = ${formatPKR(parsePKR(item.price) * item.qty)}`
    );
    const total = state.cart.reduce((s, i) => s + (parsePKR(i.price) * (i.qty || 1)), 0);
    const msg = [
      `السلام عليكم`,
      ``,
      `I'd like to place the following order:`,
      ``,
      ...lines,
      ``,
      `💰 *Total: ${formatPKR(total)}*`,
      ``,
      `Please confirm and share payment/delivery details.`,
    ].join('\n');

    window.open(buildWhatsAppUrl(STORE.wa, msg), '_blank', 'noopener,noreferrer');
    toast('Opening WhatsApp…', 'success');
  },

  /** Copy product URL to clipboard */
  async shareProduct() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Product link copied! 🔗', 'success');
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast('Product link copied! 🔗', 'success');
    }
  },

  /** Set review star rating */
  setReviewStar(rating) {
    state.reviewRating = rating;
    document.querySelectorAll('.star-btn').forEach((btn, i) => {
      btn.classList.toggle('lit', i < rating);
    });
    const errEl = document.getElementById('rv-rating-err');
    if (errEl) errEl.textContent = '';
  },

  /** Validate and submit a new review */
  async submitReview() {
    const btn = document.getElementById('btn-submit-review');
    
    // Prevent double submissions
    if (btn.disabled) return;

    // Collect inputs
    const name   = document.getElementById('rv-name')?.value?.trim() || '';
    const city   = document.getElementById('rv-city')?.value?.trim() || '';
    const text   = document.getElementById('rv-text')?.value?.trim() || '';
    const rating = state.reviewRating;

    // Clear previous errors
    ['rv-name-err','rv-rating-err','rv-text-err'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    const successEl = document.getElementById('rv-success');
    if (successEl) successEl.style.display = 'none';

    // Validate
    let valid = true;
    if (!name || name.length < 2) {
      const el = document.getElementById('rv-name-err');
      if (el) el.textContent = 'Name is required (min 2 chars).';
      valid = false;
    }
    if (!rating) {
      const el = document.getElementById('rv-rating-err');
      if (el) el.textContent = 'Please select a star rating.';
      valid = false;
    }
    if (!text || text.length < 10) {
      const el = document.getElementById('rv-text-err');
      if (el) el.textContent = 'Review must be at least 10 characters.';
      valid = false;
    }
    if (!valid) {
      console.warn('Review validation failed');
      return;
    }

    // Sanitize (strip HTML tags, limit length)
    const sanitize = v => v.replace(/[<>]/g, '').substring(0, 500);

    btn.disabled    = true;
    btn.textContent = 'SUBMITTING…';

    try {
      await addDoc(collection(db, 'reviews'), {
        productId:   state.productId,
        product:     state.product?.name || '',
        name:        sanitize(name),
        city:        sanitize(city),
        text:        sanitize(text),
        rating:      rating,
        approved:    false,      // awaits admin approval
        createdAt:   serverTimestamp(),
      });

      // Reset form
      const nameInput = document.getElementById('rv-name');
      const cityInput = document.getElementById('rv-city');
      const textInput = document.getElementById('rv-text');
      if (nameInput) nameInput.value  = '';
      if (cityInput) cityInput.value  = '';
      if (textInput) textInput.value  = '';
      PDP.setReviewStar(0);
      if (successEl) successEl.style.display = 'block';
      toast('Review submitted! Awaiting approval.', 'success');
      console.log('✅ Review submitted successfully');
    } catch (err) {
      console.error('Review submission error:', err);
      toast(`Failed to submit review: ${err.message}`, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'SUBMIT REVIEW';
    }
  },
};

/* Expose PDP globally for inline onclick handlers */
window.PDP = PDP;

/* ════════════════════════════════════════════════════════════════
   MAIN INITIALISATION
════════════════════════════════════════════════════════════════ */

async function init() {
  // 1. Extract & validate product ID from URL
  state.productId = getProductIdFromURL();
  if (!state.productId) {
    showError('Invalid or missing product ID in URL.');
    return;
  }

  // 2. Load persisted cart & wishlist
  state.cart     = loadCart();
  state.wishlist = loadWishlist();
  updateCartBadge();

  // 3. Fetch product from Firestore
  let product;
  try {
    product = await fetchProduct(state.productId);
  } catch (err) {
    console.error('Error fetching product:', err);
    showError('Could not load product. Please check your connection.');
    return;
  }

  if (!product) {
    showError('This fragrance was not found in our store.');
    return;
  }

  state.product = product;

  // 4. Render product UI
  renderProduct(product);

  // 5. Fetch & render reviews (non-blocking)
  fetchReviews(state.productId, product.name).then(reviews => {
    state.reviews = reviews;
    renderReviews(reviews);
  });

  // 6. Fetch & render related products (non-blocking)
  if (product.cat) {
    fetchRelated(product.cat, state.productId).then(related => {
      renderRelated(related);
    });
  }
}

/* ── Helpers used inside renderProduct ── */
function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/* ── Bootstrap on DOM ready ── */
document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('Fatal PDP error:', err);
    showError('An unexpected error occurred. Please try again.');
  });
});
