"use client";

import { Trash2 } from "lucide-react";
import { ShoppingListAddForm } from "@/components/ShoppingListAddForm";
import { useShoppingList } from "@/components/ShoppingListProvider";
import { formatQty } from "@/lib/money";

export function ShoppingListView({
  showAddForm = true,
}: {
  showAddForm?: boolean;
}) {
  const { items, ready, setChecked, removeItem, clearChecked, clearAll } =
    useShoppingList();

  if (!ready) {
    return (
      <div className="panel p-6 text-sm text-muted">Carregando lista…</div>
    );
  }

  const pending = items.filter((i) => !i.checked).length;
  const done = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-4">
      {showAddForm ? (
        <div className="panel space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Adicionar item
          </p>
          <ShoppingListAddForm />
        </div>
      ) : null}

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">
          {items.length === 0
            ? "Nenhum item ainda."
            : `${pending} pendente${pending === 1 ? "" : "s"}${
                done > 0 ? ` · ${done} marcado${done === 1 ? "" : "s"}` : ""
              }`}
        </p>
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearChecked}
              disabled={done === 0}
            >
              Limpar marcados
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirm("Esvaziar toda a lista de compras?")) clearAll();
              }}
            >
              Esvaziar lista
            </button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">
          Digite acima para buscar um alimento cadastrado ou adicionar um item
          livre. Também dá para usar o <strong className="text-ink">+</strong>{" "}
          nos cards de cota.
          <p className="mt-2">
            Marcar itens aqui é só acompanhamento — não registra compra nem
            altera a cota.
          </p>
        </div>
      ) : (
        <ul className="stagger space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`panel flex items-center gap-3 px-4 py-3 ${
                item.checked ? "opacity-60" : ""
              }`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                checked={item.checked}
                onChange={(e) => setChecked(item.id, e.target.checked)}
                aria-label={`Marcar ${item.productName}`}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold ${
                    item.checked ? "line-through text-muted" : "text-ink"
                  }`}
                >
                  {item.productName}
                </p>
                <p className="text-sm text-muted">
                  {formatQty(item.quantity, item.unit)}
                  {item.productId == null ? (
                    <span className="ml-2 text-xs">· avulso</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger !px-2.5 !py-2"
                aria-label={`Remover ${item.productName}`}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
