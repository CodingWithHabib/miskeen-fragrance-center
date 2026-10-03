function normalizeProductKey(product = {}) {
  const normalizeToken = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const name = normalizeToken(product?.name);
  const category = normalizeToken(product?.cat);

  return `${name}|${category}`;
}

function hasDuplicateProduct(existingProducts = [], candidate = {}, ignoreId = null) {
  if (!candidate || !candidate.name) {
    return false;
  }

  const candidateKey = normalizeProductKey(candidate);

  return existingProducts.some((product) => {
    if (ignoreId && product.id === ignoreId) {
      return false;
    }

    return normalizeProductKey(product) === candidateKey;
  });
}

export { normalizeProductKey, hasDuplicateProduct };
