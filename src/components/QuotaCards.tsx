"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useShoppingList } from "@/components/ShoppingListProvider";
import { formatBRL, formatQty } from "@/lib/money";
import type { QuotaProgress } from "@/lib/queries";

export function QuotaCards({ items }: { items: QuotaProgress[] }) {
  const { addItem } = useShoppingList();
  const [openQtyFor, setOpenQtyFor] = useState<number | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<number, string>>({});
  const [flashId, setFlashId] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted">
        Nenhuma cota cadastrada para este mês. Vá em{" "}
        <strong className="text-ink">Cotas</strong> e defina o que você pretende
        comprar.
      </div>
    );
  }

  function openAdd(item: QuotaProgress) {
    setQtyByProduct((prev) => ({
      ...prev,
      [item.productId]: "1",
    }));
    setOpenQtyFor(item.productId);
  }

  function confirmAdd(item: QuotaProgress) {
    const raw = qtyByProduct[item.productId] ?? "1";
    const quantity = Number(String(raw).replace(",", ".")) || 1;
    addItem({
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity,
    });
    setOpenQtyFor(null);
    setFlashId(item.productId);
    window.setTimeout(() => setFlashId((id) => (id === item.productId ? null : id)), 1200);
  }

  return (
    <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const complete = item.progressPercent >= 100;
        const adding = openQtyFor === item.productId;
        const qtyValue = qtyByProduct[item.productId] ?? "1";
        const qtyNum = Number(String(qtyValue).replace(",", ".")) || 1;

        return (
          <article key={item.quotaId} className="panel panel-glow p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{item.productName}</h3>
                <p className="text-xs text-muted">{item.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="badge badge-same">
                  {complete
                    ? "Completo"
                    : `${Math.round(item.progressPercent)}%`}
                </span>
                {!adding ? (
                  <button
                    type="button"
                    className="btn btn-primary !px-2 !py-1.5"
                    aria-label={`Adicionar ${item.productName} à lista`}
                    title="Adicionar à lista de compras"
                    onClick={() => openAdd(item)}
                  >
                    {flashId === item.productId ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>
                ) : null}
              </div>
            </div>

            {adding ? (
              <div className="mb-3 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
                <p className="text-xs text-muted">
                  Quantidade para a lista ({item.unit})
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary !px-2 !py-1.5"
                    aria-label="Diminuir"
                    onClick={() =>
                      setQtyByProduct((prev) => ({
                        ...prev,
                        [item.productId]: String(
                          Math.max(1, Number((qtyNum - 1).toFixed(3))),
                        ),
                      }))
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    className="w-20 rounded-lg border border-line bg-black/30 px-2 py-1.5 text-center text-sm font-semibold"
                    value={qtyValue}
                    inputMode="decimal"
                    onChange={(e) =>
                      setQtyByProduct((prev) => ({
                        ...prev,
                        [item.productId]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-secondary !px-2 !py-1.5"
                    aria-label="Aumentar"
                    onClick={() =>
                      setQtyByProduct((prev) => ({
                        ...prev,
                        [item.productId]: String(
                          Number((qtyNum + 1).toFixed(3)),
                        ),
                      }))
                    }
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary !py-1.5"
                    onClick={() => confirmAdd(item)}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary !py-1.5"
                    onClick={() => setOpenQtyFor(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <div
              className={`progress mb-3 ${complete ? "is-complete" : ""}`}
              aria-hidden
            >
              <span
                style={{ width: `${Math.min(100, item.progressPercent)}%` }}
              />
            </div>

            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Cota</dt>
                <dd className="font-semibold">
                  {formatQty(item.targetQuantity, item.unit)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Comprado</dt>
                <dd className="font-semibold">
                  {formatQty(item.purchasedQuantity, item.unit)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Falta</dt>
                <dd className="font-semibold text-brand">
                  {formatQty(item.remainingQuantity, item.unit)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-muted">
              Gasto no mês: {formatBRL(item.spent)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
