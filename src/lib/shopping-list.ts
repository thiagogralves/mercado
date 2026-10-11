export type ShoppingListItem = {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  checked: boolean;
};

const STORAGE_KEY = "mercado-shopping-list-v1";

export function loadShoppingList(): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShoppingListItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.productId === "number" &&
        typeof item.productName === "string" &&
        typeof item.quantity === "number" &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function saveShoppingList(items: ShoppingListItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
