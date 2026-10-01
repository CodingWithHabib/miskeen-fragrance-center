const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { productKey: makeProductKey, categorySlug: makeCategorySlug, categoryIdentityKeys } = require('./uniqueness');

initializeApp();
const db = getFirestore();
const REGION = 'asia-southeast1';

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new HttpsError('invalid-argument', `${field} is required.`);
  return text;
}

function requireAdmin(request) {
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
}

function productIndex(key) {
  return db.collection('_uniqueProducts').doc(key);
}

function categoryIndex(key) {
  return db.collection('_uniqueCategories').doc(key);
}

const createProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const data = request.data?.product;
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Product data is required.');
  const key = makeProductKey(data);
  const ref = db.collection('products').doc();
  const indexRef = productIndex(key);

  await db.runTransaction(async (transaction) => {
    const index = await transaction.get(indexRef);
    if (index.exists) throw new HttpsError('already-exists', 'A product with the same name and category already exists.');
    transaction.create(ref, { ...data, uniquenessKey: key, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid });
    transaction.create(indexRef, { productIds: [ref.id], createdAt: FieldValue.serverTimestamp() });
  });
  return { success: true, id: ref.id };
});

const updateProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const productId = String(request.data?.productId || '');
  const data = request.data?.product;
  if (!productId || !data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Product ID and data are required.');
  const ref = db.collection('products').doc(productId);
  const newKey = makeProductKey(data);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Product not found.');
    const oldProduct = snapshot.data();
    const oldKey = oldProduct.uniquenessKey || makeProductKey(oldProduct);
    const oldIndexRef = productIndex(oldKey);
    const newIndexRef = productIndex(newKey);
    const oldIndex = await transaction.get(oldIndexRef);
    const newIndex = oldKey === newKey ? oldIndex : await transaction.get(newIndexRef);
    const newIds = newIndex.exists ? (newIndex.data().productIds || [newIndex.data().productId].filter(Boolean)) : [];
    if (oldKey !== newKey && newIds.some((id) => id !== productId)) {
      throw new HttpsError('already-exists', 'Another product with the same name and category already exists.');
    }
    if (oldKey !== newKey) {
      const oldIds = oldIndex.exists ? (oldIndex.data().productIds || [oldIndex.data().productId].filter(Boolean)) : [];
      const remainingOldIds = oldIds.filter((id) => id !== productId);
      if (remainingOldIds.length) transaction.set(oldIndexRef, { productIds: remainingOldIds });
      else transaction.delete(oldIndexRef);
      transaction.set(newIndexRef, { productIds: [...newIds, productId], createdAt: FieldValue.serverTimestamp() });
    } else if (!oldIndex.exists) {
      transaction.set(oldIndexRef, { productIds: [productId], createdAt: FieldValue.serverTimestamp() });
    }
    transaction.set(ref, { ...data, uniquenessKey: newKey, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
  });
  return { success: true };
});

const deleteProduct = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const productId = String(request.data?.productId || '');
  if (!productId) throw new HttpsError('invalid-argument', 'Product ID is required.');
  const ref = db.collection('products').doc(productId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const data = snapshot.data();
    const indexRef = productIndex(data.uniquenessKey || makeProductKey(data));
    const index = await transaction.get(indexRef);
    if (index.exists) {
      const ids = (index.data().productIds || [index.data().productId].filter(Boolean)).filter((id) => id !== productId);
      if (ids.length) transaction.set(indexRef, { productIds: ids });
      else transaction.delete(indexRef);
    }
    transaction.delete(ref);
  });
  return { success: true };
});

const createCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const data = request.data?.category;
  if (!data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Category data is required.');
  const name = requiredText(data.name, 'Category name');
  const slug = makeCategorySlug({ ...data, name });
  const identityKeys = categoryIdentityKeys({ ...data, name, slug });
  const ref = db.collection('categories').doc();
  const indexRefs = identityKeys.map(categoryIndex);

  await db.runTransaction(async (transaction) => {
    const indexes = await Promise.all(indexRefs.map((indexRef) => transaction.get(indexRef)));
    if (indexes.some((index) => index.exists)) throw new HttpsError('already-exists', 'A category with this name or slug already exists.');
    transaction.create(ref, { ...data, name, slug, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid });
    indexRefs.forEach((indexRef) => transaction.create(indexRef, { categoryIds: [ref.id], createdAt: FieldValue.serverTimestamp() }));
  });
  return { success: true, id: ref.id };
});

const updateCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const categoryId = String(request.data?.categoryId || '');
  const data = request.data?.category;
  if (!categoryId || !data || typeof data !== 'object') throw new HttpsError('invalid-argument', 'Category ID and data are required.');
  const ref = db.collection('categories').doc(categoryId);
  const name = requiredText(data.name, 'Category name');
  const newSlug = makeCategorySlug({ ...data, name });
  const newIdentityKeys = categoryIdentityKeys({ ...data, name, slug: newSlug });

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Category not found.');
    const oldIdentityKeys = categoryIdentityKeys(snapshot.data());
    const allKeys = [...new Set([...oldIdentityKeys, ...newIdentityKeys])];
    const refs = new Map(allKeys.map((key) => [key, categoryIndex(key)]));
    const indexes = new Map(await Promise.all(allKeys.map(async (key) => [key, await transaction.get(refs.get(key))])));
    const addedKeys = newIdentityKeys.filter((key) => !oldIdentityKeys.includes(key));
    if (newIdentityKeys.some((key) => !oldIdentityKeys.includes(key) && (() => {
      const index = indexes.get(key);
      const ids = index.exists ? (index.data().categoryIds || [index.data().categoryId].filter(Boolean)) : [];
      return ids.some((id) => id !== categoryId);
    })())) {
      throw new HttpsError('already-exists', 'A category with this name or slug already exists.');
    }
    oldIdentityKeys.filter((key) => !newIdentityKeys.includes(key)).forEach((key) => {
      const index = indexes.get(key);
      const ids = (index.data()?.categoryIds || [index.data()?.categoryId].filter(Boolean)).filter((id) => id !== categoryId);
      if (ids.length) transaction.set(refs.get(key), { categoryIds: ids });
      else transaction.delete(refs.get(key));
    });
    newIdentityKeys.forEach((key) => {
      const index = indexes.get(key);
      const ids = index.exists ? (index.data().categoryIds || [index.data().categoryId].filter(Boolean)) : [];
      transaction.set(refs.get(key), { categoryIds: [...new Set([...ids, categoryId])], createdAt: FieldValue.serverTimestamp() });
    });
    transaction.set(ref, { ...data, name, slug: newSlug, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
  });
  return { success: true };
});

const deleteCategory = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);
  const categoryId = String(request.data?.categoryId || '');
  if (!categoryId) throw new HttpsError('invalid-argument', 'Category ID is required.');
  const ref = db.collection('categories').doc(categoryId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const indexRefs = categoryIdentityKeys(snapshot.data()).map(categoryIndex);
    const indexes = await Promise.all(indexRefs.map((indexRef) => transaction.get(indexRef)));
    indexes.forEach((index, indexPosition) => {
      if (!index.exists) return;
      const ids = (index.data().categoryIds || [index.data().categoryId].filter(Boolean)).filter((id) => id !== categoryId);
      if (ids.length) transaction.set(indexRefs[indexPosition], { categoryIds: ids });
      else transaction.delete(indexRefs[indexPosition]);
    });
    transaction.delete(ref);
  });
  return { success: true };
});

exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
