function normalizeProductKey(product = {}) {
  const normalizeToken = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return `${normalizeToken(product?.name)}|${normalizeToken(product?.cat)}`;
}

function hasDuplicateProduct(existingProducts = [], candidate = {}, ignoreId = null) {
  if (!candidate?.name) return false;

  const candidateKey = normalizeProductKey(candidate);
  return existingProducts.some((product) =>
    product.id !== ignoreId && normalizeProductKey(product) === candidateKey
  );
}

export { normalizeProductKey, hasDuplicateProduct };