"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { addProductToMonthlyQuota } from "@/actions";

export function AddToQuotaButton({
  productId,
  productName,
  unit,
  yearMonth,
  suggestedQty,
}: {
  productId: number;
  productName: string;
  unit: string;
  yearMonth: string;
  suggestedQty?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(suggestedQty || 1));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await addProductToMonthlyQuota({
          productId,
          yearMonth,
          targetQuantity: Number(qty.replace(",", ".")),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar cota.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary !px-3 !py-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Target size={14} /> Incluir na cota
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-black/20 p-3">
      <p className="text-xs text-muted">
        Quantidade mensal de <strong className="text-ink">{productName}</strong>{" "}
        ({unit})
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="w-28 rounded-lg border border-line bg-black/30 px-2 py-1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
        />
        <button
          type="button"
          className="btn btn-primary !py-1.5"
          disabled={pending}
          onClick={save}
        >
          {pending ? "…" : "Salvar cota"}
        </button>
        <button
          type="button"
          className="btn btn-secondary !py-1.5"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
      {error ? <p className="text-xs text-up">{error}</p> : null}
    </div>
  );
}
