/* ════════════════════════════════════════════════════════════════
   ADMIN APP — Stable Admin Authentication & Dashboard
════════════════════════════════════════════════════════════════ */

import { initializeFirebase, signInUser, signUpUser, getCurrentUserClaims, onAuthChanged, signOutUser, getProducts, addProduct, updateProduct, deleteProduct, getCategories, addCategory, updateCategory, deleteCategory, getReviews, updateReview, deleteReview, getSettings, saveSettings } from './modules/firebase.js';

// DOM Elements
const authView = document.getElementById('auth-view');
const deniedView = document.getElementById('access-denied');
const dashboardView = document.getElementById('admin-dashboard');
const errorBox = document.getElementById('login-error');
const userEmailEl = document.getElementById('admin-user-email');

// State
let currentUser = null;
let products = [];
let categories = [];
let reviews = [];

// Initialize Firebase
await initializeFirebase();

/* ════════════════════════════════════════════════════════════════
   AUTHENTICATION
════════════════════════════════════════════════════════════════ */

function showError(msg, type = 'error') {
  errorBox.style.display = 'block';
  errorBox.textContent = msg;
  errorBox.className = `login-error ${type}`;
}

function hideError() {
  errorBox.style.display = 'none';
}

// Login Handler
document.getElementById('login-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const email = document.getElementById('admin-email-inp').value.trim();
  const password = document.getElementById('admin-pass-inp').value;

  if (!email || !password) {
    showError('Email and password required.');
    return;
  }

  showError('Signing in...', 'info');

  const result = await signInUser(email, password);

  if (!result.success) {
    showError(result.error || 'Login failed.');
    return;
  }

  hideError();
});

// Signup Handler
document.getElementById('signup-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const email = document.getElementById('admin-email-inp').value.trim();
  const password = document.getElementById('admin-pass-inp').value;

  if (!email || !password) {
    showError('Email and password required.');
    return;
  }

  const result = await signUpUser(email, password);

  if (result.success) {
    showError('Account created. Admin access still requires Firebase custom claim.', 'info');
  } else {
    showError(result.error || 'Signup failed.');
  }
});

// Logout Handler
document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const result = await signOutUser();
  if (result.success) {
    currentUser = null;
    showAuthView();
  } else {
    showError('Sign out failed: ' + result.error);
  }
});

// Auth State Listener
onAuthChanged(async (user) => {
  currentUser = user;

  if (!user) {
    showAuthView();
    return;
  }

  try {
    const claims = await getCurrentUserClaims();

    if (claims.admin === true) {
      showDashboard(user.email);
      await loadData();
    } else {
      showDeniedView();
    }
  } catch (err) {
    console.error('Auth validation failed:', err);
    showError('Authentication validation failed.');
    showAuthView();
  }
});

/* ════════════════════════════════════════════════════════════════
   VIEW MANAGEMENT
════════════════════════════════════════════════════════════════ */

function showAuthView() {
  authView.style.display = 'flex';
  deniedView.style.display = 'none';
  dashboardView.style.display = 'none';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';
}

function showDeniedView() {
  authView.style.display = 'none';
  deniedView.style.display = 'block';
  dashboardView.style.display = 'none';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';
}

function showDashboard(email) {
  authView.style.display = 'none';
  deniedView.style.display = 'none';
  dashboardView.style.display = 'block';
  document.body.style.alignItems = 'flex-start';
  document.body.style.justifyContent = 'flex-start';
  userEmailEl.textContent = `Logged in as: ${email}`;
}

/* ════════════════════════════════════════════════════════════════
   DATA LOADING
════════════════════════════════════════════════════════════════ */

async function loadData() {
  try {
    products = await getProducts();
    categories = await getCategories();
    reviews = await getReviews();
    renderDashboard();
    renderProducts();
    renderCategories();
    renderReviews();
    await loadSettings();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD RENDERING
════════════════════════════════════════════════════════════════ */

function renderDashboard() {
  const statsEl = document.getElementById('dashboard-stats');
  const approvedReviews = reviews.filter(r => r.approved).length;
  const pendingReviews = reviews.filter(r => !r.approved).length;

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${products.length}</div>
      <div class="stat-label">TOTAL PRODUCTS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${approvedReviews}</div>
      <div class="stat-label">APPROVED REVIEWS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${pendingReviews}</div>
      <div class="stat-label">PENDING REVIEWS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${categories.length}</div>
      <div class="stat-label">CATEGORIES</div>
    </div>
  `;
}

function renderProducts() {
  const listEl = document.getElementById('product-list');
  if (products.length === 0) {
    listEl.innerHTML = '<div class="adm-empty">No products found.</div>';
    return;
  }

  listEl.innerHTML = products.map(p => `
    <div class="product-item">
      <div class="product-info">
        <div class="product-name">${escapeHtml(p.name || 'Unnamed')}</div>
        <div class="product-meta">${escapeHtml(p.cat || 'uncategorized')}</div>
        ${p.badge ? `<div class="product-badge">${escapeHtml(p.badge)}</div>` : ''}
      </div>
      <div class="product-actions">
        <button class="btn btn-sm btn-danger" onclick="window.adminDeleteProduct('${p.id}')">🗑 DELETE</button>
      </div>
    </div>
  `).join('');
}

function renderCategories() {
  const listEl = document.getElementById('category-list');
  if (categories.length === 0) {
    listEl.innerHTML = '<div class="adm-empty">No categories found.</div>';
    return;
  }

  listEl.innerHTML = categories.map(c => `
    <div class="product-item">
      <div class="product-info">
        <div class="product-name">${escapeHtml(c.name || 'Unnamed')}</div>
        <div class="product-meta">Slug: ${escapeHtml(c.slug || 'N/A')}</div>
      </div>
      <div class="product-actions">
        <button class="btn btn-sm btn-danger" onclick="window.adminDeleteCategory('${c.id}')">🗑 DELETE</button>
      </div>
    </div>
  `).join('');
}

function renderReviews() {
  const listEl = document.getElementById('review-list');
  if (reviews.length === 0) {
    listEl.innerHTML = '<div class="adm-empty">No reviews found.</div>';
    return;
  }

  listEl.innerHTML = reviews.map(r => `
    <div class="product-item">
      <div class="product-info">
        <div class="product-name">${escapeHtml(r.name || 'Anonymous')}</div>
        <div class="product-meta">${escapeHtml(r.product || 'Unknown')} • Rating: ${r.rating || 'N/A'}</div>
        <div class="product-meta" style="margin-top: 0.3rem;">${escapeHtml(r.text || '')}</div>
        <div class="product-badge" style="background: ${r.approved ? 'rgba(30,190,93,.2)' : 'rgba(226,160,63,.2)'}; color: ${r.approved ? 'var(--success)' : 'var(--warn)'};">
          ${r.approved ? 'APPROVED' : 'PENDING'}
        </div>
      </div>
      <div class="product-actions">
        ${!r.approved ? `<button class="btn btn-sm btn-outline" onclick="window.adminApproveReview('${r.id}')">✓ APPROVE</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="window.adminDeleteReview('${r.id}')">🗑 DELETE</button>
      </div>
    </div>
  `).join('');
}

async function loadSettings() {
  try {
    const settings = await getSettings();
    if (settings) {
      document.getElementById('s-name').value = settings.name || '';
      document.getElementById('s-tag').value = settings.tag || '';
      document.getElementById('s-wa').value = settings.wa || '';
      document.getElementById('s-ph').value = settings.ph || '';
      document.getElementById('s-em').value = settings.em || '';
      document.getElementById('s-hr').value = settings.hr || '';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT MANAGEMENT
════════════════════════════════════════════════════════════════ */

document.getElementById('add-product-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const name = document.getElementById('add-pn').value.trim();
  const cat = document.getElementById('add-pc').value;
  const desc = document.getElementById('add-pd').value.trim();
  const badge = document.getElementById('add-pb').value.trim();
  const featured = document.getElementById('add-pf').value === 'yes';

  if (!name || !cat) {
    showMessage('product-msg', 'error', 'Product name and category are required.');
    return;
  }

  const sizes = [];
  document.querySelectorAll('#add-sizes-wrap .size-entry').forEach(entry => {
    const ml = entry.querySelector('.sz-ml').value.trim();
    const price = entry.querySelector('.sz-pr').value.trim();
    if (ml && price) sizes.push({ ml, price });
  });

  if (sizes.length === 0) {
    showMessage('product-msg', 'error', 'At least one size is required.');
    return;
  }

  showMessage('product-msg', 'info', 'Adding product...');

  const productData = { name, cat, desc, badge, featured, sizes };
  const result = await addProduct(productData);

  if (result.success) {
    showMessage('product-msg', 'ok', 'Product added successfully!');
    clearProductForm();
    await loadData();
  } else {
    showMessage('product-msg', 'error', result.error || 'Failed to add product.');
  }
});

window.adminDeleteProduct = async (productId) => {
  if (!confirm('Are you sure you want to delete this product?')) return;

  const result = await deleteProduct(productId);
  if (result.success) {
    await loadData();
  } else {
    showMessage('product-msg', 'error', result.error || 'Failed to delete product.');
  }
};

function clearProductForm() {
  document.getElementById('add-pn').value = '';
  document.getElementById('add-pd').value = '';
  document.getElementById('add-pb').value = '';
  document.getElementById('add-pf').value = 'no';
  document.getElementById('add-sizes-wrap').innerHTML = `
    <div class="size-entry">
      <div class="adm-field"><label>SIZE</label><input class="sz-ml" placeholder="e.g. 3ml"></div>
      <div class="adm-field"><label>PRICE</label><input class="sz-pr" placeholder="e.g. PKR 650"></div>
      <button class="rem-size-btn" type="button" onclick="removeSizeEntry(this)">✕</button>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════════
   CATEGORY MANAGEMENT
════════════════════════════════════════════════════════════════ */

document.getElementById('add-category-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const name = document.getElementById('cat-name').value.trim();
  const slug = document.getElementById('cat-slug').value.trim();

  if (!name || !slug) {
    showMessage('category-msg', 'error', 'Category name and slug are required.');
    return;
  }

  showMessage('category-msg', 'info', 'Adding category...');

  const result = await addCategory({ name, slug });

  if (result.success) {
    showMessage('category-msg', 'ok', 'Category added successfully!');
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-slug').value = '';
    await loadData();
  } else {
    showMessage('category-msg', 'error', result.error || 'Failed to add category.');
  }
});

window.adminDeleteCategory = async (categoryId) => {
  if (!confirm('Are you sure you want to delete this category?')) return;

  const result = await deleteCategory(categoryId);
  if (result.success) {
    await loadData();
  } else {
    showMessage('category-msg', 'error', result.error || 'Failed to delete category.');
  }
};

/* ════════════════════════════════════════════════════════════════
   REVIEW MANAGEMENT
════════════════════════════════════════════════════════════════ */

window.adminApproveReview = async (reviewId) => {
  const result = await updateReview(reviewId, { approved: true });
  if (result.success) {
    await loadData();
  } else {
    console.error('Failed to approve review:', result.error);
  }
};

window.adminDeleteReview = async (reviewId) => {
  if (!confirm('Are you sure you want to delete this review?')) return;

  const result = await deleteReview(reviewId);
  if (result.success) {
    await loadData();
  } else {
    console.error('Failed to delete review:', result.error);
  }
};

/* ════════════════════════════════════════════════════════════════
   SETTINGS MANAGEMENT
════════════════════════════════════════════════════════════════ */

document.getElementById('save-settings-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const settings = {
    name: document.getElementById('s-name').value.trim(),
    tag: document.getElementById('s-tag').value.trim(),
    wa: document.getElementById('s-wa').value.trim(),
    ph: document.getElementById('s-ph').value.trim(),
    em: document.getElementById('s-em').value.trim(),
    hr: document.getElementById('s-hr').value.trim(),
  };

  showMessage('settings-msg', 'info', 'Saving settings...');

  const result = await saveSettings(settings);

  if (result.success) {
    showMessage('settings-msg', 'ok', 'Settings saved successfully!');
  } else {
    showMessage('settings-msg', 'error', result.error || 'Failed to save settings.');
  }
});

/* ════════════════════════════════════════════════════════════════
   TAB MANAGEMENT
════════════════════════════════════════════════════════════════ */

document.querySelectorAll('.adm-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Remove active class from all tabs
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('.adm-sec').forEach(s => s.classList.remove('on'));

    // Add active class to clicked tab
    tab.classList.add('on');

    // Show corresponding section
    const tabId = tab.dataset.tab;
    document.getElementById(tabId)?.classList.add('on');
  });
});

/* ════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
════════════════════════════════════════════════════════════════ */

function showMessage(elementId, type, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `adm-msg ${type}`;
  el.textContent = message;
  el.style.display = 'block';
  if (type === 'ok' || type === 'warn') {
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global functions for inline onclick handlers
window.removeSizeEntry = function(button) {
  const container = button.closest('.size-entry')?.parentElement;
  const entries = container?.querySelectorAll('.size-entry');
  if (entries && entries.length > 1) {
    button.closest('.size-entry').remove();
  }
};

window.addSizeEntry = function() {
  const container = document.getElementById('add-sizes-wrap');
  const entry = document.createElement('div');
  entry.className = 'size-entry';
  entry.innerHTML = `
    <div class="adm-field"><label>SIZE</label><input class="sz-ml" placeholder="e.g. 3ml"></div>
    <div class="adm-field"><label>PRICE</label><input class="sz-pr" placeholder="e.g. PKR 650"></div>
    <button class="rem-size-btn" type="button" onclick="removeSizeEntry(this)">✕</button>
  `;
  container.appendChild(entry);
};

console.log('✅ Admin app initialized');
