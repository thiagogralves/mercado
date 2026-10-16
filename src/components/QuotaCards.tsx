"use client";

import { Check, Minus, PackagePlus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerManualQuotaPurchase } from "@/actions";
import { useShoppingList } from "@/components/ShoppingListProvider";
import { formatBRL, formatQty } from "@/lib/money";
import type { QuotaProgress } from "@/lib/queries";
import { refreshKeepingScroll } from "@/lib/refresh-keep-scroll";

type Store = { id: number; name: string };
type PanelMode = "list" | "register" | null;

export function QuotaCards({
  items,
  stores,
  yearMonth,
}: {
  items: QuotaProgress[];
  stores: Store[];
  yearMonth: string;
}) {
  const router = useRouter();
  const { addItem } = useShoppingList();
  const [pending, startTransition] = useTransition();
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [mode, setMode] = useState<PanelMode>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<number, string>>({});
  const [priceByProduct, setPriceByProduct] = useState<Record<number, string>>(
    {},
  );
  const [storeId, setStoreId] = useState(String(stores[0]?.id ?? ""));
  const [flashId, setFlashId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted">
        Nenhuma cota cadastrada para este mês. Vá em{" "}
        <strong className="text-ink">Cotas</strong> e defina o que você pretende
        comprar.
      </div>
    );
  }

  function openPanel(item: QuotaProgress, next: Exclude<PanelMode, null>) {
    setError(null);
    setQtyByProduct((prev) => ({
      ...prev,
      [item.productId]: "1",
    }));
    if (next === "register") {
      setPriceByProduct((prev) => ({
        ...prev,
        [item.productId]: prev[item.productId] ?? "",
      }));
    }
    setOpenFor(item.productId);
    setMode(next);
  }

  function closePanel() {
    setOpenFor(null);
    setMode(null);
    setError(null);
  }

  function confirmListAdd(item: QuotaProgress) {
    const raw = qtyByProduct[item.productId] ?? "1";
    const quantity = Number(String(raw).replace(",", ".")) || 1;
    addItem({
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      quantity,
    });
    closePanel();
    setFlashId(item.productId);
    window.setTimeout(
      () => setFlashId((id) => (id === item.productId ? null : id)),
      1200,
    );
  }

  function confirmRegister(item: QuotaProgress) {
    setError(null);
    const quantity =
      Number(String(qtyByProduct[item.productId] ?? "1").replace(",", ".")) ||
      0;
    const unitPrice =
      Number(String(priceByProduct[item.productId] ?? "0").replace(",", ".")) ||
      0;
    const sid = Number(storeId);

    if (!sid) {
      setError("Cadastre um mercado antes de registrar.");
      return;
    }
    if (!(quantity > 0)) {
      setError("Informe a quantidade comprada.");
      return;
    }

    startTransition(async () => {
      try {
        await registerManualQuotaPurchase({
          productId: item.productId,
          storeId: sid,
          quantity,
          unitPrice,
          yearMonth,
        });
        closePanel();
        refreshKeepingScroll(router);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível registrar a compra.",
        );
      }
    });
  }

  return (
    <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const complete = item.progressPercent >= 100;
        const open = openFor === item.productId;
        const qtyValue = qtyByProduct[item.productId] ?? "1";
        const qtyNum = Number(String(qtyValue).replace(",", ".")) || 1;
        const priceValue = priceByProduct[item.productId] ?? "";

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
                {!open ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary !px-2 !py-1.5"
                      aria-label={`Registrar ${item.productName} como comprado`}
                      title="Registrar comprado na cota"
                      onClick={() => openPanel(item, "register")}
                    >
                      <PackagePlus size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary !px-2 !py-1.5"
                      aria-label={`Adicionar ${item.productName} à lista`}
                      title="Adicionar à lista de compras"
                      onClick={() => openPanel(item, "list")}
                    >
                      {flashId === item.productId ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {open && mode === "list" ? (
              <div className="mb-3 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
                <p className="text-xs text-muted">
                  Quantidade para a lista ({item.unit})
                </p>
                <QtyControls
                  qtyValue={qtyValue}
                  qtyNum={qtyNum}
                  onChange={(v) =>
                    setQtyByProduct((prev) => ({
                      ...prev,
                      [item.productId]: v,
                    }))
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary !py-1.5"
                    onClick={() => confirmListAdd(item)}
                  >
                    Adicionar à lista
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary !py-1.5"
                    onClick={closePanel}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {open && mode === "register" ? (
              <div className="mb-3 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
                <p className="text-xs font-semibold text-ink">
                  Registrar comprado na cota
                </p>
                <p className="text-xs text-muted">
                  Conta no progresso deste alimento. Use quando a nota entrou com
                  nome parecido e não bateu com a cota.
                </p>
                <label className="block text-xs text-muted">
                  Quantidade ({item.unit})
                  <div className="mt-1">
                    <QtyControls
                      qtyValue={qtyValue}
                      qtyNum={qtyNum}
                      onChange={(v) =>
                        setQtyByProduct((prev) => ({
                          ...prev,
                          [item.productId]: v,
                        }))
                      }
                    />
                  </div>
                </label>
                <label className="block text-xs text-muted">
                  Preço unitário (opcional)
                  <input
                    className="mt-1 w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-sm font-semibold text-ink"
                    value={priceValue}
                    inputMode="decimal"
                    placeholder="0,00"
                    onChange={(e) =>
                      setPriceByProduct((prev) => ({
                        ...prev,
                        [item.productId]: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-xs text-muted">
                  Mercado
                  <select
                    className="mt-1 w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 text-sm font-semibold text-ink"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                  >
                    {stores.length === 0 ? (
                      <option value="">Nenhum mercado cadastrado</option>
                    ) : (
                      stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {error ? (
                  <p className="text-xs font-semibold text-red-300">{error}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary !py-1.5"
                    disabled={pending || stores.length === 0}
                    onClick={() => confirmRegister(item)}
                  >
                    {pending ? "Salvando…" : "Registrar na cota"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary !py-1.5"
                    disabled={pending}
                    onClick={closePanel}
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

function QtyControls({
  qtyValue,
  qtyNum,
  onChange,
}: {
  qtyValue: string;
  qtyNum: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary !px-2 !py-1.5"
        aria-label="Diminuir"
        onClick={() =>
          onChange(String(Math.max(0.001, Number((qtyNum - 1).toFixed(3)))))
        }
      >
        <Minus size={14} />
      </button>
      <input
        className="w-20 rounded-lg border border-line bg-black/30 px-2 py-1.5 text-center text-sm font-semibold text-ink"
        value={qtyValue}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-secondary !px-2 !py-1.5"
        aria-label="Aumentar"
        onClick={() => onChange(String(Number((qtyNum + 1).toFixed(3))))}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
