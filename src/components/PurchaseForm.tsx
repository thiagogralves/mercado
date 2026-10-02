"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createPurchase } from "@/actions";
import { useRouter } from "next/navigation";
import { ProductCombobox } from "@/components/ProductCombobox";

type Product = { id: number; name: string; unit: string };
type Store = { id: number; name: string };

type Line = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export function PurchaseForm({
  products,
  stores,
  defaultDate,
}: {
  products: Product[];
  stores: Store[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState(String(stores[0]?.id ?? ""));
  const [purchasedAt, setPurchasedAt] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: "1", productId: "", quantity: "1", unitPrice: "" },
  ]);

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = Number(line.quantity.replace(",", ".")) || 0;
      const p = Number(line.unitPrice.replace(",", ".")) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: String(Date.now()),
        productId: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = lines
      .filter((l) => l.productId && l.quantity && l.unitPrice)
      .map((l) => ({
        productId: Number(l.productId),
        quantity: Number(l.quantity.replace(",", ".")),
        unitPrice: Number(l.unitPrice.replace(",", ".")),
      }));

    if (!storeId || items.length === 0) {
      setError("Selecione o mercado e preencha ao menos um item.");
      return;
    }

    startTransition(async () => {
      try {
        await createPurchase({
          storeId: Number(storeId),
          purchasedAt,
          notes: notes || undefined,
          items,
        });
        router.push("/compras");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar compra.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-4 md:p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="field">
          <label htmlFor="storeId">Mercado</label>
          <select
            id="storeId"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="purchasedAt">Data da compra</label>
          <input
            id="purchasedAt"
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="notes">Observação</label>
          <input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: compra da semana"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Itens</h3>
          <button type="button" className="btn btn-secondary" onClick={addLine}>
            <Plus size={16} /> Adicionar linha
          </button>
        </div>

        {lines.map((line) => (
          <div
            key={line.key}
            className="grid gap-2 rounded-xl border border-line bg-white/[0.04] p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <ProductCombobox
              products={products}
              value={line.productId}
              onChange={(productId) => updateLine(line.key, { productId })}
              required
              placeholder="Digite o nome do alimento…"
            />
            <div className="field">
              <label>Quantidade</label>
              <input
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                inputMode="decimal"
                required
              />
            </div>
            <div className="field">
              <label>Preço unitário</label>
              <input
                value={line.unitPrice}
                onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeLine(line.key)}
                aria-label="Remover linha"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          Total estimado:{" "}
          <strong className="text-ink">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
        </p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvando..." : "Registrar compra"}
        </button>
      </div>

      {error ? <p className="text-sm text-up">{error}</p> : null}
    </form>
  );
}
