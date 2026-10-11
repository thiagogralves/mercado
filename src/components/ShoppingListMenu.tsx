"use client";

import { ClipboardList, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useShoppingList } from "@/components/ShoppingListProvider";
import { formatQty } from "@/lib/money";

function ShoppingListPanel({ onClose }: { onClose: () => void }) {
  const { items, setChecked, removeItem, clearChecked, clearAll } =
    useShoppingList();

  return (
    <div
      className="panel w-[min(440px,calc(100%-1.5rem))] space-y-3 p-4 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Lista de compras"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Lista de compras</h2>
          <p className="text-xs text-muted">
            Só acompanhamento no mercado — não registra compra.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary !px-2 !py-2"
          aria-label="Fechar lista"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-black/20 p-4 text-sm text-muted">
          Lista vazia. No painel de cotas, use <strong>+</strong> para adicionar
          o que falta pegar.
        </p>
      ) : (
        <ul className="max-h-[min(60vh,420px)] space-y-2 overflow-auto pr-1">
          {items.map((item) => (
            <li
              key={item.productId}
              className={`flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 ${
                item.checked ? "bg-white/[0.03] opacity-60" : "bg-black/20"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--brand)]"
                checked={item.checked}
                onChange={(e) => setChecked(item.productId, e.target.checked)}
                aria-label={`Marcar ${item.productName}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${
                    item.checked ? "line-through text-muted" : "text-ink"
                  }`}
                >
                  {item.productName}
                </p>
                <p className="text-xs text-muted">
                  {formatQty(item.quantity, item.unit)}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger !px-2 !py-1.5"
                aria-label={`Remover ${item.productName}`}
                onClick={() => removeItem(item.productId)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={clearChecked}
            disabled={!items.some((i) => i.checked)}
          >
            Limpar marcados
          </button>
          <button
            type="button"
            className="btn btn-danger flex-1"
            onClick={() => {
              if (confirm("Esvaziar toda a lista de compras?")) clearAll();
            }}
          >
            Esvaziar lista
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ShoppingListMenu({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const { pendingCount } = useShoppingList();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {variant === "desktop" ? (
        <button
          type="button"
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
            open
              ? "bg-brand text-brand-ink"
              : "text-muted hover:bg-white/5 hover:text-ink"
          }`}
          onClick={() => setOpen(true)}
          aria-label="Lista de compras"
        >
          <ClipboardList size={16} />
          Lista
          {pendingCount > 0 ? (
            <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[0.7rem] font-bold">
              {pendingCount}
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          className={`flex flex-col items-center gap-0.5 rounded-[1rem] px-1 py-2 text-[0.65rem] font-bold ${
            open || pendingCount > 0 ? "text-brand" : "text-muted"
          }`}
          onClick={() => setOpen(true)}
        >
          <span className="relative">
            <ClipboardList size={18} />
            {pendingCount > 0 ? (
              <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.6rem] font-bold text-brand-ink">
                {pendingCount}
              </span>
            ) : null}
          </span>
          Lista
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-start justify-center bg-black/55 pt-4 md:pt-8"
          onClick={() => setOpen(false)}
        >
          <div
            className={
              variant === "mobile"
                ? "absolute bottom-[calc(var(--nav-h)+1rem+var(--safe-bottom))] left-1/2 -translate-x-1/2"
                : undefined
            }
          >
            <ShoppingListPanel onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
