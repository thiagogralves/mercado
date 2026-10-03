export type MatchableProduct = {
  id: number;
  name: string;
  unit?: string;
};

export function normalizeProductText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function scoreProductMatch(query: string, name: string) {
  const q = normalizeProductText(query);
  const n = normalizeProductText(name);
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 75;
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const hits = tokens.filter((t) => n.includes(t)).length;
  if (hits === 0) return 0;
  return 40 + hits * 15;
}

export function rankProducts(products: MatchableProduct[], query: string, limit = 40) {
  const q = normalizeProductText(query);
  if (!q) return [];
  return products
    .map((p) => ({ product: p, score: scoreProductMatch(query, p.name) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.product.name.localeCompare(b.product.name, "pt-BR"),
    )
    .slice(0, limit)
    .map((r) => r.product);
}

/** Resolve texto digitado para um produto do catálogo. */
export function resolveProductFromQuery(
  products: MatchableProduct[],
  query: string,
  currentId?: string,
) {
  if (currentId) {
    const selected = products.find((p) => String(p.id) === currentId);
    if (selected) return selected;
  }
  const q = normalizeProductText(query);
  if (!q) return null;
  const exact = products.find((p) => normalizeProductText(p.name) === q);
  if (exact) return exact;
  const ranked = rankProducts(products, query, 5);
  if (ranked.length === 1) return ranked[0];
  if (ranked.length > 0 && scoreProductMatch(query, ranked[0].name) >= 90) {
    return ranked[0];
  }
  return null;
}
