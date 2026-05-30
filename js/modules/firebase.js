/* ════════════════════════════════════════════════════════════════
   FIREBASE MODULE — Database, Auth, Realtime Operations
════════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref as rtRef, set as rtSet, update as rtUpdate, onValue, serverTimestamp as rtTimestamp, increment, onDisconnect, push as rtPush } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from '../firebase-config.js';

/* ════════════════════════════════════════════════════════════════
   FIREBASE CONFIGURATION
   NOTE: Credentials are now loaded from firebase-config.js
   (which is excluded from Git for security)
════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   FIREBASE INITIALIZATION
════════════════════════════════════════════════════════════════ */

let app, db, auth, rtdb;
let currentUser = null;
let products = [];
let reviews = [];
let stockData = {};
let rtdbStats = {};
let visitorRef = null;
let authInitialized = false;
let authReadyResolve = null;
const authReady = new Promise((resolve) => { authReadyResolve = resolve; });

let prodsRef, revRef, settingsRef, categoriesRef;

async function initializeFirebase() {
  try {
    app  = initializeApp(firebaseConfig);
    db   = getFirestore(app);
    auth = getAuth(app);
    rtdb = getDatabase(app);

    prodsRef    = collection(db, 'products');
    revRef      = collection(db, 'reviews');
    settingsRef = doc(db, 'settings', 'main');
    categoriesRef = collection(db, 'categories');

    await setPersistence(auth, browserLocalPersistence);

    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAuthUI();
      if (!authInitialized) { authInitialized = true; authReadyResolve(); }
    });

    await authReady;
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

/* ════════════════════════════════════════════════════════════════
   AUTHENTICATION FUNCTIONS
════════════════════════════════════════════════════════════════ */

async function signInUser(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: getAuthErrorMessage(error.code) };
  }
}

async function signOutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
}

async function signUpUser(email,password){ try { const result=await createUserWithEmailAndPassword(auth,email,password); return {success:true,user:result.user}; } catch(error){ return {success:false,error:getAuthErrorMessage(error.code)}; } }

async function getCurrentUserClaims(){ if(!auth.currentUser) return {}; const token=await auth.currentUser.getIdTokenResult(true); return token.claims || {}; }

function onAuthChanged(callback){ return onAuthStateChanged(auth,callback); }

function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email':           'Invalid email address.',
    'auth/user-disabled':           'This account has been disabled.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/weak-password':           'Password is too weak.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/too-many-requests':       'Too many failed attempts. Try again later.',
    'auth/operation-not-allowed':   'This sign-in method is not enabled.',
    'auth/invalid-credential':      'Invalid email or password.',
  };
  return messages[code] || 'Authentication failed. Please try again.';
}

function updateAuthUI() {
  const adminElements = document.querySelectorAll('.admin-only');
  const userElements  = document.querySelectorAll('.user-only');
  adminElements.forEach(el => el.style.display = currentUser ? 'block' : 'none');
  userElements.forEach(el  => el.style.display = currentUser ? 'block' : 'none');
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS MANAGEMENT
════════════════════════════════════════════════════════════════ */

async function getSettings() {
  try {
    const docSnap = await getDoc(settingsRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error('Error getting settings:', error);
    return {};
  }
}

async function saveSettings(settings) {
  try {
    await setDoc(settingsRef, { ...settings, updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || 'system' }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
}

/* ════════════════════════════════════════════════════════════════
   PRODUCT OPERATIONS
════════════════════════════════════════════════════════════════ */

async function getProducts() {
  try {
    const q = query(prodsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const result = [];
    snap.forEach(d => result.push({ id: d.id, ...d.data() }));
    return result;
  } catch (error) {
    if (error.message.includes('Missing or insufficient permissions')) {
      console.warn('Cannot fetch products - insufficient permissions. Returning empty array.');
      return [];
    }
    console.error('Error getting products:', error);
    throw error;
  }
}

async function addProduct(productData) {
  try {
    const docRef = await addDoc(prodsRef, { ...productData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: currentUser?.uid || 'system' });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: error.message };
  }
}

async function updateProduct(productId, productData) {
  try {
    await setDoc(doc(db, 'products', productId), { ...productData, updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || 'system' }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
}

async function deleteProduct(productId) {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
}

function listenProducts(callback) {
  const q = query(prodsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    products = [];
    snap.forEach(d => products.push({ id: d.id, ...d.data() }));
    console.log('Total products loaded:', products.length);
    if (callback) callback(products);
  }, (error) => { 
    console.warn('Products listener unavailable - using fallback data:', error.message);
    // Provide fallback empty products array when permissions are denied
    if (callback) callback([]);
  });
}

/* ════════════════════════════════════════════════════════════════
   REVIEW OPERATIONS
════════════════════════════════════════════════════════════════ */

async function getReviews() {
  try {
    const q = query(revRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const result = [];
    snap.forEach(d => result.push({ id: d.id, ...d.data() }));
    return result;
  } catch (error) {
    if (error.message.includes('Missing or insufficient permissions')) {
      console.warn('Cannot fetch reviews - insufficient permissions. Returning empty array.');
      return [];
    }
    console.error('Error getting reviews:', error);
    throw error;
  }
}

async function addReview(reviewData) {
  try {
    const docRef = await addDoc(revRef, { ...reviewData, createdAt: serverTimestamp(), approved: false });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding review:', error);
    return { success: false, error: error.message };
  }
}

async function updateReview(reviewId, reviewData) {
  try {
    await setDoc(doc(db, 'reviews', reviewId), { ...reviewData, updatedAt: serverTimestamp() }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating review:', error);
    return { success: false, error: error.message };
  }
}

async function deleteReview(reviewId) {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting review:', error);
    return { success: false, error: error.message };
  }
}

function listenReviews(callback) {
  const q = query(revRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    reviews = [];
    snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));
    if (callback) callback(reviews);
  }, (error) => { 
    console.warn('Reviews listener unavailable - using fallback data:', error.message);
    // Provide fallback empty reviews array when permissions are denied
    if (callback) callback([]);
  });
}

/* ════════════════════════════════════════════════════════════════
   CATEGORY OPERATIONS
════════════════════════════════════════════════════════════════ */

async function getCategories() {
  try {
    const q = query(categoriesRef, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    const result = [];
    snap.forEach(d => result.push({ id: d.id, ...d.data() }));
    return result;
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
}

async function addCategory(categoryData) {
  try {
    const docRef = await addDoc(categoriesRef, { ...categoryData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: currentUser?.uid || 'system' });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }
}

async function updateCategory(categoryId, categoryData) {
  try {
    await setDoc(doc(db, 'categories', categoryId), { ...categoryData, updatedAt: serverTimestamp(), updatedBy: currentUser?.uid || 'system' }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating category:', error);
    return { success: false, error: error.message };
  }
}

async function deleteCategory(categoryId) {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: error.message };
  }
}

function listenCategories(callback) {
  const q = query(categoriesRef, orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    const categories = [];
    snap.forEach(d => categories.push({ id: d.id, ...d.data() }));
    if (callback) callback(categories);
  }, (error) => {
    console.error('Error listening to categories:', error);
    if (callback) callback([]);
  });
}

/* ════════════════════════════════════════════════════════════════
   REALTIME DATABASE OPERATIONS
════════════════════════════════════════════════════════════════ */

function initPresence() {
  // FIX: removed `if (!currentUser) return` — all visitors should be tracked, not just admins
  try {
    visitorRef = rtRef(rtdb, `presence/visitors/${Date.now()}_${Math.random().toString(36).slice(2)}`);
    rtSet(visitorRef, { timestamp: rtTimestamp(), userAgent: navigator.userAgent, url: window.location.href });
    onDisconnect(visitorRef).remove();
  } catch (error) {
    console.warn('Could not initialize presence:', error);
  }
}

function listenVisitorCount(callback) {
  const visitorsRef = rtRef(rtdb, 'presence/visitors');
  onValue(visitorsRef, (snapshot) => {
    const visitors = snapshot.val() || {};
    const count = Object.keys(visitors).length;
    if (callback) callback(count);
  });
}

function listenStock(callback) {
  const stockRef = rtRef(rtdb, 'stock');
  onValue(stockRef, (snapshot) => {
    stockData = snapshot.val() || {};
    if (callback) callback(stockData);
  });
}

function listenRTDBStats(callback) {
  const statsRef = rtRef(rtdb, 'stats');
  onValue(statsRef, (snapshot) => {
    rtdbStats = snapshot.val() || {};
    if (callback) callback(rtdbStats);
  });
}

async function updateStock(productId, newStock) {
  try {
    const stockRef = rtRef(rtdb, `stock/${productId}`);
    await rtSet(stockRef, { quantity: newStock, updatedAt: rtTimestamp(), updatedBy: currentUser?.uid || 'system' });
    return { success: true };
  } catch (error) {
    console.error('Error updating stock:', error);
    return { success: false, error: error.message };
  }
}

async function logOrder(orderData) {
  try {
    // Log the order entry
    const ordersRef  = rtRef(rtdb, 'orderLog');
    const newOrderRef = rtPush(ordersRef);
    await rtSet(newOrderRef, { ...orderData, timestamp: rtTimestamp() });

    // FIX: use rtUpdate with increment() (server-side atomic increment for RTDB)
    const today = new Date().toISOString().split('T')[0];
    await rtUpdate(rtRef(rtdb, 'stats'), {
      [`ordersToday/${today}`]: increment(1),
      totalOrders:             increment(1),
    });

    return { success: true };
  } catch (error) {
    console.error('Error logging order:', error);
    return { success: false, error: error.message };
  }
}

async function incrementViewCount() {
  try {
    await rtUpdate(rtRef(rtdb, 'stats'), { totalViews: increment(1) });
    return { success: true };
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return { success: false, error: error.message };
  }
}

async function collectionHasDocuments(collectionRef) {
  try {
    const q = query(collectionRef, limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    // Handle permission errors gracefully
    if (error.message.includes('Missing or insufficient permissions')) {
      console.warn('Permission denied for collection check - assuming empty');
      return false;
    }
    console.error('Error checking collection documents:', error);
    return false;
  }
}

async function seedIfEmpty() {
  // FIX: removed `if (!currentUser) return` — seeding should work for fresh databases
  // regardless of auth state, since default products/reviews are public data
  try {
    const hasProducts = await collectionHasDocuments(prodsRef);
    const hasReviews  = await collectionHasDocuments(revRef);
    const hasCategories = await collectionHasDocuments(categoriesRef);
    if (!hasProducts) await seedDefaultProducts();
    if (!hasReviews)  await seedDefaultReviews();
    if (!hasCategories) await seedDefaultCategories();
  } catch (error) {
    console.error('Error during seedIfEmpty:', error);
  }
}

/* ════════════════════════════════════════════════════════════════
   SEEDING FUNCTIONS (for empty database)
════════════════════════════════════════════════════════════════ */

const DEFAULT_PRODUCTS = [
  { name:'Office For Men',    cat:'attar',   desc:'Sophisticated woody-citrus blend perfect for the modern professional. Long-lasting and alcohol-free.',  badge:'BESTSELLER', featured:true,  img:'', sizes:[{ml:'3ml',price:'PKR 650'},{ml:'6ml',price:'PKR 1,200'},{ml:'12ml',price:'PKR 2,200'},{ml:'20ml',price:'PKR 3,500'}] },
  { name:'Rose Taif Premium', cat:'rose',    desc:'Heavenly Rosa damascena from the mountains of Taif — soft, powdery, and deeply feminine.',                badge:'',           featured:true,  img:'', sizes:[{ml:'3ml',price:'PKR 800'},{ml:'6ml',price:'PKR 1,500'},{ml:'10ml',price:'PKR 2,800'}] },
  { name:'Oud Maliki',        cat:'oud',     desc:'Seven-year aged Agarwood from Assam. Rich, dark, and resinous — the hallmark of royalty.',               badge:'PREMIUM',    featured:true,  img:'', sizes:[{ml:'3ml',price:'PKR 1,800'},{ml:'6ml',price:'PKR 3,500'},{ml:'12ml',price:'PKR 7,000'}] },
  { name:'Shamama Special',   cat:'attar',   desc:'A classic blend of 40+ botanicals distilled over charcoal. Earthy, warm, meditative.',                  badge:'',           featured:false, img:'', sizes:[{ml:'3ml',price:'PKR 500'},{ml:'6ml',price:'PKR 950'},{ml:'12ml',price:'PKR 1,800'}] },
  { name:'Musk Al-Tahir',     cat:'musk',    desc:'Clean white musk with creamy sandalwood base. Fresh, gentle, and beautifully long-lasting.',            badge:'NEW',        featured:false, img:'', sizes:[{ml:'3ml',price:'PKR 400'},{ml:'6ml',price:'PKR 750'},{ml:'12ml',price:'PKR 1,400'}] },
  { name:'Jannat ul Firdaus', cat:'perfume', desc:'A beloved fruity-floral everyday fragrance. Sweet, bright, and universally adored.',                    badge:'',           featured:true,  img:'', sizes:[{ml:'50ml',price:'PKR 500'},{ml:'100ml',price:'PKR 850'},{ml:'200ml',price:'PKR 1,500'}] },
  { name:'Hina Khas',         cat:'attar',   desc:'Traditional Henna attar blended with rose and musk. Timeless, sacred, unforgettable.',                  badge:'',           featured:false, img:'', sizes:[{ml:'3ml',price:'PKR 600'},{ml:'6ml',price:'PKR 1,100'},{ml:'10ml',price:'PKR 2,200'}] },
];

const DEFAULT_REVIEWS = [
  { name:'Usman Ali',   city:'Lahore',    product:'Office For Men',    rating:5, text:'Ordered Office For Men on WhatsApp — delivered in 2 days. The fragrance is incredible and very long lasting. 100% recommend!' },
  { name:'Fatima Noor', city:'Karachi',   product:'Rose Taif Premium', rating:5, text:'Super easy to order online. Just messaged on WhatsApp, selected my size, paid and received it. Rose Taif is absolutely divine!' },
  { name:'Ahmed Raza',  city:'Islamabad', product:'Oud Maliki',        rating:5, text:'Bought Oud Maliki as a gift. Packaging was beautiful and delivery was fast. Best online attar store in Pakistan!' },
];

const DEFAULT_CATEGORIES = [
  { name:'Attar', slug:'attar' },
  { name:'Perfume', slug:'perfume' },
  { name:'Oud', slug:'oud' },
  { name:'Rose & Floral', slug:'rose' },
  { name:'Musk', slug:'musk' },
  { name:'Woody', slug:'woody' },
  { name:'Bakhoor', slug:'bakhoor' },
];

async function seedDefaultProducts() {
  try {
    for (const product of DEFAULT_PRODUCTS) {
      await addDoc(prodsRef, { ...product, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    console.log('✅ Default products seeded');
  } catch (error) { console.error('❌ Error seeding products:', error); }
}

async function seedDefaultReviews() {
  try {
    for (const review of DEFAULT_REVIEWS) {
      await addDoc(revRef, { ...review, createdAt: serverTimestamp(), approved: true });
    }
    console.log('✅ Default reviews seeded');
  } catch (error) {
    if (error.message.includes('Missing or insufficient permissions')) {
      console.warn('⚠️ Cannot seed reviews - insufficient permissions. Reviews will be empty.');
    } else {
      console.error('❌ Error seeding reviews:', error);
    }
  }
}

async function seedDefaultCategories() {
  try {
    for (const category of DEFAULT_CATEGORIES) {
      await addDoc(categoriesRef, { ...category, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    console.log('✅ Default categories seeded');
  } catch (error) { console.error('❌ Error seeding categories:', error); }
}

/* ════════════════════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════════════════════ */

export { signUpUser, getCurrentUserClaims, onAuthChanged,
  initializeFirebase,
  signInUser, signOutUser, getAuthErrorMessage,
  getSettings, saveSettings,
  getProducts, addProduct, updateProduct, deleteProduct, listenProducts,
  getReviews, addReview, updateReview, deleteReview, listenReviews,
  getCategories, addCategory, updateCategory, deleteCategory, listenCategories,
  initPresence, listenVisitorCount, listenStock, listenRTDBStats,
  updateStock, logOrder, incrementViewCount,
  seedIfEmpty, seedDefaultProducts, seedDefaultReviews, seedDefaultCategories,
  // NOTE: currentUser/products/reviews are module-internal; access via callbacks or window.firebase* globals
};
