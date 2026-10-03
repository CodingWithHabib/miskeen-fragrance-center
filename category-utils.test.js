import assert from 'node:assert/strict';
import { buildCategoryRecord, dedupeCategories, normalizeCategorySlug } from './js/modules/category-utils.js';

console.log('Running category regression checks...');

const list = [
  { name: 'Attar', slug: 'Attar' },
  { name: ' Attar ', slug: 'attar' },
  { name: 'Rose & Floral', slug: 'rose' },
  { name: 'Rose & Floral', slug: 'rose' },
  { name: 'Musk', slug: 'musk' },
];

const deduped = dedupeCategories(list);
assert.equal(deduped.length, 3, 'duplicate categories should be removed');
assert.deepEqual(deduped[0], { name: 'Attar', slug: 'attar' });
assert.equal(normalizeCategorySlug('Rose & Floral'), 'rose-floral');
assert.deepEqual(buildCategoryRecord({ name: '  Musk  ', slug: '  MUSK  ' }), { name: 'Musk', slug: 'musk' });

console.log('category-utils regression checks passed');
