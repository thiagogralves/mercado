"use client";

import { useState } from "react";
import { upsertQuota } from "@/actions";
import { ProductCombobox } from "@/components/ProductCombobox";

type Product = { id: number; name: string; unit: string };

export function QuotaForm({
  products,
  yearMonth,
}: {
  products: Product[];
  yearMonth: string;
}) {
  const [productId, setProductId] = useState("");

  return (
    <form action={upsertQuota} className="panel h-fit space-y-3 p-4">
      <h2 className="font-semibold">Definir / atualizar cota</h2>
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <ProductCombobox
        products={products}
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
        />
      </div>
      <div className="field">
        <label htmlFor="notes">Notas</label>
        <input id="notes" name="notes" placeholder="Opcional" />
      </div>
      <button type="submit" className="btn btn-primary w-full">
        Salvar cota
      </button>
    </form>
  );
}
