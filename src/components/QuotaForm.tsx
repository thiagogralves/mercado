"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { upsertQuota } from "@/actions";
import { ProductCombobox } from "@/components/ProductCombobox";

type Product = { id: number; name: string; unit: string };

export function QuotaForm({
  products,
  yearMonth,
  excludeProductIds = [],
}: {
  products: Product[];
  yearMonth: string;
  excludeProductIds?: number[];
}) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(() => {
    const excluded = new Set(excludeProductIds);
    return products.filter((p) => !excluded.has(p.id));
  }, [products, excludeProductIds]);

  return (
    <form
      key={formKey}
      className="panel h-fit space-y-3 overflow-visible p-4"
      action={async (formData) => {
        setError(null);
        try {
          await upsertQuota(formData);
          setProductId("");
          setQuantity("");
          setNotes("");
          setFormKey((k) => k + 1);
          router.refresh();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Não foi possível salvar a cota.",
          );
        }
      }}
    >
      <h2 className="font-semibold">Definir / atualizar cota</h2>
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <ProductCombobox
        products={available}
        value={productId}
        onChange={setProductId}
        name="productId"
        required
        placeholder="Digite para buscar o alimento…"
      />
      <div className="field">
        <label htmlFor="targetQuantity">Quantidade mensal</label>
        <input
          id="targetQuantity"
          name="targetQuantity"
          required
          inputMode="decimal"
          placeholder="Ex.: 2 ou 3,5"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="notes">Notas</label>
        <input
          id="notes"
          name="notes"
          placeholder="Opcional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-up">{error}</p> : null}
      <button type="submit" className="btn btn-primary w-full">
        Salvar cota
      </button>
    </form>
  );
}
