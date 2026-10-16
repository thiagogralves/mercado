"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ShoppingListAddForm } from "@/components/ShoppingListAddForm";
import { useShoppingList } from "@/components/ShoppingListProvider";
import { ShoppingListView } from "@/components/ShoppingListView";

export function ShoppingListSheet() {
  const { sheetOpen, closeSheet } = useShoppingList();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeSheet();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen, closeSheet]);

  if (!mounted || !sheetOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"
      onClick={closeSheet}
      role="presentation"
    >
      <div
        className="panel flex max-h-[min(92dvh,920px)] w-full max-w-lg flex-col rounded-t-2xl shadow-2xl sm:rounded-2xl"
        style={{ background: "rgba(12, 18, 32, 0.98)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Lista de compras"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight text-ink">
              Lista de compras
            </h2>
            <p className="text-xs text-muted">
              Só acompanhamento — não registra compra nem altera a cota.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary !px-2.5 !py-2"
            aria-label="Fechar lista"
            onClick={closeSheet}
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative z-10 shrink-0 space-y-2 border-b border-line px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Adicionar item
          </p>
          <ShoppingListAddForm />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ShoppingListView showAddForm={false} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
