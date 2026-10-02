"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { suggestFoodName } from "@/actions";

type Props = {
  products: Array<{ id: number; name: string }>;
};

export function ProductFormWithAi({ products }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("un");
  const [category, setCategory] = useState("Geral");
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function askAi() {
    if (!name.trim()) return;
    setHint(null);
    startTransition(async () => {
      try {
        const result = await suggestFoodName(name.trim());
        if (result.matchedCatalogName) {
          setHint(
            `Já existe no catálogo: “${result.matchedCatalogName}”. Prefira usar esse alimento nas compras em vez de criar outro.`,
          );
          setName(result.matchedCatalogName);
        } else {
          setName(result.suggestedName);
          setUnit(result.unit);
          setCategory(result.category || "Geral");
          setHint(
            `IA sugeriu: “${result.suggestedName}” (${result.confidence}). Revise e salve.`,
          );
        }
      } catch (err) {
        setHint(
          err instanceof Error ? err.message : "Não foi possível sugerir o nome.",
        );
      }
    });
  }

  return (
    <div className="panel h-fit space-y-3 p-4">
      <h2 className="font-semibold">Novo alimento</h2>
      <div className="field">
        <label htmlFor="name">Nome (pode ser abreviado)</label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: ARZ TIO JOAO ou Arroz 5kg"
        />
      </div>
      <button
        type="button"
        className="btn btn-accent w-full"
        disabled={pending || name.trim().length < 2}
        onClick={askAi}
      >
        <Sparkles size={16} />
        {pending ? "Consultando Gemini…" : "Sugerir nome com IA"}
      </button>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {products.some(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
      ) ? (
        <p className="text-xs text-accent">
          Esse nome já está no catálogo — pode não precisar cadastrar de novo.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="unit">Unidade</label>
        <select
          id="unit"
          name="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          <option value="un">Unidade</option>
          <option value="kg">Kg</option>
          <option value="g">g</option>
          <option value="L">Litro</option>
          <option value="ml">ml</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="category">Categoria</label>
        <input
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Ex.: Grãos"
        />
      </div>
      <div className="field">
        <label htmlFor="barcode">Código de barras (opcional)</label>
        <input id="barcode" name="barcode" />
      </div>
      <button type="submit" className="btn btn-primary w-full">
        Salvar alimento
      </button>
    </div>
  );
}
