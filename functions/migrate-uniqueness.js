const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { productKey, categorySlug, categoryIdentityKeys } = require('./uniqueness');

initializeApp();
const db = getFirestore();
const apply = process.argv.includes('--apply');

function groupDuplicates(documents, keyFor) {
  const groups = new Map();
  for (const document of documents) {
    const key = keyFor(document.data);
    const group = groups.get(key) || [];
    group.push(document);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

async function main() {
  const [productsSnapshot, categoriesSnapshot] = await Promise.all([
    db.collection('products').get(),
    db.collection('categories').get(),
  ]);
  const products = productsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const categories = categoriesSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const productDuplicates = groupDuplicates(products, productKey);
  const categoryGroups = new Map();
  for (const category of categories) {
    for (const key of categoryIdentityKeys(category.data)) {
      const group = categoryGroups.get(key) || [];
      group.push(category);
      categoryGroups.set(key, group);
    }
  }
  const categoryDuplicates = [...categoryGroups.entries()].filter(([, group]) => group.length > 1);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    productCount: products.length,
    categoryCount: categories.length,
    productDuplicateGroups: productDuplicates.map(([key, group]) => ({ key, records: group.map((entry) => ({ id: entry.id, name: entry.data.name, category: entry.data.cat })) })),
    categoryDuplicateGroups: categoryDuplicates.map(([key, group]) => ({ key, records: group.map((entry) => ({ id: entry.id, name: entry.data.name })) })),
  }, null, 2));

  if (!apply) {
    console.log('Dry run only. Review all duplicate groups before using --apply.');
    return;
  }
  const productsByKey = new Map();
  for (const entry of products) {
    const key = productKey(entry.data);
    const group = productsByKey.get(key) || [];
    group.push(entry);
    productsByKey.set(key, group);
  }
  for (const [key, group] of productsByKey) {
    const indexRef = db.collection('_uniqueProducts').doc(key);
    const batch = db.batch();
    for (const entry of group) {
      batch.set(db.collection('products').doc(entry.id), { uniquenessKey: key }, { merge: true });
    }
    batch.set(indexRef, { productIds: group.map((entry) => entry.id), createdAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }

  const categoriesByIdentity = new Map();
  for (const entry of categories) {
    for (const key of categoryIdentityKeys(entry.data)) {
      const group = categoriesByIdentity.get(key) || [];
      group.push(entry);
      categoriesByIdentity.set(key, group);
    }
  }
  for (const [key, group] of categoriesByIdentity) {
      const indexRef = db.collection('_uniqueCategories').doc(key);
      await indexRef.set({ categoryIds: [...new Set(group.map((entry) => entry.id))], createdAt: FieldValue.serverTimestamp() });
  }
  console.log('Uniqueness index migration completed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
