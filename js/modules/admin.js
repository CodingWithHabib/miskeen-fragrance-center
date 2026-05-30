/* ════════════════════════════════════════════════════════════════
   ADMIN MODULE — Admin Panel & Authentication
════════════════════════════════════════════════════════════════ */

import { signInUser, signOutUser, getSettings, saveSettings as firebaseSaveSettings, getCategories, addCategory, updateCategory, deleteCategory, listenCategories } from './firebase.js';
import { renderAdminReviewsList as renderReviewsAdminListFromReviews } from './reviews.js';
import { createProduct } from './services.js';
import { esc, storage } from './utils.js';
import { updateCloudinaryConfig } from './cloudinary.js';
import { STORE, showToast } from '../config.js';

/* ════════════════════════════════════════════════════════════════
   STATE MANAGEMENT
════════════════════════════════════════════════════════════════ */

let adminPanelOpen = false;
let currentUser    = null;
const LOGIN_LOCKOUT = { attempts: 0, lockedUntil: 0, MAX: 5, WINDOW_MS: 15 * 60 * 1000 };

/* ════════════════════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════════════════════ */

function initializeAdmin() {
  setupAdminEventListeners();
  // Load saved admin tab preference from localStorage
  const savedAdminTab = storage.get('lastAdminTab', 'adm-manage');
  if (!savedAdminTab) {
    // If first time, set default
    storage.set('lastAdminTab', 'adm-manage');
  }
  console.log('✅ Admin module initialized');
}

function setupAdminEventListeners() {
  // Click-outside closes edit modal
  const editModalOverlay = document.getElementById('edit-modal-overlay');
  if (editModalOverlay) {
    editModalOverlay.addEventListener('click', function(e) {
      if (e.target === this) closeEditModal();
    });
  }

  // Dedicated admin page only.

  // NOTE: Ctrl+Shift+A keyboard shortcut is handled ONLY in app.js — no duplicate here
}

/* ════════════════════════════════════════════════════════════════
   AUTHENTICATION
════════════════════════════════════════════════════════════════ */

function showLoginModal() {
  const overlay = document.getElementById('admin-login-overlay');
  if (!overlay) return;

  overlay.classList.add('show');

  const loginBox = overlay.querySelector('.login-box');

  if (loginBox && !loginBox.dataset.bound) {
    loginBox.dataset.bound = 'true';

    loginBox.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    loginBox.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeLoginModal();
    }
  });
}

function closeLoginModal() {
  document.getElementById('admin-login-overlay')?.classList.remove('show');
  const emailInput = document.getElementById('admin-email-inp');
  const passInput  = document.getElementById('admin-pass-inp');
  const errorMsg   = document.getElementById('login-error');
  if (emailInput) emailInput.value = '';
  if (passInput)  passInput.value  = '';
  if (errorMsg)   errorMsg.style.display = 'none';
}

async function performSignIn() {
  try {
    if (isLockedOut()) {
      const remaining = Math.ceil((LOGIN_LOCKOUT.lockedUntil - Date.now()) / 1000);
      showErrorMessage(`Too many failed attempts. Try again in ${remaining} seconds.`);
      return;
    }

    const email    = document.getElementById('admin-email-inp')?.value.trim() || '';
    const password = document.getElementById('admin-pass-inp')?.value || '';

    if (!email || !password) { showErrorMessage('Please enter email and password.'); return; }

    showErrorMessage('Signing in...', 'info');
    const result = await signInUser(email, password);

    if (result.success) {
      currentUser = result.user;
      showToast('✓ Signed in successfully', 'success');
      closeLoginModal();
      const claims = await currentUser.getIdTokenResult(true);
      if(!claims.claims.admin){ showErrorMessage("Access denied. Admin role required."); await signOutUser(); return; }
      openAdminPanel();
      LOGIN_LOCKOUT.attempts = 0;
      LOGIN_LOCKOUT.lockedUntil = 0;
    } else {
      LOGIN_LOCKOUT.attempts++;
      if (LOGIN_LOCKOUT.attempts >= LOGIN_LOCKOUT.MAX) {
        LOGIN_LOCKOUT.lockedUntil = Date.now() + LOGIN_LOCKOUT.WINDOW_MS;
        showErrorMessage('Too many failed attempts. Account locked temporarily.');
      } else {
        showErrorMessage(result.error || 'Sign in failed. Please try again.');
      }
    }
  } catch (error) {
    console.error('Sign in error:', error);
    showErrorMessage('An error occurred. Please try again.');
  }
}

async function performSignOut() {
  try {
    const result = await signOutUser();
    if (result.success) {
      currentUser = null;
      closeAdminPanel();
      showToast('✓ Signed out successfully', 'success');
    } else {
      showToast('Sign out failed: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Sign out error:', error);
    showToast('An error occurred during sign out', 'error');
  }
}

function isLockedOut() { return Date.now() < LOGIN_LOCKOUT.lockedUntil; }

function showErrorMessage(message, type = 'error') {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.className = type === 'info' ? 'info' : 'error';
  el.textContent = message;
  el.style.display = 'block';
  if (type === 'error') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

/* ════════════════════════════════════════════════════════════════
   ADMIN PANEL MANAGEMENT
════════════════════════════════════════════════════════════════ */

function openAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (!adminPanel) return;
  adminPanel.classList.add('show');
  adminPanelOpen = true;

  if (currentUser) {
    const userInfoEl = document.querySelector('.adm-user-info');
    if (userInfoEl) userInfoEl.textContent = `Logged in as: ${esc(currentUser.email)}`;
  }

  renderAdminDashboard();
  renderAdminProductList();
  renderAdminReviewsList();

  const activeTab = document.querySelector('.adm-tab.on');
  if (activeTab) {
    const match = activeTab.getAttribute('onclick')?.match(/swAdmTab\('([^']+)'/);
    if (match) switchAdminTab(match[1], activeTab);
  } else {
    const manageTab = document.querySelector('[onclick*="adm-manage"]');
    if (manageTab) switchAdminTab('adm-manage', manageTab);
  }
}

function closeAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    adminPanel.classList.remove('show');
    adminPanel.style.display = 'none';
    adminPanelOpen = false;
  }
}

function switchAdminTab(tabId, tabButton) {
  document.querySelectorAll('.adm-sec').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('on'));
  document.getElementById(tabId)?.classList.add('on');
  if (tabButton) tabButton.classList.add('on');
  
  // Save tab preference safely
  if (storage && storage.set) {
    storage.set('lastAdminTab', tabId);
  }

  const renderMap = {
    'adm-manage':   renderAdminProductList,
    'adm-categories': renderAdminCategories,
    'adm-reviews':  renderAdminReviewsList,
    'adm-stock':    renderAdminStock,
    'adm-dashboard': renderAdminDashboard,
    'adm-settings': loadAdminSettings,
    'adm-content':  loadAdminContent,
    'adm-contact':  loadAdminContact,
  };
  if (renderMap[tabId]) renderMap[tabId]();
}

/* ════════════════════════════════════════════════════════════════
   ADMIN TAB RENDERERS
════════════════════════════════════════════════════════════════ */

function renderAdminDashboard() {
  const container = document.getElementById('adm-dashboard');
  if (!container) return;

  const products  = window.firebaseProducts  || [];
  const reviews   = window.firebaseReviews   || [];
  const stats     = window.firebaseRTDBStats || {};

  const totalProducts    = products.length;
  const approvedReviews  = reviews.filter(r => r.approved).length;
  const pendingReviews   = reviews.filter(r => !r.approved).length;
  const totalOrders      = stats.totalOrders  || 0;
  const totalViews       = stats.totalViews   || 0;

  // Today's orders
  const today = new Date().toISOString().split('T')[0];
  const ordersToday = stats.ordersToday?.[today] || 0;

  const dashContent = document.getElementById('adm-dashboard-content');
  const targetEl = dashContent || container;

  targetEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;padding:1rem 0;">
      <div class="adm-stat-card" style="background:rgba(199,160,82,.1);border:1px solid rgba(199,160,82,.3);padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold2);">${totalProducts}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">TOTAL PRODUCTS</div>
      </div>
      <div class="adm-stat-card" style="background:rgba(199,160,82,.1);border:1px solid rgba(199,160,82,.3);padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold2);">${approvedReviews}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">APPROVED REVIEWS</div>
      </div>
      <div class="adm-stat-card" style="background:${pendingReviews > 0 ? 'rgba(220,100,50,.1)' : 'rgba(199,160,82,.1)'};border:1px solid ${pendingReviews > 0 ? 'rgba(220,100,50,.3)' : 'rgba(199,160,82,.3)'};padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:${pendingReviews > 0 ? '#e06030' : 'var(--gold2)'};">${pendingReviews}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">PENDING REVIEWS</div>
      </div>
      <div class="adm-stat-card" style="background:rgba(199,160,82,.1);border:1px solid rgba(199,160,82,.3);padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold2);">${ordersToday}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">ORDERS TODAY</div>
      </div>
      <div class="adm-stat-card" style="background:rgba(199,160,82,.1);border:1px solid rgba(199,160,82,.3);padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold2);">${totalOrders}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">TOTAL ORDERS</div>
      </div>
      <div class="adm-stat-card" style="background:rgba(199,160,82,.1);border:1px solid rgba(199,160,82,.3);padding:1.2rem;border-radius:8px;text-align:center;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--gold2);">${totalViews}</div>
        <div style="font-size:.65rem;letter-spacing:.1em;color:rgba(245,239,230,.6);margin-top:.3rem;">TOTAL PAGE VIEWS</div>
      </div>
    </div>
    ${pendingReviews > 0 ? `<div style="margin-top:.5rem;padding:.8rem 1rem;background:rgba(220,100,50,.12);border:1px solid rgba(220,100,50,.3);border-radius:6px;font-size:.75rem;color:#e06030;">⚠ You have ${pendingReviews} review${pendingReviews !== 1 ? 's' : ''} awaiting approval. <span style="cursor:pointer;text-decoration:underline;" onclick="app.swAdmTab('adm-reviews',document.querySelector('[onclick*=adm-reviews]'))">Go to Reviews →</span></div>` : ''}
  `;
}

function renderAdminProductList() {
  const container = document.getElementById('adm-prod-list');
  if (!container) return;

  const products = window.firebaseProducts || [];

  if (products.length === 0) {
    container.innerHTML = `<div class="adm-empty">No products found. Add your first product using the "+ ADD PRODUCT" tab.</div>`;
  } else {
    container.innerHTML = products.map(product => {
      const sizesText = product.sizes ? product.sizes.map(s => `${s.ml} - ${s.price}`).join(', ') : 'No sizes';
      return `
        <div class="product-item" data-id="${product.id}">
          <div class="product-info">
            <div class="product-name">${esc(product.name || 'Unnamed')}</div>
            <div class="product-meta">${esc(product.cat || 'uncategorized')} • ${sizesText}</div>
            ${product.badge ? `<div class="product-badge">${esc(product.badge)}</div>` : ''}
          </div>
          <div class="product-actions">
            <button class="btn btn-sm btn-outline" onclick="app.editProduct('${product.id}')">✏ EDIT</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteProduct('${product.id}')">🗑 DELETE</button>
          </div>
        </div>`;
    }).join('');
  }

  const countEl = document.getElementById('prod-count');
  if (countEl) countEl.textContent = `(${products.length} products)`;
}

function renderAdminReviewsList() {
  const reviews = window.firebaseReviews || [];
  renderReviewsAdminListFromReviews(reviews);
}

function renderAdminStock() {
  const container = document.getElementById('adm-stock-list');
  if (!container) return;

  const products  = window.firebaseProducts || [];
  const stockData = window.firebaseStock    || {};

  if (products.length === 0) {
    container.innerHTML = `<div class="adm-empty">No products available yet. Add products first to manage stock.</div>`;
    return;
  }

  const productMap = products.reduce((map, p) => { map[p.id] = p; return map; }, {});

  const entries = Object.keys(stockData).length > 0
    ? Object.keys(stockData).map(productId => {
        const item    = stockData[productId] || {};
        const qty     = Number(item.quantity ?? 0);
        const product = productMap[productId];
        const name    = product ? esc(product.name || productId) : esc(productId);
        const status  = qty > 5 ? 'In Stock' : qty > 0 ? 'Low Stock' : 'Out of Stock';
        const color   = qty > 5 ? 'var(--success,#4caf50)' : qty > 0 ? 'var(--warn,#ff9800)' : 'var(--danger,#f44336)';
        return `<div class="adm-item"><div class="adm-item-info" style="flex:1;"><div class="adm-item-name">${name}</div><div class="adm-item-meta">Quantity: ${qty}</div><div class="adm-item-meta" style="color:${color};">Status: ${status}</div></div></div>`;
      })
    : products.map(p => `<div class="adm-item"><div class="adm-item-info" style="flex:1;"><div class="adm-item-name">${esc(p.name || p.id)}</div><div class="adm-item-meta">Quantity: 0</div><div class="adm-item-meta" style="color:var(--danger,#f44336);">Status: Out of Stock</div></div></div>`);

  container.innerHTML = entries.join('') || `<div class="adm-empty">No stock data available yet.</div>`;
}

async function renderAdminCategories() {
  const container = document.getElementById('adm-categories-list');
  if (!container) return;

  try {
    const categories = await getCategories();

    if (categories.length === 0) {
      container.innerHTML = `<div class="adm-empty">No categories found. Add your first category above.</div>`;
      return;
    }

    container.innerHTML = categories.map(category => {
      return `
        <div class="product-item" data-id="${category.id}">
          <div class="product-info">
            <div class="product-name">${esc(category.name || 'Unnamed')}</div>
            <div class="product-meta">Slug: ${esc(category.slug || 'N/A')}</div>
          </div>
          <div class="product-actions">
            <button class="btn btn-sm btn-outline" onclick="app.editCategory('${category.id}')">✏ EDIT</button>
            <button class="btn btn-sm btn-danger" onclick="app.doDeleteCategory('${category.id}')">🗑 DELETE</button>
          </div>
        </div>`;
    }).join('');
  } catch (error) {
    console.error('Error loading categories:', error);
    container.innerHTML = `<div class="adm-empty">Error loading categories.</div>`;
  }
}

async function doAddCategory() {
  try {
    const name = document.getElementById('cat-name')?.value?.trim();
    const slug = document.getElementById('cat-slug')?.value?.trim();

    if (!name || !slug) {
      showAdminMessage('categories-msg', 'error', 'Category name and slug are required');
      return;
    }

    showAdminMessage('categories-msg', 'info', 'Adding category...');
    const result = await addCategory({ name, slug });

    if (result.success) {
      showAdminMessage('categories-msg', 'ok', 'Category added successfully!');
      document.getElementById('cat-name').value = '';
      document.getElementById('cat-slug').value = '';
      setTimeout(() => renderAdminCategories(), 500);
    } else {
      showAdminMessage('categories-msg', 'error', result.error || 'Failed to add category');
    }
  } catch (error) {
    console.error('Error adding category:', error);
    showAdminMessage('categories-msg', 'error', 'An error occurred while adding the category');
  }
}

async function editCategory(categoryId) {
  const categories = await getCategories();
  const category = categories.find(c => c.id === categoryId);

  if (!category) {
    showToast('Category not found', 'error');
    return;
  }

  const newName = prompt('Edit category name:', category.name);
  if (newName === null) return; // User cancelled

  const newSlug = prompt('Edit category slug:', category.slug);
  if (newSlug === null) return; // User cancelled

  if (!newName || !newSlug) {
    showToast('Name and slug are required', 'warn');
    return;
  }

  showAdminMessage('categories-msg', 'info', 'Updating category...');
  const result = await updateCategory(categoryId, { name: newName, slug: newSlug });

  if (result.success) {
    showAdminMessage('categories-msg', 'ok', 'Category updated successfully!');
    setTimeout(() => renderAdminCategories(), 500);
  } else {
    showAdminMessage('categories-msg', 'error', result.error || 'Failed to update category');
  }
}

async function doDeleteCategory(categoryId) {
  if (!confirm('Are you sure you want to delete this category? Products in this category will not be deleted, but they may not be filterable.')) return;

  try {
    showAdminMessage('categories-msg', 'info', 'Deleting category...');
    const result = await deleteCategory(categoryId);

    if (result.success) {
      showAdminMessage('categories-msg', 'ok', 'Category deleted successfully!');
      setTimeout(() => renderAdminCategories(), 500);
    } else {
      showAdminMessage('categories-msg', 'error', result.error || 'Failed to delete category');
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    showAdminMessage('categories-msg', 'error', 'An error occurred while deleting the category');
  }
}

async function loadAdminSettings() {
  try {
    const settings = await getSettings();
    if (settings) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('s-name',         settings.name         || 'Miskeen Fragrance Center');
      set('s-tag',          settings.tag          || 'WHERE SCENT BECOMES SOUL');
      set('s-ftdesc',       settings.ftdesc       || "Pakistan's online attar & perfume store.");
      set('s-copy',         settings.copy         || '© 2026 Miskeen Fragrance Center. All Rights Reserved.');
      set('s-title',        settings.title        || 'Miskeen Fragrance Center – Pure Attar & Perfumes');
      set('s-cloudname',    settings.cloudName    || '');
      set('s-uploadpreset', settings.uploadPreset || '');
    }
  } catch (error) {
    console.error('Error loading admin settings:', error);
    showToast('Error loading settings', 'error');
  }
}

async function saveSettings() {
  try {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const settings = {
      name:         get('s-name'),
      tag:          get('s-tag'),
      ftdesc:       get('s-ftdesc'),
      copy:         get('s-copy'),
      title:        get('s-title'),
      cloudName:    get('s-cloudname'),
      uploadPreset: get('s-uploadpreset'),
    };

    showAdminMessage('settings-msg', 'info', 'Saving settings...');
    const result = await firebaseSaveSettings(settings);

    if (result.success) {
      showAdminMessage('settings-msg', 'ok', 'Settings saved successfully!');
      Object.assign(STORE, settings);
      updateCloudinaryConfig();
      // FIX: call via window.app so we don't need a cross-module import
      if (window.app?.updateUIFromSettings) window.app.updateUIFromSettings();
    } else {
      showAdminMessage('settings-msg', 'error', result.error || 'Failed to save settings');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showAdminMessage('settings-msg', 'error', 'An error occurred while saving settings');
  }
}

async function loadAdminContent() {
  try {
    const settings = await getSettings();
    if (settings) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('c-eyebrow',   settings.heroEyebrow     || 'Premium Online Attar Store');
      set('c-feat-name', settings.heroFeaturedName || 'Office For Men');
      set('c-desc',      settings.heroDesc         || '100% natural, alcohol-free attars sourced from the finest botanicals.');
      set('c-ab-title',  settings.aboutTitle       || 'Pure Fragrance, Delivered Online');
      set('c-ab-p1',     settings.aboutP1          || 'Miskeen Fragrance Center is a 100% online attar store.');
      set('c-ab-p2',     settings.aboutP2          || 'We believe that fragrance is personal.');
    }
  } catch (error) {
    console.error('Error loading admin content:', error);
    showToast('Error loading content', 'error');
  }
}

async function saveContent() {
  try {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const content = {
      heroEyebrow:      get('c-eyebrow'),
      heroFeaturedName: get('c-feat-name'),
      heroDesc:         get('c-desc'),
      aboutTitle:       get('c-ab-title'),
      aboutP1:          get('c-ab-p1'),
      aboutP2:          get('c-ab-p2'),
    };

    showAdminMessage('content-msg', 'info', 'Saving content...');
    const result = await firebaseSaveSettings(content);

    if (result.success) {
      showAdminMessage('content-msg', 'ok', 'Content saved successfully!');
      Object.assign(STORE, content);
      if (window.app?.updateUIFromSettings) window.app.updateUIFromSettings();
    } else {
      showAdminMessage('content-msg', 'error', result.error || 'Failed to save content');
    }
  } catch (error) {
    console.error('Error saving content:', error);
    showAdminMessage('content-msg', 'error', 'An error occurred while saving content');
  }
}

async function loadAdminContact() {
  try {
    const settings = await getSettings();
    if (settings) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      set('s-wa', settings.wa || '+923001234567');
      set('s-ph', settings.ph || '+92 300 1234567');
      set('s-em', settings.em || 'info@miskeenfragrance.com');
      set('s-hr', settings.hr || 'Mon–Sun 12am–12pm');
      set('s-ig', settings.ig || '');
      set('s-fb', settings.fb || '');
    }
  } catch (error) {
    console.error('Error loading admin contact:', error);
    showToast('Error loading contact info', 'error');
  }
}

async function saveContact() {
  try {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const contact = {
      wa: get('s-wa'),
      ph: get('s-ph'),
      em: get('s-em'),
      hr: get('s-hr'),
      ig: get('s-ig'),
      fb: get('s-fb'),
    };

    showAdminMessage('contact-msg', 'info', 'Saving contact info...');
    const result = await firebaseSaveSettings(contact);

    if (result.success) {
      showAdminMessage('contact-msg', 'ok', 'Contact info saved successfully!');
      Object.assign(STORE, contact);
      // FIX: call via window.app to avoid cross-module scope issue
      if (window.app?.updateWALinks) window.app.updateWALinks();
    } else {
      showAdminMessage('contact-msg', 'error', result.error || 'Failed to save contact info');
    }
  } catch (error) {
    console.error('Error saving contact:', error);
    showAdminMessage('contact-msg', 'error', 'An error occurred while saving contact info');
  }
}

function showAdminMessage(elementId, type, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `adm-msg ${type}`;
  el.textContent = message;
  el.style.display = 'block';
  if (type === 'ok' || type === 'warn') {
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT MANAGEMENT
════════════════════════════════════════════════════════════════ */

function openEditProductModal(productId) {
  if (!currentUser) { showToast('Please sign in first', 'warn'); return; }
  document.getElementById('edit-modal-overlay')?.classList.add('show');
}

function closeEditModal() {
  document.getElementById('edit-modal-overlay')?.classList.remove('show');
}

function addProductSize(containerId = 'sizes-wrap') {
  const sizeContainer = document.getElementById(containerId) || document.getElementById('sizes-wrap');
  if (!sizeContainer) return;

  const sizeEntry = document.createElement('div');
  sizeEntry.className = 'size-entry';
  // FIX: use app.remSize() instead of bare removeProductSize() for onclick handlers in dynamic HTML
  sizeEntry.innerHTML = `
    <div class="adm-field"><label>SIZE</label><input class="sz-ml" placeholder="e.g. 3ml"></div>
    <div class="adm-field"><label>PRICE</label><input class="sz-pr" placeholder="e.g. PKR 650"></div>
    <button class="rem-size-btn" onclick="app.remSize(this)" type="button">✕</button>
  `;
  sizeContainer.appendChild(sizeEntry);
}

function addEditSize() {
  addProductSize('edit-sizes-wrap');
}

function removeProductSize(buttonElement) {
  const sizeContainer = buttonElement.closest('.size-entry')?.parentElement;
  const entries = sizeContainer?.querySelectorAll('.size-entry');
  if (entries && entries.length > 1) {
    buttonElement.closest('.size-entry').remove();
  } else {
    showToast('At least one size is required', 'warn');
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT CRUD OPERATIONS
════════════════════════════════════════════════════════════════ */

async function doAddProduct() {
  try {
    const name     = document.getElementById('pn')?.value?.trim();
    const category = document.getElementById('pc')?.value;
    const desc     = document.getElementById('pd')?.value?.trim();
    const badge    = document.getElementById('pb')?.value?.trim();
    const featured = document.getElementById('pf')?.value === 'yes';

    if (!name || !category) { showAdminMessage('add-msg', 'error', 'Product name and category are required'); return; }

    const sizes = [];
    document.querySelectorAll('#sizes-wrap .size-entry').forEach(entry => {
      const ml    = entry.querySelector('.sz-ml')?.value?.trim();
      const price = entry.querySelector('.sz-pr')?.value?.trim();
      if (ml && price) sizes.push({ ml, price });
    });

    if (sizes.length === 0) { showAdminMessage('add-msg', 'error', 'At least one size is required'); return; }

    const productData = { name, cat: category, desc: desc || '', badge: badge || '', featured, sizes };

    const imageFile     = document.getElementById('pi')?.files?.[0] || null;
    const imageUrlInput = document.getElementById('pi-url')?.value?.trim();
    if (!imageFile && imageUrlInput) productData.img = imageUrlInput;

    showAdminMessage('add-msg', 'info', 'Adding product...');
    let result = await createProduct(productData, imageFile);

    if (!result.success && imageFile && imageUrlInput) {
      productData.img = imageUrlInput;
      result = await createProduct(productData, null);
      if (result.success) showAdminMessage('add-msg', 'ok', 'Product added using image URL fallback!');
    }

    if (!result.success && imageFile && !imageUrlInput) {
      productData.img = '';
      result = await createProduct(productData, null);
      if (result.success) showAdminMessage('add-msg', 'warn', 'Product added without image (upload failed).');
    }

    if (result.success) {
      showAdminMessage('add-msg', 'ok', result.message || 'Product added successfully!');
      document.getElementById('pn').value = '';
      document.getElementById('pc').value = 'attar';
      document.getElementById('pd').value = '';
      document.getElementById('pb').value = '';
      document.getElementById('pf').value = 'no';
      // FIX: reset size row with correct onclick
      const sizesWrap = document.getElementById('sizes-wrap');
      if (sizesWrap) {
        sizesWrap.innerHTML = `<div class="size-entry"><div class="adm-field"><label>SIZE</label><input class="sz-ml" placeholder="e.g. 3ml"></div><div class="adm-field"><label>PRICE</label><input class="sz-pr" placeholder="e.g. PKR 650"></div><button class="rem-size-btn" onclick="app.remSize(this)" type="button">✕</button></div>`;
      }
      const piInput = document.getElementById('pi');   if (piInput) piInput.value = '';
      const piPrev  = document.getElementById('pi-preview'); if (piPrev) { piPrev.src = ''; piPrev.style.display = 'none'; }
      const piUrl   = document.getElementById('pi-url'); if (piUrl) piUrl.value = '';
      setTimeout(() => renderAdminProductList(), 1000);
    } else {
      showAdminMessage('add-msg', 'error', result.error || result.errors?.join(', ') || 'Failed to add product');
    }
  } catch (error) {
    console.error('Error adding product:', error);
    showAdminMessage('add-msg', 'error', 'An error occurred while adding the product');
  }
}

async function editProduct(productId) {
  const products = window.firebaseProducts || [];
  const product  = products.find(p => p.id === productId);

  if (!product) { showToast('Product not found', 'error'); return; }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('edit-pid', product.id);
  set('edit-pn',  product.name  || '');
  set('edit-pc',  product.cat   || 'attar');
  set('edit-pd',  product.desc  || '');
  set('edit-pb',  product.badge || '');
  set('edit-pf',  product.featured ? 'yes' : 'no');

  const sizesWrap = document.getElementById('edit-sizes-wrap');
  if (sizesWrap && product.sizes) {
    sizesWrap.innerHTML = '';
    product.sizes.forEach(size => {
      const entry = document.createElement('div');
      entry.className = 'size-entry';
      // FIX: use app.remSize() in onclick
      entry.innerHTML = `<div class="adm-field"><label>SIZE</label><input class="sz-ml" value="${esc(size.ml || '')}"></div><div class="adm-field"><label>PRICE</label><input class="sz-pr" value="${esc(size.price || '')}"></div><button class="rem-size-btn" onclick="app.remSize(this)" type="button">✕</button>`;
      sizesWrap.appendChild(entry);
    });
  }

  document.getElementById('edit-modal-overlay')?.classList.add('show');
}

async function doEditProduct() {
  try {
    const productId = document.getElementById('edit-pid')?.value;
    if (!productId) { showAdminMessage('edit-msg', 'error', 'Product ID not found'); return; }

    const name     = document.getElementById('edit-pn')?.value?.trim();
    const category = document.getElementById('edit-pc')?.value;
    const desc     = document.getElementById('edit-pd')?.value?.trim();
    const badge    = document.getElementById('edit-pb')?.value?.trim();
    const featured = document.getElementById('edit-pf')?.value === 'yes';

    if (!name || !category) { showAdminMessage('edit-msg', 'error', 'Product name and category are required'); return; }

    const sizes = [];
    document.querySelectorAll('#edit-sizes-wrap .size-entry').forEach(entry => {
      const ml    = entry.querySelector('.sz-ml')?.value?.trim();
      const price = entry.querySelector('.sz-pr')?.value?.trim();
      if (ml && price) sizes.push({ ml, price });
    });

    if (sizes.length === 0) { showAdminMessage('edit-msg', 'error', 'At least one size is required'); return; }

    const productData = { name, cat: category, desc: desc || '', badge: badge || '', featured, sizes };

    showAdminMessage('edit-msg', 'info', 'Updating product...');
    const result = await window.firebaseUpdateProduct(productId, productData);

    if (result.success) {
      showAdminMessage('edit-msg', 'ok', 'Product updated successfully!');
      closeEditModal();
      setTimeout(() => renderAdminProductList(), 1000);
    } else {
      showAdminMessage('edit-msg', 'error', result.error || 'Failed to update product');
    }
  } catch (error) {
    console.error('Error updating product:', error);
    showAdminMessage('edit-msg', 'error', 'An error occurred while updating the product');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

  try {
    showAdminMessage('manage-msg', 'info', 'Deleting product...');
    const result = await window.firebaseDeleteProduct(productId);

    if (result.success) {
      showAdminMessage('manage-msg', 'ok', 'Product deleted successfully!');
      setTimeout(() => renderAdminProductList(), 1000);
    } else {
      showAdminMessage('manage-msg', 'error', result.error || 'Failed to delete product');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    showAdminMessage('manage-msg', 'error', 'An error occurred while deleting the product');
  }
}

/* ════════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════════ */

export {
  initializeAdmin, showLoginModal, closeLoginModal, performSignIn, performSignOut,
  openAdminPanel, closeAdminPanel, switchAdminTab,
  renderAdminDashboard, renderAdminProductList, renderAdminReviewsList, renderAdminStock, renderAdminCategories,
  loadAdminSettings, saveSettings, saveContent, saveContact,
  showAdminMessage, openEditProductModal, closeEditModal,
  addProductSize, addEditSize, removeProductSize,
  doAddProduct, editProduct, doEditProduct, deleteProduct,
  doAddCategory, editCategory, doDeleteCategory,
  currentUser, adminPanelOpen
};
