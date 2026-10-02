"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import {
  deletePurchase,
  deletePurchaseItem,
  updatePurchase,
  updatePurchaseItem,
} from "@/actions";
import { AddToQuotaButton } from "@/components/AddToQuotaButton";
import { DeleteButton } from "@/components/DeleteButton";
import { ProductCombobox } from "@/components/ProductCombobox";
import { formatDateBr } from "@/lib/dates";
import { formatBRL, formatQty } from "@/lib/money";

type Item = {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  rawName: string | null;
};

type PurchaseRow = {
  id: number;
  purchasedAt: string;
  yearMonth: string;
  storeId: number;
  storeName: string;
  isoWeek: string;
  itemCount: number;
  itemsTotal: number;
  totalAmount: number | null;
  items: Item[];
};

type Product = { id: number; name: string; unit: string };
type Store = { id: number; name: string };

export function PurchaseList({
  rows,
  products,
  stores,
}: {
  rows: PurchaseRow[];
  products: Product[];
  stores: Store[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, true])),
  );
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="panel p-5 text-sm text-muted">
        Nenhuma compra neste mês.
      </div>
    );
  }

  function startEditItem(item: Item) {
    setEditingItemId(item.id);
    setEditProductId(String(item.productId));
    setEditQty(String(item.quantity).replace(".", ","));
    setEditTotal(String(item.totalPrice).replace(".", ","));
    setError(null);
  }

  function saveItem() {
    if (!editingItemId) return;
    setError(null);
    startTransition(async () => {
      try {
        await updatePurchaseItem({
          id: editingItemId,
          productId: Number(editProductId),
          quantity: Number(editQty.replace(",", ".")),
          totalPrice: Number(editTotal.replace(",", ".")),
        });
        setEditingItemId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar item.");
      }
    });
  }

  function changeStore(purchaseId: number, storeId: string) {
    if (!storeId) return;
    setError(null);
    startTransition(async () => {
      try {
        await updatePurchase({
          id: purchaseId,
          storeId: Number(storeId),
        });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao atualizar mercado.",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-up">{error}</p> : null}
      {rows.map((row) => {
        const isOpen = open[row.id] ?? true;
        return (
          <article key={row.id} className="panel overflow-visible">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Link
                  href={`/compras/${row.id}`}
                  className="font-semibold text-brand"
                >
                  {formatDateBr(row.purchasedAt)}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-muted">Mercado</label>
                  <select
                    className="min-w-[10rem] rounded-lg border border-line bg-black/30 px-2 py-1.5 text-sm"
                    value={row.storeId}
                    disabled={pending}
                    onChange={(e) => changeStore(row.id, e.target.value)}
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted">
                  {row.isoWeek} · {row.itemCount} item(ns) ·{" "}
                  {formatBRL(row.itemsTotal || row.totalAmount || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary !px-3"
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [row.id]: !isOpen }))
                  }
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Itens
                </button>
                <DeleteButton action={deletePurchase.bind(null, row.id)} />
              </div>
            </div>

            {isOpen ? (
              <div className="table-wrap p-2 md:p-3">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Alimento</th>
                      <th>Qtd</th>
                      <th>Unit.</th>
                      <th>Pago</th>
                      <th>Cota</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-muted">
                          Sem itens.
                        </td>
                      </tr>
                    ) : (
                      row.items.map((item) =>
                        editingItemId === item.id ? (
                          <tr key={item.id}>
                            <td colSpan={6}>
                              <div className="space-y-2 rounded-xl border border-line bg-black/20 p-3">
                                <ProductCombobox
                                  products={products}
                                  value={editProductId}
                                  onChange={setEditProductId}
                                  label="Alimento"
                                  placeholder="Buscar alimento…"
                                />
                                <div className="flex flex-wrap gap-2">
                                  <input
                                    className="w-24 rounded-lg border border-line bg-black/30 px-2 py-1"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="Qtd"
                                  />
                                  <input
                                    className="w-28 rounded-lg border border-line bg-black/30 px-2 py-1"
                                    value={editTotal}
                                    onChange={(e) =>
                                      setEditTotal(e.target.value)
                                    }
                                    inputMode="decimal"
                                    placeholder="Valor pago"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-primary !py-1.5"
                                    disabled={pending}
                                    onClick={saveItem}
                                  >
                                    {pending ? "…" : "Salvar"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary !py-1.5"
                                    onClick={() => setEditingItemId(null)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={item.id}>
                            <td>
                              <div className="font-medium">
                                {item.productName}
                              </div>
                              {item.rawName &&
                              item.rawName !== item.productName ? (
                                <div className="text-xs text-muted">
                                  NF: {item.rawName}
                                </div>
                              ) : null}
                            </td>
                            <td>{formatQty(item.quantity, item.unit)}</td>
                            <td>{formatBRL(item.unitPrice)}</td>
                            <td className="font-semibold">
                              {formatBRL(item.totalPrice)}
                            </td>
                            <td>
                              <AddToQuotaButton
                                productId={item.productId}
                                productName={item.productName}
                                unit={item.unit}
                                yearMonth={row.yearMonth}
                                suggestedQty={item.quantity}
                              />
                            </td>
                            <td>
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-secondary !px-3 !py-1.5 text-xs"
                                  onClick={() => startEditItem(item)}
                                >
                                  <Pencil size={14} /> Editar
                                </button>
                                <DeleteButton
                                  action={deletePurchaseItem.bind(
                                    null,
                                    item.id,
                                  )}
                                  label="Remover"
                                  confirmMessage="Remover este item da compra?"
                                />
                              </div>
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
