import { normalizeProductText } from "@/lib/product-match";

export type ShoppingListItem = {
  /** Stable key: `p:{productId}` for catalog, `c:{normalizedName}` for free text. */
  id: string;
  productId: number | null;
  productName: string;
  unit: string;
  quantity: number;
  checked: boolean;
};

const STORAGE_KEY = "mercado-shopping-list-v2";
const LEGACY_KEY = "mercado-shopping-list-v1";

export function catalogListItemId(productId: number) {
  return `p:${productId}`;
}

export function customListItemId(productName: string) {
  return `c:${normalizeProductText(productName)}`;
}

function normalizeItem(raw: unknown): ShoppingListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<ShoppingListItem> & { productId?: number | null };

  const productName =
    typeof item.productName === "string" ? item.productName.trim() : "";
  const quantity = typeof item.quantity === "number" ? item.quantity : 0;
  if (!productName || !(quantity > 0)) return null;

  const unit = typeof item.unit === "string" && item.unit ? item.unit : "un";
  const checked = Boolean(item.checked);
  const productId =
    typeof item.productId === "number" && Number.isFinite(item.productId)
      ? item.productId
      : null;

  const id =
    typeof item.id === "string" && item.id
      ? item.id
      : productId != null
        ? catalogListItemId(productId)
        : customListItemId(productName);

  return { id, productId, productName, unit, quantity, checked };
}

export function loadShoppingList(): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const items = parsed
      .map(normalizeItem)
      .filter((item): item is ShoppingListItem => item != null);

    if (localStorage.getItem(LEGACY_KEY) && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      localStorage.removeItem(LEGACY_KEY);
    }
    return items;
  } catch {
    return [];
  }
}

export function saveShoppingList(items: ShoppingListItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
