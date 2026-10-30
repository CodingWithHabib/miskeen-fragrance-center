import {
  initializeFirebase, signInUser, signOutUser, getCurrentUserClaims, onAuthChanged,
  getProducts, addProduct, updateProduct, deleteProduct,
  getCategories, addCategory, updateCategory, deleteCategory,
  getReviews, updateReview, deleteReview, getSettings, saveSettings,
  listenVisitorCount, listenStock, listenRTDBStats, updateStock
} from './modules/firebase.js';
import {
  updateCloudinaryConfig, compressImage, validateImageFile, uploadToCloudinary
} from './modules/cloudinary.js';
import { STORE } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const state = { products: [], categories: [], reviews: [], stock: {}, stats: {}, settings: {}, view: 'dashboard' };
let unsubscribe = [];

const authView = $('#auth-view');
const deniedView = $('#access-denied');
const shell = $('#dashboard-shell');
const viewRoot = $('#view-root');

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  $('#toast-region').append(item);
  setTimeout(() => item.remove(), 4200);
}

function setLoading(button, loading, label = 'Save changes') {
  if (!button) return;
  button.disabled = loading;
  button.dataset.label ||= button.textContent;
  button.textContent = loading ? 'Saving…' : (button.dataset.label || label);
}

function confirmAction(title, text) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  return new Promise(resolve => {
    const action = $('#confirm-action');
    const finish = (event) => {
      dialog.removeEventListener('close', finish);
      resolve(event.target.returnValue === 'confirm');
    };
    dialog.addEventListener('close', finish);
    action.onclick = () => dialog.close('confirm');
    dialog.showModal();
  });
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString() : '—';
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  const titles = {
    dashboard: ['Overview', 'Dashboard'], products: ['Catalog', 'Products'], categories: ['Catalog', 'Categories'],
    reviews: ['Moderation', 'Reviews'], stock: ['Inventory', 'Stock management'], settings: ['Configuration', 'Settings'],
    content: ['Storefront', 'Homepage content'], contact: ['Storefront', 'Contact details']
  };
  const [kicker, title] = titles[view];
  $('#view-kicker').textContent = kicker;
  $('#view-title').textContent = title;
  renderView();
  closeSidebar();
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebar-backdrop').classList.add('hidden');
}

function renderView() {
  const renderers = { dashboard: renderDashboard, products: renderProducts, categories: renderCategories, reviews: renderReviews, stock: renderStock, settings: renderSettings, content: renderContent, contact: renderContact };
  viewRoot.innerHTML = renderers[state.view]();
  bindViewEvents();
}

function renderDashboard() {
  const pending = state.reviews.filter(review => !review.approved).length;
  const lowStock = state.products.filter(product => Number(state.stock[product.id]?.quantity ?? product.stock ?? 0) <= 5).length;
  const totalOrders = Number(state.stats.totalOrders || 0);
  return `
    <div class="page-heading"><div><h1>Good to see you</h1><p>A clear view of your fragrance business at a glance.</p></div></div>
    <div class="stats-grid">
      ${stat('Total products', state.products.length, 'Live catalog')}
      ${stat('Total reviews', state.reviews.length, `${pending} pending`)}
      ${stat('Approved reviews', state.reviews.filter(item => item.approved).length, 'Publicly visible')}
      ${stat('Total orders', totalOrders || '—', totalOrders ? 'From order log' : 'Not available')}
      ${stat('Website visitors', state.visitorCount ?? '—', 'Currently online')}
      ${stat('Low stock items', lowStock, lowStock ? 'Needs attention' : 'Inventory healthy')}
      ${stat('Orders today', todayOrders(), 'Realtime data')}
      ${stat('Revenue', '—', 'Not recorded in current schema')}
    </div>
    <div class="dashboard-grid">
      <section class="panel"><h2>Attention required</h2>
        ${pending ? `<p>${pending} review${pending === 1 ? '' : 's'} waiting for moderation.</p>` : '<div class="empty-state">No pending reviews.</div>'}
        ${lowStock ? `<p>${lowStock} product${lowStock === 1 ? '' : 's'} at or below the low-stock threshold.</p>` : ''}
      </section>
      <section class="panel"><h2>Quick actions</h2><div class="quick-actions">
        <button class="secondary-button" data-go="products">Add a product</button>
        <button class="secondary-button" data-go="reviews">Review submissions</button>
        <button class="secondary-button" data-go="stock">Update inventory</button>
        <button class="secondary-button" data-go="settings">Store settings</button>
      </div></section>
    </div>`;
}

function stat(label, value, note) {
  return `<article class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
}

function todayOrders() {
  const key = new Date().toISOString().slice(0, 10);
  return state.stats.ordersToday?.[key] ?? '—';
}

function renderProducts() {
  return `<div class="page-heading"><div><h1>Products</h1><p>Manage the live fragrance catalog and pricing.</p></div><button class="primary-button" data-action="show-product-form">Add product</button></div>
    <div id="product-form-slot"></div>
    <div class="toolbar"><input id="product-search" placeholder="Search products…" aria-label="Search products"><select id="product-category-filter"><option value="">All categories</option>${state.categories.map(category => `<option value="${esc(category.slug || category.name)}">${esc(category.name)}</option>`).join('')}</select></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Sizes</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="products-body">${productRows(state.products)}</tbody></table></div>`;
}

function productRows(products) {
  if (!products.length) return '<tr><td colspan="7"><div class="empty-state">No products match your search.</div></td></tr>';
  return products.map(product => {
    const stock = Number(state.stock[product.id]?.quantity ?? product.stock ?? 0);
    const firstPrice = product.sizes?.[0]?.price || '—';
    const status = stock === 0 ? '<span class="badge danger">Out of stock</span>' : stock <= 5 ? '<span class="badge warning">Low stock</span>' : '<span class="badge success">In stock</span>';
    return `<tr><td><div class="product-cell">${product.img ? `<img src="${esc(product.img)}" alt="">` : '<span class="brand-mark">MF</span>'}<strong>${esc(product.name)}</strong></div></td><td>${esc(product.cat || 'Uncategorized')}</td><td>${esc(firstPrice)}</td><td>${esc(product.sizes?.length || 0)}</td><td>${stock}</td><td>${status}</td><td><div class="table-actions"><button class="small-button" data-edit-product="${esc(product.id)}">Edit</button><button class="small-button delete" data-delete-product="${esc(product.id)}">Delete</button></div></td></tr>`;
  }).join('');
}

function productForm(product = {}) {
  const sizes = product.sizes?.length ? product.sizes : [{ ml: '', price: '' }];
  return `<section class="panel" id="product-form"><h2>${product.id ? 'Edit product' : 'Add product'}</h2>
    <form id="product-editor" data-product-id="${esc(product.id || '')}" novalidate>
      <div class="form-grid">
        <div><label for="product-name">Product name</label><input id="product-name" name="name" value="${esc(product.name)}" required></div>
        <div><label for="product-category">Category</label><select id="product-category" name="cat" required><option value="">Select category</option>${state.categories.map(category => `<option value="${esc(category.slug || category.name)}" ${category.slug === product.cat || category.name === product.cat ? 'selected' : ''}>${esc(category.name)}</option>`).join('')}</select></div>
        <div class="full"><label for="product-description">Description</label><textarea id="product-description" name="desc" rows="3">${esc(product.desc)}</textarea></div>
        <div><label for="product-badge">Badge</label><input id="product-badge" name="badge" value="${esc(product.badge)}" placeholder="NEW, PREMIUM…"></div>
        <div><label for="product-tags">Tags</label><input id="product-tags" name="tags" value="${esc(Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || '')}"></div>
        <div><label for="product-image">Image URL</label><input id="product-image" name="img" type="url" value="${esc(product.img)}"></div>
        <div><label for="product-file">Upload image</label><input id="product-file" type="file" accept="image/jpeg,image/png,image/webp"><small id="upload-status"></small></div>
        <div><label><input type="checkbox" name="featured" ${product.featured ? 'checked' : ''}> Featured on homepage</label></div>
      </div>
      <div class="section-title">Sizes and prices</div><div id="size-editor">${sizes.map(size => sizeRow(size)).join('')}</div>
      <button class="small-button" type="button" data-action="add-size">+ Add size</button>
      <div class="form-actions"><button class="secondary-button" type="button" data-action="cancel-form">Cancel</button><button class="primary-button" type="submit">Save product</button></div>
    </form></section>`;
}

function sizeRow(size = {}) {
  return `<div class="size-row"><input class="size-ml" placeholder="Size (e.g. 3ml)" value="${esc(size.ml)}" required><input class="size-price" placeholder="Price (e.g. PKR 650)" value="${esc(size.price)}" required><button type="button" class="small-button delete" data-action="remove-size">Remove</button></div>`;
}

function renderCategories() {
  const counts = state.products.reduce((map, product) => { map[product.cat] = (map[product.cat] || 0) + 1; return map; }, {});
  return `<div class="page-heading"><div><h1>Categories</h1><p>Keep catalog classifications consistent and searchable.</p></div></div>
    <section class="panel"><form id="category-form" class="form-grid"><div><label for="category-name">Category name</label><input id="category-name" required></div><div><label for="category-slug">Slug</label><input id="category-slug" required pattern="[a-z0-9-]+"></div><div class="form-actions full"><button id="category-submit" class="primary-button" type="submit">Add category</button><button id="category-cancel" class="secondary-button hidden" type="button">Cancel edit</button></div></form></section>
    <div class="table-wrap" style="margin-top:1rem"><table><thead><tr><th>Name</th><th>Slug</th><th>Products</th><th>Actions</th></tr></thead><tbody>${state.categories.length ? state.categories.map(category => `<tr><td>${esc(category.name)}</td><td>${esc(category.slug)}</td><td>${counts[category.slug] || counts[category.name] || 0}</td><td><div class="table-actions"><button class="small-button" data-edit-category="${esc(category.id)}">Edit</button><button class="small-button delete" data-delete-category="${esc(category.id)}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="4"><div class="empty-state">No categories found.</div></td></tr>'}</tbody></table></div>`;
}

function renderReviews() {
  return `<div class="page-heading"><div><h1>Reviews</h1><p>Moderate customer feedback before it reaches the storefront.</p></div></div>
    <div class="toolbar"><select id="review-filter"><option value="">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option></select><input id="review-search" placeholder="Search reviews…"></div>
    <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Product</th><th>Rating</th><th>Review</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="reviews-body">${reviewRows(state.reviews)}</tbody></table></div>`;
}

function reviewRows(reviews) {
  if (!reviews.length) return '<tr><td colspan="7"><div class="empty-state">No reviews found.</div></td></tr>';
  return reviews.map(review => `<tr><td>${esc(review.name || 'Anonymous')}</td><td>${esc(review.product || '—')}</td><td>${'★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</td><td>${esc(review.text || '')}</td><td>${formatDate(review.createdAt)}</td><td>${review.approved ? '<span class="badge success">Approved</span>' : '<span class="badge warning">Pending</span>'}</td><td><div class="table-actions">${!review.approved ? `<button class="small-button" data-approve-review="${esc(review.id)}">Approve</button>` : ''}<button class="small-button delete" data-delete-review="${esc(review.id)}">Delete</button></div></td></tr>`).join('');
}

function renderStock() {
  return `<div class="page-heading"><div><h1>Stock management</h1><p>Inventory is stored in the existing Realtime Database stock path.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Status</th><th>Update</th></tr></thead><tbody>${state.products.length ? state.products.map(product => { const quantity = Number(state.stock[product.id]?.quantity ?? product.stock ?? 0); const badge = quantity === 0 ? '<span class="badge danger">Out of stock</span>' : quantity <= 5 ? '<span class="badge warning">Low stock</span>' : '<span class="badge success">In stock</span>'; return `<tr><td>${esc(product.name)}</td><td>${esc(product.cat || '—')}</td><td>${quantity}</td><td>${badge}</td><td><form class="stock-form" data-stock-id="${esc(product.id)}"><input type="number" min="0" value="${quantity}" aria-label="Stock for ${esc(product.name)}"><button class="small-button" type="submit">Update</button></form></td></tr>`; }).join('') : '<tr><td colspan="5"><div class="empty-state">No products found.</div></td></tr>'}</tbody></table></div>`;
}

function settingsForm(kind) {
  const fields = {
    settings: [['name', 'Store name'], ['tag', 'Tagline'], ['ftdesc', 'Footer description', 'textarea'], ['copy', 'Copyright'], ['title', 'Page title'], ['cloudName', 'Cloudinary cloud name'], ['uploadPreset', 'Cloudinary upload preset']],
    content: [['heroEyebrow', 'Hero eyebrow'], ['heroFeaturedName', 'Featured product name'], ['heroDesc', 'Hero description', 'textarea'], ['aboutTitle', 'About section title'], ['aboutP1', 'About paragraph one', 'textarea'], ['aboutP2', 'About paragraph two', 'textarea']],
    contact: [['wa', 'WhatsApp number'], ['ph', 'Phone number'], ['em', 'Email address', 'email'], ['hr', 'Business hours'], ['ig', 'Instagram URL', 'url'], ['fb', 'Facebook URL', 'url']]
  }[kind];
  return `<form id="${kind}-form" class="panel"><div class="form-grid">${fields.map(([key, label, type]) => `<div class="${type === 'textarea' ? 'full' : ''}"><label for="${kind}-${key}">${label}</label>${type === 'textarea' ? `<textarea id="${kind}-${key}" name="${key}" rows="4">${esc(state.settings[key])}</textarea>` : `<input id="${kind}-${key}" name="${key}" type="${type || 'text'}" value="${esc(state.settings[key])}">`}</div>`).join('')}</div><div class="form-actions"><button class="primary-button" type="submit">Save changes</button></div></form>`;
}

function renderSettings() { return `<div class="page-heading"><div><h1>Settings</h1><p>Update store identity and the safe Cloudinary upload configuration.</p></div></div>${settingsForm('settings')}`; }
function renderContent() { return `<div class="page-heading"><div><h1>Homepage content</h1><p>These fields map directly to the public storefront settings.</p></div></div>${settingsForm('content')}`; }
function renderContact() { return `<div class="page-heading"><div><h1>Contact details</h1><p>Keep public contact links and business hours current.</p></div></div>${settingsForm('contact')}`; }

function valuesFromForm(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
}

async function handleProductSubmit(form) {
  const data = valuesFromForm(form);
  if (!data.name || !data.cat) return toast('Product name and category are required.', 'error');
  const sizes = [...form.querySelectorAll('.size-row')].map(row => ({ ml: $('.size-ml', row).value.trim(), price: $('.size-price', row).value.trim() })).filter(size => size.ml && size.price);
  if (!sizes.length) return toast('Add at least one valid size and price.', 'error');
  const file = $('#product-file', form);
  if (file?.files[0]) {
    const error = validateImageFile(file.files[0]);
    if (error) return toast(error, 'error');
    try {
      $('#upload-status', form).textContent = 'Uploading…';
      data.img = await uploadToCloudinary(await compressImage(file.files[0]), 'upload-status', null);
    } catch (error) { return toast(error.message, 'error'); }
  }
  const product = { name: data.name, cat: data.cat, desc: data.desc || '', badge: data.badge || '', tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [], featured: form.elements.featured.checked, img: data.img || '', sizes };
  const id = form.dataset.productId;
  const result = id ? await updateProduct(id, product) : await addProduct(product);
  if (!result.success) return toast(result.error || 'Could not save product.', 'error');
  toast(id ? 'Product updated.' : 'Product added.');
  await loadData();
  setView('products');
}

async function loadData() {
  const [products, categories, reviews, settings] = await Promise.all([getProducts(), getCategories(), getReviews(), getSettings()]);
  state.products = products; state.categories = categories; state.reviews = reviews; state.settings = settings || {};
  Object.assign(STORE, state.settings);
  updateCloudinaryConfig();
  renderView();
}

function bindViewEvents() {
  $('[data-action="show-product-form"]')?.addEventListener('click', () => { $('#product-form-slot').innerHTML = productForm(); $('#product-form').scrollIntoView({ behavior: 'smooth' }); bindViewEvents(); });
  $('[data-action="cancel-form"]')?.addEventListener('click', () => { $('#product-form-slot').innerHTML = ''; });
  $('[data-action="add-size"]')?.addEventListener('click', () => $('#size-editor').insertAdjacentHTML('beforeend', sizeRow()));
  document.querySelectorAll('[data-action="remove-size"]').forEach(button => button.addEventListener('click', () => button.closest('.size-row').remove()));
  $('#product-editor')?.addEventListener('submit', event => { event.preventDefault(); handleProductSubmit(event.currentTarget); });
  document.querySelectorAll('[data-edit-product]').forEach(button => button.addEventListener('click', () => { const product = state.products.find(item => item.id === button.dataset.editProduct); $('#product-form-slot').innerHTML = productForm(product); bindViewEvents(); $('#product-form').scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-delete-product]').forEach(button => button.addEventListener('click', async () => { if (!await confirmAction('Delete product?', 'This removes the product from the live catalog.')) return; const result = await deleteProduct(button.dataset.deleteProduct); if (!result.success) return toast(result.error, 'error'); toast('Product deleted.'); await loadData(); }));
  $('#product-search')?.addEventListener('input', filterProducts);
  $('#product-category-filter')?.addEventListener('change', filterProducts);
  $('#category-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const data = valuesFromForm(form); const result = form.dataset.categoryId ? await updateCategory(form.dataset.categoryId, data) : await addCategory(data); if (!result.success) return toast(result.error, 'error'); if (result.duplicate) return toast('That category already exists.', 'error'); toast(form.dataset.categoryId ? 'Category updated.' : 'Category added.'); await loadData(); });
  $('#category-cancel')?.addEventListener('click', () => { $('#category-form').reset(); delete $('#category-form').dataset.categoryId; $('#category-submit').textContent = 'Add category'; $('#category-cancel').classList.add('hidden'); });
  document.querySelectorAll('[data-edit-category]').forEach(button => button.addEventListener('click', () => { const category = state.categories.find(item => item.id === button.dataset.editCategory); const form = $('#category-form'); form.dataset.categoryId = category.id; $('#category-name').value = category.name || ''; $('#category-slug').value = category.slug || ''; $('#category-submit').textContent = 'Update category'; $('#category-cancel').classList.remove('hidden'); form.scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('[data-delete-category]').forEach(button => button.addEventListener('click', async () => { const category = state.categories.find(item => item.id === button.dataset.deleteCategory); if (state.products.some(product => product.cat === category.slug || product.cat === category.name)) return toast('Move products to another category before deleting this category.', 'error'); if (!await confirmAction('Delete category?', 'This category is not referenced by any current product.')) return; const result = await deleteCategory(category.id); if (!result.success) return toast(result.error, 'error'); toast('Category deleted.'); await loadData(); }));
  $('#review-filter')?.addEventListener('change', filterReviews); $('#review-search')?.addEventListener('input', filterReviews);
  document.querySelectorAll('[data-approve-review]').forEach(button => button.addEventListener('click', async () => { const result = await updateReview(button.dataset.approveReview, { approved: true }); if (!result.success) return toast(result.error, 'error'); toast('Review approved.'); await loadData(); }));
  document.querySelectorAll('[data-delete-review]').forEach(button => button.addEventListener('click', async () => { if (!await confirmAction('Delete review?', 'This permanently removes the review from Firebase.')) return; const result = await deleteReview(button.dataset.deleteReview); if (!result.success) return toast(result.error, 'error'); toast('Review deleted.'); await loadData(); }));
  document.querySelectorAll('.stock-form').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const input = $('input', form); const quantity = Number(input.value); if (!Number.isInteger(quantity) || quantity < 0) return toast('Stock must be a non-negative whole number.', 'error'); const result = await updateStock(form.dataset.stockId, quantity); if (!result.success) return toast(result.error, 'error'); toast('Stock updated.'); await loadData(); }));
  ['settings', 'content', 'contact'].forEach(kind => $(`#${kind}-form`)?.addEventListener('submit', async event => { event.preventDefault(); const data = valuesFromForm(event.currentTarget); const button = $('button[type="submit"]', event.currentTarget); setLoading(button, true); const result = await saveSettings(data); setLoading(button, false); if (!result.success) return toast(result.error, 'error'); state.settings = { ...state.settings, ...data }; Object.assign(STORE, data); updateCloudinaryConfig(); toast('Changes saved.'); }));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));
}

function filterProducts() {
  const search = ($('#product-search')?.value || '').toLowerCase();
  const category = $('#product-category-filter')?.value || '';
  const filtered = state.products.filter(product => (!search || `${product.name} ${product.desc}`.toLowerCase().includes(search)) && (!category || product.cat === category));
  $('#products-body').innerHTML = productRows(filtered); bindViewEvents();
}

function filterReviews() {
  const filter = $('#review-filter')?.value || ''; const search = ($('#review-search')?.value || '').toLowerCase();
  const filtered = state.reviews.filter(review => (!filter || (filter === 'approved' ? review.approved : !review.approved)) && (!search || `${review.name} ${review.product} ${review.text}`.toLowerCase().includes(search)));
  $('#reviews-body').innerHTML = reviewRows(filtered); bindViewEvents();
}

function subscribeData() {
  unsubscribe.push(listenVisitorCount(count => { state.visitorCount = count; if (state.view === 'dashboard') renderView(); }));
  unsubscribe.push(listenStock(stock => { state.stock = stock; if (state.view === 'dashboard' || state.view === 'stock') renderView(); }));
  unsubscribe.push(listenRTDBStats(stats => { state.stats = stats; if (state.view === 'dashboard') renderView(); }));
}

async function enterDashboard(user) {
  const claims = await getCurrentUserClaims();
  if (claims.admin !== true) { authView.classList.add('hidden'); shell.classList.add('hidden'); deniedView.classList.remove('hidden'); return; }
  authView.classList.add('hidden'); deniedView.classList.add('hidden'); shell.classList.remove('hidden');
  $('#profile-email').textContent = user.email || 'Administrator'; $('#profile-initials').textContent = (user.email || 'A')[0].toUpperCase();
  $('#current-date').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());
  await loadData(); subscribeData();
}

$('#admin-nav').addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) setView(button.dataset.view); });
$('#sidebar-toggle').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#sidebar-backdrop').classList.remove('hidden'); });
$('#sidebar-backdrop').addEventListener('click', closeSidebar);
$('#logout-btn').addEventListener('click', async () => { unsubscribe.forEach(stop => typeof stop === 'function' && stop()); unsubscribe = []; await signOutUser(); });
$('#denied-signout').addEventListener('click', () => signOutUser());
$('#toggle-password').addEventListener('click', () => { const input = $('#admin-pass-inp'); input.type = input.type === 'password' ? 'text' : 'password'; $('#toggle-password').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
$('#admin-login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#login-btn'); const email = $('#admin-email-inp').value.trim(); const password = $('#admin-pass-inp').value; $('#login-error').textContent = '';
  if (!email || !password) return $('#login-error').textContent = 'Enter your email and password.';
  button.disabled = true; button.textContent = 'Signing in…';
  const result = await signInUser(email, password);
  if (!result.success) { $('#login-error').textContent = result.error; button.disabled = false; button.textContent = 'Sign in'; }
});

try {
  await initializeFirebase();
  onAuthChanged(async user => {
    if (!user) { authView.classList.remove('hidden'); shell.classList.add('hidden'); deniedView.classList.add('hidden'); return; }
    try { await enterDashboard(user); } catch (error) { console.error('Admin authorization failed:', error); authView.classList.add('hidden'); shell.classList.add('hidden'); deniedView.classList.remove('hidden'); $('#access-denied-message').textContent = 'We could not verify administrator access. Please reload and try again.'; }
  });
} catch (error) {
  console.error('Firebase initialization failed:', error);
  $('#login-error').textContent = 'Could not connect to Firebase. Check your connection and configuration.';
  $('#login-btn').disabled = true;
}
