import { hasDuplicateProduct } from './js/modules/product-guard.js';

const products = [
  { id: 'p1', name: 'Rose Attar', cat: 'attar' },
  { id: 'p2', name: 'Khus Attar', cat: 'attar' }
];

if (!hasDuplicateProduct(products, { name: '  rose   attar  ', cat: 'ATTA R ' })) {
  console.error('duplicate product not detected');
  process.exit(1);
}

if (hasDuplicateProduct(products, { name: 'Sandalwood', cat: 'perfume' })) {
  console.error('different product incorrectly marked as duplicate');
  process.exit(1);
}

if (hasDuplicateProduct(products, { name: 'Rose Attar', cat: 'attar' }, 'p1')) {
  console.error('editing same product incorrectly blocked');
  process.exit(1);
}

console.log('product duplication checks passed');
