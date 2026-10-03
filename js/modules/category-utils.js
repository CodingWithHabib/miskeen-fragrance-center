export function normalizeCategorySlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function buildCategoryRecord(category = {}) {
  const rawName = String(category.name ?? '').trim();
  const rawSlug = String(category.slug ?? '').trim();
  const name = rawName || rawSlug || 'Unnamed category';
  const slug = normalizeCategorySlug(rawSlug || name);

  return {
    name: name.replace(/\s+/g, ' ').trim(),
    slug,
  };
}

export function dedupeCategories(categories = []) {
  const seen = new Map();

  categories.forEach((category) => {
    const normalized = buildCategoryRecord(category);
    const key = normalized.slug || normalizeCategorySlug(normalized.name);

    if (!seen.has(key)) {
      seen.set(key, { ...category, name: normalized.name, slug: normalized.slug });
    }
  });

  return Array.from(seen.values());
}
