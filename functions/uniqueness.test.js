const assert = require('node:assert/strict');
const { productKey, categorySlug, categoryIdentityKeys } = require('./uniqueness');

assert.equal(productKey({ name: 'Rose Attar', cat: 'attar' }), productKey({ name: ' rose-attar ', cat: 'ATTAR' }));
assert.notEqual(productKey({ name: 'Rose Attar', cat: 'attar' }), productKey({ name: 'Rose Attar', cat: 'rose' }));
assert.equal(categorySlug({ name: 'Rose & Floral', slug: 'rose' }), 'rose');
assert.equal(categorySlug({ name: 'Rose & Floral' }), 'rose-and-floral');
assert.deepEqual(categoryIdentityKeys({ name: 'Rose & Floral', slug: 'rose' }), ['name__rosefloral', 'slug__rose']);
assert.deepEqual(categoryIdentityKeys({ name: ' rose   & floral ', slug: 'rose' }), categoryIdentityKeys({ name: 'Rose & Floral', slug: 'rose' }));
assert.throws(() => productKey({ name: '', cat: 'attar' }), /letters or numbers/);
assert.throws(() => categorySlug({ name: '' }), /required/);

console.log('uniqueness key regression checks passed');
