"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  catalogListItemId,
  customListItemId,
  loadShoppingList,
  saveShoppingList,
  type ShoppingListItem,
} from "@/lib/shopping-list";

type AddItemInput = {
  productId?: number | null;
  productName: string;
  unit?: string;
  quantity?: number;
};

type ShoppingListContextValue = {
  items: ShoppingListItem[];
  ready: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  addItem: (input: AddItemInput) => void;
  setChecked: (id: string, checked: boolean) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
  pendingCount: number;
};

const ShoppingListContext = createContext<ShoppingListContextValue | null>(
  null,
);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setItems(loadShoppingList());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveShoppingList(items);
  }, [items, ready]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const addItem = useCallback((input: AddItemInput) => {
    const productName = input.productName.trim();
    if (!productName) return;

    const qty = Math.max(0.001, Number(input.quantity) || 1);
    const productId =
      typeof input.productId === "number" && Number.isFinite(input.productId)
        ? input.productId
        : null;
    const unit = input.unit?.trim() || "un";
    const id =
      productId != null
        ? catalogListItemId(productId)
        : customListItemId(productName);

    setItems((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (existing) {
        return prev.map((p) =>
          p.id === id
            ? {
                ...p,
                quantity: Number((p.quantity + qty).toFixed(3)),
                checked: false,
                productName,
                unit,
                productId,
              }
            : p,
        );
      }
      return [
        ...prev,
        {
          id,
          productId,
          productName,
          unit,
          quantity: Number(qty.toFixed(3)),
          checked: false,
        },
      ].sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
    });
  }, []);

  const setChecked = useCallback((id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, checked } : p)),
    );
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const qty = Math.max(0.001, Number(quantity) || 1);
    setItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, quantity: Number(qty.toFixed(3)) } : p,
      ),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearChecked = useCallback(() => {
    setItems((prev) => prev.filter((p) => !p.checked));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const pendingCount = useMemo(
    () => items.filter((i) => !i.checked).length,
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      ready,
      sheetOpen,
      openSheet,
      closeSheet,
      addItem,
      setChecked,
      setQuantity,
      removeItem,
      clearChecked,
      clearAll,
      pendingCount,
    }),
    [
      items,
      ready,
      sheetOpen,
      openSheet,
      closeSheet,
      addItem,
      setChecked,
      setQuantity,
      removeItem,
      clearChecked,
      clearAll,
      pendingCount,
    ],
  );

  return (
    <ShoppingListContext.Provider value={value}>
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) {
    throw new Error("useShoppingList must be used within ShoppingListProvider");
  }
  return ctx;
}
