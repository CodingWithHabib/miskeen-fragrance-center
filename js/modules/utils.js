/* ════════════════════════════════════════════════════════════════
   UTILITIES MODULE — Validation, Sanitization, Helpers
════════════════════════════════════════════════════════════════ */

const VALID = {
  required: (val, field = 'Field') => (!val || typeof val !== 'string' || val.trim().length === 0) ? `${field} is required.` : null,
  minLength: (val, min, field = 'Field') => (typeof val !== 'string' || val.trim().length < min) ? `${field} must be at least ${min} characters.` : null,
  maxLength: (val, max, field = 'Field') => (typeof val !== 'string' || val.trim().length > max) ? `${field} must be no more than ${max} characters.` : null,
  email: (val) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (!val || !re.test(val.trim())) ? 'Please enter a valid email address.' : null;
  },
  // FIX: accept 10–13 digits to support 03001234567 (11), 923001234567 (12) and +923001234567 (with country code)
  phone: (val) => {
    const phoneRegex = /^(\+92|92|0)?[3][0-9]{9}$/;
    const cleanVal   = val.replace(/\D/g, '');
    if (!cleanVal || cleanVal.length < 10 || cleanVal.length > 13) return 'Please enter a valid Pakistani phone number.';
    if (!phoneRegex.test(val.trim())) return 'Phone number format is invalid.';
    return null;
  },
  // FIX: accept 10–12 digits (same reason as above)
  whatsapp: (val) => {
    const waRegex  = /^(\+92|92|0)?[3][0-9]{9}$/;
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal || cleanVal.length < 10 || cleanVal.length > 12) return 'WhatsApp number must be a valid Pakistani number (e.g. 03001234567 or +923001234567).';
    if (!waRegex.test(val.trim())) return 'WhatsApp number must start with 3 (e.g., 03001234567).';
    return null;
  },
  productName: (val) => {
    return VALID.required(val, 'Product name') || VALID.minLength(val, 2, 'Product name') || VALID.maxLength(val, 100, 'Product name');
  },
  productDesc: (val) => {
    return VALID.required(val, 'Description') || VALID.minLength(val, 10, 'Description') || VALID.maxLength(val, 500, 'Description');
  },
  // FIX: added 'woody' and 'bakhoor' to match UI filter buttons
  category: (val) => {
    const validCats = ['attar', 'perfume', 'oud', 'musk', 'rose', 'woody', 'bakhoor'];
    return (!val || !validCats.includes(val.toLowerCase())) ? 'Please select a valid category.' : null;
  },
  size: (val) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) return 'Size is required (e.g., 3ml, 50ml).';
    const re = /^\d+(\.\d+)?\s*(ml|ML|g|G|kg|KG|l|L|oz|OZ)$/;
    if (!re.test(val.trim())) return 'Size format invalid. Use format like "3ml", "50ml", "100g".';
    return null;
  },
  price: (val) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) return 'Price is required.';
    const re = /^(PKR\s*)?[\d,]+(\.\d{2})?$/i;
    if (!re.test(val.trim())) return 'Price format invalid. Use format like "PKR 650" or "1200".';
    return null;
  },
  imageFile: (file) => {
    if (!file) return 'Please select an image file.';
    if (!file.type.startsWith('image/')) return 'Please select a valid image file (JPG, PNG, WebP).';
    if (file.size > 10 * 1024 * 1024) return 'Image file is too large. Maximum size is 10MB.';
    if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type.toLowerCase())) return 'Unsupported image format. Please use JPG, PNG, or WebP.';
    return null;
  },
  reviewName: (val) => VALID.required(val, 'Your name') || VALID.minLength(val, 2, 'Name') || VALID.maxLength(val, 50, 'Name'),
  reviewText: (val) => VALID.required(val, 'Review text') || VALID.minLength(val, 10, 'Review') || VALID.maxLength(val, 500, 'Review'),
  rating: (val) => { const r = parseInt(val); return (isNaN(r) || r < 1 || r > 5) ? 'Please select a rating between 1 and 5 stars.' : null; },
  contactName:    (val) => VALID.reviewName(val),
  contactMessage: (val) => VALID.required(val, 'Message') || VALID.minLength(val, 10, 'Message') || VALID.maxLength(val, 1000, 'Message'),
  // Customer authentication validation
  customerName: (val) => VALID.required(val, 'Name') || VALID.minLength(val, 2, 'Name') || VALID.maxLength(val, 50, 'Name'),
  customerEmail: (val) => VALID.required(val, 'Email') || VALID.email(val),
  customerPassword: (val) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) return 'Password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters.';
    if (val.length > 128) return 'Password must be no more than 128 characters.';
    return null;
  },
  passwordMatch: (password, confirmPassword) => {
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  },
};

const SANITIZE = {
  html: (str) => {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  text: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').trim();
  },
  url: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>'"]/g, '').replace(/\s+/g, '').substring(0, 2000);
  },
  phone: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/\D/g, '').substring(0, 13);
  },
  price: (val) => {
    if (typeof val !== 'string') return 'PKR 0';
    const numeric = val.replace(/[^\d.]/g, '');
    const price   = parseFloat(numeric);
    return isNaN(price) ? 'PKR 0' : `PKR ${Math.round(price).toLocaleString()}`;
  },
  size: (val) => typeof val === 'string' ? val.trim().toLowerCase() : '',
};

function esc(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function generateStars(rating) {
  const n = Math.max(0, Math.min(5, parseInt(rating) || 5));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now      = new Date();
  const time     = new Date(timestamp);
  const diffMs   = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs  < 24) return `${diffHrs}h ago`;
  if (diffDays < 7)  return `${diffDays}d ago`;
  return time.toLocaleDateString('en-PK', { month:'short', day:'numeric', year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function() {
    if (!inThrottle) {
      func.apply(this, arguments);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function isOnline()   { return navigator.onLine; }

function formatCurrency(amount, currency = 'PKR') {
  return `${currency} ${(parseFloat(amount) || 0).toLocaleString()}`;
}

function parseCurrency(str) {
  if (typeof str !== 'string') return 0;
  return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

const storage = {
  get: (key, defaultValue = null) => {
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : defaultValue; }
    catch { return defaultValue; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove: (key) => {
    try { localStorage.removeItem(key); return true; }
    catch { return false; }
  },
};

const cookies = {
  set: (name, value, days = 30) => {
    try {
      const expires = new Date(Date.now() + days * 86400000);
      document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
      return true;
    } catch { return false; }
  },
  get: (name) => {
    try {
      const nameEQ = name + '=';
      for (let c of document.cookie.split(';')) {
        c = c.trim();
        if (c.startsWith(nameEQ)) return decodeURIComponent(c.substring(nameEQ.length));
      }
      return null;
    } catch { return null; }
  },
  remove: (name) => {
    try { document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Strict`; return true; }
    catch { return false; }
  },
};

function initNetworkMonitor() {
  window.addEventListener('online',  () => console.log('🔗 Network connection restored'));
  window.addEventListener('offline', () => console.log('📶 Network connection lost'));
}

function initializeUtils() {
  initNetworkMonitor();
  console.log('✅ Utils module initialized');
}

export { VALID, SANITIZE, esc, generateStars, formatRelativeTime, debounce, throttle, generateId, isOnline, formatCurrency, parseCurrency, storage, cookies, initializeUtils };
