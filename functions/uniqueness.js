function normalizedToken(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function productKey(product) {
  const name = normalizedToken(product.name);
  const category = normalizedToken(product.cat);
  if (!name || !category) throw new Error('Product name and category must contain letters or numbers.');
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
  if (!slug) throw new Error('Category name or slug is required.');
  return slug;
}

function categoryIdentityKeys(category) {
  const name = normalizedToken(category.name);
  const slug = categorySlug(category);
  if (!name) throw new Error('Category name must contain letters or numbers.');
  return [`name__${name}`, `slug__${slug}`];
}

module.exports = { normalizedToken, productKey, categorySlug, categoryIdentityKeys };
