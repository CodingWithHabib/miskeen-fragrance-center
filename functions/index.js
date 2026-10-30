const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const REGION = 'asia-southeast1';
const NORMALIZE = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
}

function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new HttpsError('invalid-argument', `${field} is required.`);
  return normalized;
}

function productKey(product) {
  const name = NORMALIZE(requiredText(product.name, 'Product name'));
  const category = NORMALIZE(requiredText(product.cat, 'Product category'));
  if (!name || !category) throw new HttpsError('invalid-argument', 'Product name and category must contain letters or numbers.');
  return `${name}__${category}`;
}

function categorySlug(category) {
  const slug = String(category.slug || category.name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  if (!slug) throw new HttpsError('invalid-argument', 'Category name or slug is required.');
  return slug;
}

function productIndexRef(key) {
  return db.collection('_uniqueProducts').doc(key);
}

function categoryIndexRef(slug) {
  return db.collection('_uniqueCategories').doc(slug);
}

const createProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const data = request.data?.product;
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Product data is required.');
  const key = productKey(data);
  const ref = db.collection('products').doc();
  const indexRef = productIndexRef(key);

  await db.runTransaction(async (transaction) => {
    const index = await transaction.get(indexRef);
    if (index.exists) throw new HttpsError('already-exists', 'A product with the same name and category already exists.');
    transaction.create(ref, {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      uniquenessKey: key,
    });
    transaction.create(indexRef, { productId: ref.id, createdAt: FieldValue.serverTimestamp() });
  });

  return { success: true, id: ref.id };
});

const updateProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { productId, product: data } = request.data || {};
  if (!productId || !data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Product ID and data are required.');
  const productRef = db.collection('products').doc(String(productId));
  const newKey = productKey(data);

  await db.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) throw new HttpsError('not-found', 'Product not found.');
    const oldProduct = productSnapshot.data();
    const oldKey = oldProduct.uniquenessKey || productKey(oldProduct);
    const newIndexRef = productIndexRef(newKey);
    const oldIndexRef = productIndexRef(oldKey);
    const newIndex = newKey === oldKey ? null : await transaction.get(newIndexRef);
    if (newIndex?.exists && newIndex.data().productId !== productRef.id) {
      throw new HttpsError('already-exists', 'Another product with the same name and category already exists.');
    }
    if (newKey !== oldKey) {
      transaction.delete(oldIndexRef);
      transaction.set(newIndexRef, { productId: productRef.id, createdAt: FieldValue.serverTimestamp() });
    } else if (!(await transaction.get(oldIndexRef)).exists) {
      transaction.set(oldIndexRef, { productId: productRef.id, createdAt: FieldValue.serverTimestamp() });
    }
    transaction.set(productRef, { ...data, uniquenessKey: newKey, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
  });
  return { success: true };
});

const deleteProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const productId = String(request.data?.productId || '');
  if (!productId) throw new HttpsError('invalid-argument', 'Product ID is required.');
  const productRef = db.collection('products').doc(productId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists) return;
    const product = snapshot.data();
    const key = product.uniquenessKey || productKey(product);
    const indexRef = productIndexRef(key);
    const index = await transaction.get(indexRef);
    if (index.exists && index.data().productId === productId) transaction.delete(indexRef);
    transaction.delete(productRef);
  });
  return { success: true };
});

const createCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const data = request.data?.category;
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Category data is required.');
  const name = requiredText(data.name, 'Category name');
  const slug = categorySlug({ ...data, name });
  const categoryRef = db.collection('categories').doc();
  const indexRef = categoryIndexRef(slug);

  await db.runTransaction(async (transaction) => {
    const index = await transaction.get(indexRef);
    if (index.exists) throw new HttpsError('already-exists', 'A category with this slug already exists.');
    transaction.create(categoryRef, { ...data, name, slug, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid });
    transaction.create(indexRef, { categoryId: categoryRef.id, createdAt: FieldValue.serverTimestamp() });
  });
  return { success: true, id: categoryRef.id };
});

const updateCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const { categoryId, category: data } = request.data || {};
  if (!categoryId || !data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Category ID and data are required.');
  const categoryRef = db.collection('categories').doc(String(categoryId));
  const name = requiredText(data.name, 'Category name');
  const slug = categorySlug({ ...data, name });

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(categoryRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Category not found.');
    const oldCategory = snapshot.data();
    const oldSlug = categorySlug(oldCategory);
    const newIndexRef = categoryIndexRef(slug);
    const oldIndexRef = categoryIndexRef(oldSlug);
    const newIndex = slug === oldSlug ? null : await transaction.get(newIndexRef);
    if (newIndex?.exists && newIndex.data().categoryId !== categoryRef.id) {
      throw new HttpsError('already-exists', 'A category with this slug already exists.');
    }
    if (slug !== oldSlug) {
      transaction.delete(oldIndexRef);
      transaction.set(newIndexRef, { categoryId: categoryRef.id, createdAt: FieldValue.serverTimestamp() });
    } else if (!(await transaction.get(oldIndexRef)).exists) {
      transaction.set(oldIndexRef, { categoryId: categoryRef.id, createdAt: FieldValue.serverTimestamp() });
    }
    transaction.set(categoryRef, { ...data, name, slug, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
  });
  return { success: true };
});

const deleteCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const categoryId = String(request.data?.categoryId || '');
  if (!categoryId) throw new HttpsError('invalid-argument', 'Category ID is required.');
  const categoryRef = db.collection('categories').doc(categoryId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(categoryRef);
    if (!snapshot.exists) return;
    const slug = categorySlug(snapshot.data());
    const indexRef = categoryIndexRef(slug);
    const index = await transaction.get(indexRef);
    if (index.exists && index.data().categoryId === categoryId) transaction.delete(indexRef);
    transaction.delete(categoryRef);
  });
  return { success: true };
});

exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
