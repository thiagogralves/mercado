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
  loadShoppingList,
  saveShoppingList,
  type ShoppingListItem,
} from "@/lib/shopping-list";

type ShoppingListContextValue = {
  items: ShoppingListItem[];
  ready: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  addItem: (input: {
    productId: number;
    productName: string;
    unit: string;
    quantity: number;
  }) => void;
  setChecked: (productId: number, checked: boolean) => void;
  setQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
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

  const addItem = useCallback(
    (input: {
      productId: number;
      productName: string;
      unit: string;
      quantity: number;
    }) => {
      const qty = Math.max(0.001, Number(input.quantity) || 1);
      setItems((prev) => {
        const existing = prev.find((p) => p.productId === input.productId);
        if (existing) {
          return prev.map((p) =>
            p.productId === input.productId
              ? {
                  ...p,
                  quantity: Number((p.quantity + qty).toFixed(3)),
                  checked: false,
                  productName: input.productName,
                  unit: input.unit,
                }
              : p,
          );
        }
        return [
          ...prev,
          {
            productId: input.productId,
            productName: input.productName,
            unit: input.unit,
            quantity: Number(qty.toFixed(3)),
            checked: false,
          },
        ].sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
      });
    },
    [],
  );

  const setChecked = useCallback((productId: number, checked: boolean) => {
    setItems((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, checked } : p)),
    );
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    const qty = Math.max(0.001, Number(quantity) || 1);
    setItems((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, quantity: Number(qty.toFixed(3)) }
          : p,
      ),
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((p) => p.productId !== productId));
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
