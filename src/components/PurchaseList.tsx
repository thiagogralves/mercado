"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { DeleteButton } from "@/components/DeleteButton";
import { deletePurchase } from "@/actions";
import { formatDateBr } from "@/lib/dates";
import { formatBRL, formatQty } from "@/lib/money";

type Item = {
  id: number;
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
  storeName: string;
  isoWeek: string;
  itemCount: number;
  itemsTotal: number;
  totalAmount: number | null;
  items: Item[];
};

export function PurchaseList({ rows }: { rows: PurchaseRow[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, true])),
  );

  if (rows.length === 0) {
    return (
      <div className="panel p-5 text-sm text-muted">
        Nenhuma compra neste mês.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const isOpen = open[row.id] ?? true;
        return (
          <article key={row.id} className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <Link
                  href={`/compras/${row.id}`}
                  className="font-semibold text-brand"
                >
                  {formatDateBr(row.purchasedAt)} · {row.storeName}
                </Link>
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
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted">
                          Sem itens.
                        </td>
                      </tr>
                    ) : (
                      row.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="font-medium">{item.productName}</div>
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
                        </tr>
                      ))
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
