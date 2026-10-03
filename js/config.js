/* ════════════════════════════════════════════════════════════════
   CONFIGURATION & SHARED STATE
════════════════════════════════════════════════════════════════ */

// Global application configuration
// IMPORTANT: cloudName and uploadPreset must be different values.
// cloudName  = your Cloudinary cloud name (e.g. 'dc5ajtraa')
// uploadPreset = an UNSIGNED upload preset you created in Cloudinary dashboard
//                (e.g. 'miskeen_unsigned') — NOT the same as your cloud name.
// Update these in Admin Panel → Settings after setting up your Cloudinary account.
export const STORE = {
  name:         'Miskeen Fragrance Center',
  tag:          'WHERE SCENT BECOMES SOUL',
  wa:           '+923001234567',
  ph:           '+92 300 1234567',
  em:           'info@miskeenfragrance.com',
  hr:           'Mon–Sat 9am–9pm · Sun 11am–6pm',
  ig: '',
  fb: '',
  ftdesc:       "Pakistan's online attar & perfume store. Pure, natural, alcohol-free fragrances delivered to your doorstep.",
  copy:         '© 2026 Miskeen Fragrance Center. All Rights Reserved. | 100% Online Store',
  cloudName:    'dc5ajtraa',
  uploadPreset: 'miskeen_unsigned', // FIX: was incorrectly set to 'dc5ajtraa' (same as cloudName) — set to your actual unsigned preset name
};

// Global application state (use state.setX() to mutate)
export let products = [];
export let reviews = [];
export let currentUser = null;
export let adminPanelOpen = false;
export let stockData = {};
export let rtdbStats = {};

// Toast utility function
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2700);
}

// Reactive state accessor (avoids stale primitive export problem)
export const state = {
  get STORE()        { return STORE; },
  get products()     { return products; },
  get reviews()      { return reviews; },
  get currentUser()  { return currentUser; },
  get adminPanelOpen(){ return adminPanelOpen; },
  get stockData()    { return stockData; },
  get rtdbStats()    { return rtdbStats; },

  setProducts(v)      { products = v; },
  setReviews(v)       { reviews  = v; },
  setCurrentUser(v)   { currentUser = v; },
  setAdminPanelOpen(v){ adminPanelOpen = v; },
  setStockData(v)     { stockData = v; },
  setRtdbStats(v)     { rtdbStats = v; },
};
