"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
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
  const qtyRef = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = useMemo(() => {
    const excluded = new Set(excludeProductIds);
    return products.filter((p) => !excluded.has(p.id));
  }, [products, excludeProductIds]);

  function save() {
    setError(null);
    setOk(null);

    const qty = Number(quantity.replace(",", "."));
    if (!productId || !(qty > 0)) {
      setError("Selecione o alimento e informe a quantidade.");
      return;
    }

    const picked = products.find((p) => String(p.id) === productId);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("yearMonth", yearMonth);
    formData.set("targetQuantity", String(qty));
    formData.set("notes", notes);

    startTransition(async () => {
      try {
        await upsertQuota(formData);
        setOk(
          picked
            ? `“${picked.name}” adicionado à cota.`
            : "Cota salva.",
        );
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
    });
  }

  return (
    <form
      key={formKey}
      className="panel h-fit space-y-3 overflow-visible p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) save();
      }}
    >
      <h2 className="font-semibold">Definir / atualizar cota</h2>
      <ProductCombobox
        products={available}
        value={productId}
        onChange={setProductId}
        required
        placeholder="Digite para buscar o alimento…"
        onPick={() => {
          // próximo Enter / foco vai para quantidade
          requestAnimationFrame(() => qtyRef.current?.focus());
        }}
      />
      <div className="field">
        <label htmlFor="targetQuantity">Quantidade mensal</label>
        <input
          ref={qtyRef}
          id="targetQuantity"
          required
          inputMode="decimal"
          placeholder="Ex.: 2 ou 3,5"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!pending) save();
            }
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="notes">Notas</label>
        <input
          id="notes"
          placeholder="Opcional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!pending) save();
            }
          }}
        />
      </div>
      {error ? <p className="text-sm text-up">{error}</p> : null}
      {ok ? <p className="text-sm text-accent">{ok}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Salvando…" : "Salvar cota"}
      </button>
    </form>
  );
}
