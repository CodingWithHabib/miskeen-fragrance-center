import { initializeFirebase, getSettings, saveSettings as firebaseSaveSettings, listenProducts, listenReviews, listenStock, listenRTDBStats, listenVisitorCount, listenCategories, initPresence, seedIfEmpty, addProduct, updateProduct, deleteProduct as firebaseDeleteProduct } from './modules/firebase.js';
import { initializeCloudinary, updateCloudinaryConfig, uploadToCloudinary } from './modules/cloudinary.js';
import { initializeServices } from './modules/services.js';
import { initializeProducts, filterProducts, handleSearch, renderAllProducts, selectProductSize, changeProductQuantity, orderProductViaWhatsApp } from './modules/products.js';
import { initializeAdmin, showLoginModal, closeLoginModal, performSignIn, performSignOut, openAdminPanel, closeAdminPanel, switchAdminTab, closeEditModal, addProductSize, addEditSize, removeProductSize, doAddProduct, editProduct, doEditProduct, deleteProduct, saveSettings, saveContent, saveContact, doAddCategory, editCategory, doDeleteCategory } from './modules/admin.js';
import { initializeReviews, handleReviewSubmission, deleteReview, approveReview } from './modules/reviews.js';
import { initializeUtils } from './modules/utils.js';
import { STORE, products, reviews, showToast, state } from './config.js';

/* ════════════════════════════════════════════════════════════════
   MAIN APPLICATION ORCHESTRATOR
════════════════════════════════════════════════════════════════ */

let currentFilter   = 'all';
let searchQuery     = '';
let selSizes        = {};
let quantities      = {};
let currentUser     = null;
let adminPanelOpen  = false;
let stockData       = {};
let rtdbStats       = {};
let visitorRef      = null;

function previewFileInput(event, previewId) {
  const file = event?.target?.files?.[0];
  const preview = document.getElementById(previewId);
  if (!preview) return;
  if (file) {
    const reader = new FileReader();
    reader.onload = () => { preview.src = reader.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
}

function prevProdImg(event) { previewFileInput(event, 'pi-preview'); }
function prevEditImg(event) { previewFileInput(event, 'edit-pi-preview'); }

// Expose essential functions globally BEFORE DOM READY
window.app = {
  goPage,
  toggleMobile,
  toast: showToast,
  updateWALinks,
  updateUIFromSettings,
  filterProds: filterProducts,
  renderAllProducts,
  handleSearch,
  selectProductSize,
  changeProductQuantity,
  orderProductViaWhatsApp,
  showLoginModal,
  closeLoginModal,
  performSignIn,
  performSignOut,
  openAdminPanel,
  closeAdminPanel,
  switchAdminTab,
  handleReviewSubmission,
  deleteReview,
  approveReview,
  swAdmTab: switchAdminTab,
  doLogin: performSignIn,
  doLogout: performSignOut,
  closeLogin: closeLoginModal,
  closeAdmin: closeAdminPanel,
  doAddProd: doAddProduct,
  doEditProd: doEditProduct,
  editProduct,
  deleteProduct,
  saveContent,
  saveContact,
  saveSettings,
  addSize: addProductSize,
  addEditSize,
  remSize: removeProductSize,
  prevProdImg,
  prevEditImg,
  addCategory: doAddCategory,
  editCategory,
  doDeleteCategory,
   openImage: (el) => {
    const img = el.querySelector("img");
    const modal = document.getElementById("imgModal");
    const modalImg = document.getElementById("modalImg");

    if (!img || !modal || !modalImg) return;

    modal.style.display = "flex";
    modalImg.src = img.src;
  },

  closeImage: () => {
    const modal = document.getElementById("imgModal");
    if (modal) modal.style.display = "none";
  },
  applyHeroImg: async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imgWrap = document.getElementById('hero-img-wrap');
      if (imgWrap) imgWrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div>Loading...</div></div>';
      const imageUrl = await uploadToCloudinary(file);
      const result = await firebaseSaveSettings({ heroImgUrl: imageUrl });
      if (result.success) {
        STORE.heroImgUrl = imageUrl;
        updateUIFromSettings();
        showToast('Hero image updated successfully!', 'success');
      } else {
        throw new Error(result.error || 'Failed to save hero image');
      }
    } catch (error) {
      console.error('Error uploading hero image:', error);
      showToast('Failed to upload hero image: ' + error.message, 'error');
      event.target.value = '';
      updateUIFromSettings();
    }
  },
  closeEditModal,

  // Contact form — build WhatsApp message from form fields and open WA
  sendContactWA: () => {
    const name    = (document.getElementById('cf-name')?.value || '').trim();
    const phone   = (document.getElementById('cf-phone')?.value || '').trim();
    const city    = (document.getElementById('cf-city')?.value || '').trim();
    const product = (document.getElementById('cf-product')?.value || '').trim();
    const message = (document.getElementById('cf-msg')?.value || '').trim();

    if (!name || !message) {
      showToast('Please enter your name and message', 'warn');
      return;
    }

    const lines = ['السلام عليكم', '', '*New Enquiry — Miskeen Fragrance Center*', '', `👤 *Name:* ${name}`];
    if (phone)   lines.push(`📞 *Phone:* ${phone}`);
    if (city)    lines.push(`📍 *City:* ${city}`);
    if (product) lines.push(`🌺 *Product Interest:* ${product}`);
    lines.push('', '💬 *Message:*', message);

    const waNumber = (STORE.wa || '+923001234567').replace(/\D/g, '');
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');

    const successEl = document.getElementById('contact-success');
    if (successEl) { successEl.style.display = 'block'; setTimeout(() => { successEl.style.display = 'none'; }, 5000); }
    showToast('Opening WhatsApp...', 'success');
  },

  submitReview: handleReviewSubmission,

};

// Global bindings for inline HTML handlers
window.selectSize        = selectProductSize;
window.changeQuantity    = changeProductQuantity;
window.orderOnWhatsApp   = orderProductViaWhatsApp;
window.removeProductSize = removeProductSize;   // FIX: expose for dynamically generated size buttons

/* ════════════════════════════════════════════════════════════════
   APPLICATION INITIALIZATION
════════════════════════════════════════════════════════════════ */

async function initializeApp() {
  try {
    await initializeFirebase();
    await initializeCloudinary();
    await initializeServices();
    await initializeProducts();
    await initializeAdmin();
    await initializeReviews();
    await initializeUtils();

    initializeNavigation();
    initializeScrollEffects();
    initializeKeyboardShortcuts();

    window.firebaseAddProduct    = addProduct;
    window.firebaseUpdateProduct = updateProduct;
    window.firebaseDeleteProduct = firebaseDeleteProduct;

    listenProducts(async (prods) => {
      window.firebaseProducts = prods;
      state.setProducts(prods);
      try {
        const m = await import('./modules/products.js');
        m.renderFeaturedProducts();
        m.renderAllProducts();
      } catch (err) {
        console.error('Failed to render products:', err);
      }
      if (document.getElementById('admin-panel')?.classList.contains('show')) {
        try {
          const m = await import('./modules/admin.js');
          m.renderAdminProductList();
        } catch (err) {
          console.error('Failed to render admin products:', err);
        }
      }
    });

    listenReviews(async (revs) => {
      window.firebaseReviews = revs;
      state.setReviews(revs);
      try {
        const m = await import('./modules/reviews.js');
        m.renderAllReviews(revs);
      } catch (err) {
        console.error('Failed to render reviews:', err);
      }
      if (document.getElementById('admin-panel')?.classList.contains('show')) {
        try {
          const m = await import('./modules/admin.js');
          m.renderAdminReviewsList();
        } catch (err) {
          console.error('Failed to render admin reviews:', err);
        }
      }
    });

    listenStock((sd) => {
      window.firebaseStock = sd;
      if (document.getElementById('admin-panel')?.classList.contains('show')) {
        import('./modules/admin.js').then(m => m.renderAdminStock());
      }
    });

    listenRTDBStats((stats) => { window.firebaseRTDBStats = stats; });

    listenCategories((cats) => {
      window.firebaseCategories = cats;
      renderCategoryButtons(cats);
      updateCategoryDropdowns(cats);
    });

    await loadSettings();
    await seedIfEmpty();
    initPresence();

    // FIX: pass callback so live visitor badge actually updates
    listenVisitorCount((count) => {
      const badge   = document.getElementById('live-visitor-badge');
      const countEl = document.getElementById('live-visitor-count');
      if (countEl) countEl.textContent = count;
      if (badge)   badge.style.display = count > 0 ? 'flex' : 'none';
    });

    console.log('✅ Miskeen Fragrance Center initialized successfully');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    showToast('⚠ Could not connect to Firebase. Check your configuration.', 'error');
  }
}

/* ════════════════════════════════════════════════════════════════
   NAVIGATION SYSTEM
════════════════════════════════════════════════════════════════ */

function goPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.onclick) {
      try { link.classList.toggle('active', link.onclick.toString().includes(pageId)); } catch (e) {}
    }
  });
  if (pageId === 'products') renderAllProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobile() {
  document.getElementById('mobile-nav')?.classList.toggle('open');
}

function initializeNavigation() {
  window.goPage = goPage;
  window.toggleMobile = toggleMobile;
}

/* ════════════════════════════════════════════════════════════════
   UI EFFECTS & INTERACTIONS
════════════════════════════════════════════════════════════════ */

function initializeScrollEffects() {
  window.addEventListener('scroll', () => {
    document.getElementById('site-header')?.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  const btn = document.getElementById('back-to-top');
  if (btn) {
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

function initializeKeyboardShortcuts() {
  // FIX: use the correct imported function names — no more undefined closeLogin/closeAdmin/showLogin
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('edit-modal-overlay')?.classList.contains('show')) { closeEditModal();   return; }
      if (document.getElementById('admin-login-overlay')?.classList.contains('show')) { closeLoginModal(); return; }
      if (document.getElementById('admin-panel')?.classList.contains('show'))         { closeAdminPanel(); return; }
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS MANAGEMENT
════════════════════════════════════════════════════════════════ */

async function loadSettings() {
  try {
    const settings = await getSettings();
    Object.assign(STORE, settings);
    updateCloudinaryConfig();
    updateUIFromSettings();
  } catch (error) {
    console.warn('Could not load settings:', error);
  }
}

function updateUIFromSettings() {
  // Header
  const hdrName = document.getElementById('hdr-logo-name');
  const hdrTag  = document.getElementById('hdr-logo-tag');
  if (hdrName) hdrName.textContent = STORE.name || 'Miskeen Fragrance Center';
  if (hdrTag)  hdrTag.textContent  = STORE.tag  || 'WHERE SCENT BECOMES SOUL';

  // Hero
  const heroEyebrow = document.getElementById('hero-eyebrow-text');
  const heroDesc    = document.getElementById('hero-desc');
  const heroFeat    = document.getElementById('hero-featured-name');
  const heroWrap    = document.getElementById('hero-img-wrap');
  if (heroEyebrow) heroEyebrow.textContent = STORE.heroEyebrow     || 'Premium Online Attar Store';
  if (heroDesc)    heroDesc.textContent    = STORE.heroDesc        || '100% natural, alcohol-free attars sourced from the finest botanicals. Browse our collection and order instantly via WhatsApp — delivered anywhere in Pakistan.';
  if (heroFeat)    heroFeat.textContent    = STORE.heroFeaturedName || 'Office For Men';
  if (heroWrap) {
    const featName = STORE.heroFeaturedName || 'Office For Men';
    if (STORE.heroImgUrl) {
      heroWrap.innerHTML = `<img src="${STORE.heroImgUrl}" alt="Hero Image" style="width:100%;height:100%;object-fit:cover;"><div class="hero-float-badge"><div class="hfb-label">FEATURED</div><div class="hfb-val" id="hero-featured-name">${featName}</div></div>`;
    } else {
      heroWrap.innerHTML = `<div class="hero-img-placeholder"><span class="big">🌺</span><p>MISKEEN FRAGRANCE</p></div><div class="hero-float-badge"><div class="hfb-label">FEATURED</div><div class="hfb-val" id="hero-featured-name">${featName}</div></div>`;
    }
  }

  // About
  const aboutTitle = document.getElementById('about-title');
  const aboutP1    = document.getElementById('about-text1');
  const aboutP2    = document.getElementById('about-text2');
  if (aboutTitle) aboutTitle.innerHTML   = STORE.aboutTitle || 'Pure <em>Fragrance</em>,<br>Delivered Online';
  if (aboutP1)    aboutP1.textContent    = STORE.aboutP1    || 'Miskeen Fragrance Center is a 100% online attar store dedicated to bringing you the finest, most authentic non-alcoholic perfumes straight from trusted sources to your doorstep anywhere in Pakistan.';
  if (aboutP2)    aboutP2.textContent    = STORE.aboutP2    || "We believe that fragrance is personal — it tells your story, lifts your spirit, and connects you to something timeless. That's why we carefully curate every attar in our collection, ensuring purity, longevity, and authenticity in every drop.";

  // Footer
  const ftName = document.getElementById('ft-logo-name');
  const ftTag  = document.getElementById('ft-logo-tag');
  const ftDesc = document.getElementById('ft-desc');
  const ftCopy = document.getElementById('ft-copy');
  if (ftName) ftName.textContent = STORE.name   || 'Miskeen Fragrance Center';
  if (ftTag)  ftTag.textContent  = STORE.tag    || 'WHERE SCENT BECOMES SOUL';
  if (ftDesc) ftDesc.textContent = STORE.ftdesc || "Pakistan's online attar & perfume store. Pure, natural, alcohol-free fragrances delivered to your doorstep.";
  if (ftCopy) ftCopy.textContent = STORE.copy   || '© 2026 Miskeen Fragrance Center. All Rights Reserved.';

  // Contact info
  const cPhoneNum  = document.getElementById('contact-phone-num');
  const cEmailVal  = document.getElementById('contact-email-val');
  const cHours     = document.getElementById('contact-hours');
  const cPhoneLink = document.getElementById('contact-phone-link');
  const cEmailLink = document.getElementById('contact-email-link');
  if (cPhoneNum)  cPhoneNum.textContent  = STORE.ph || '+92 300 1234567';
  if (cEmailVal)  cEmailVal.textContent  = STORE.em || 'info@miskeenfragrance.com';
  if (cHours)     cHours.textContent     = STORE.hr || 'Mon–Sat 9am–9pm · Sun 11am–6pm';
  if (cPhoneLink) cPhoneLink.href        = `tel:${STORE.ph || '+923001234567'}`;
  if (cEmailLink) cEmailLink.href        = `mailto:${STORE.em || 'info@miskeenfragrance.com'}`;

  // Page title
  if (STORE.title) document.title = STORE.title;

  updateWALinks();
}

function updateWALinks() {
  const waNumber = (STORE.wa || '+923001234567').replace(/\D/g, '');
  const waUrl    = `https://wa.me/${waNumber}`;

  ['wa-sticky-link','hdr-wa-btn','hero-wa-btn','mob-wa-btn','ft-wa-link','contact-wa-link'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = waUrl;
  });

  const cWaNum = document.getElementById('contact-wa-num');
  if (cWaNum) cWaNum.textContent = STORE.ph || STORE.wa || '+92 300 1234567';

  if (STORE.ig) { const el = document.getElementById('ft-ig'); if (el) el.href = STORE.ig; }
  if (STORE.fb) { const el = document.getElementById('ft-fb'); if (el) el.href = STORE.fb; }
}

function renderCategoryButtons(categories) {
  const catBar = document.querySelector('.cat-bar');
  if (!catBar) return;

  const currentFilter = document.querySelector('.cat-btn.active')?.dataset.category || 'all';

  catBar.innerHTML = `
    <button class="cat-btn ${currentFilter === 'all' ? 'active' : ''}" data-category="all" onclick="app.filterProds('all',this)">ALL</button>
    ${categories.map(cat => `
      <button class="cat-btn ${currentFilter === cat.slug ? 'active' : ''}" data-category="${cat.slug}" onclick="app.filterProds('${cat.slug}',this)">${cat.name.toUpperCase()}</button>
    `).join('')}
  `;
}

function updateCategoryDropdowns(categories) {
  const dropdowns = ['pc', 'edit-pc'];
  dropdowns.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = categories.map(cat => `<option value="${cat.slug}">${cat.name}</option>`).join('');
    if (currentValue) select.value = currentValue;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM Loaded - Initializing Miskeen Store...');
  initializeApp().catch(err => console.error('❌ Fatal initialization error:', err));
});

export { initializeApp, goPage, toggleMobile };
export { STORE, products, reviews, showToast } from './config.js';


