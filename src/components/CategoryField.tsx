"use client";

import { useEffect, useId, useMemo, useState } from "react";

const NEW_VALUE = "__new__";

const DEFAULT_CATEGORIES = [
  "Geral",
  "Grãos",
  "Massas",
  "Óleos",
  "Mercearia",
  "Padaria",
  "Laticínios",
  "Frios",
  "Açougue",
  "Peixaria",
  "Hortifruti",
  "Bebidas",
  "Limpeza",
  "Higiene",
  "Congelados",
  "Doces",
  "Pet",
];

function findOption(options: string[], value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (
    options.find((c) => c.toLowerCase() === trimmed.toLowerCase()) ?? null
  );
}

export function CategoryField({
  categories = [],
  value,
  onChange,
  name = "category",
  label = "Categoria",
  id,
}: {
  categories?: string[];
  value: string;
  onChange: (category: string) => void;
  name?: string;
  label?: string;
  id?: string;
}) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const options = useMemo(() => {
    const set = new Set<string>();
    for (const c of [...DEFAULT_CATEGORIES, ...categories]) {
      const trimmed = c.trim();
      if (trimmed) set.add(trimmed);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories]);

  const matched = findOption(options, value);
  const [addingNew, setAddingNew] = useState(!matched && value.trim() !== "");
  const [custom, setCustom] = useState(matched ? "" : value);

  useEffect(() => {
    const hit = findOption(options, value);
    if (hit) {
      setAddingNew(false);
      setCustom("");
      return;
    }
    if (value.trim()) {
      setAddingNew(true);
      setCustom(value);
    }
  }, [value, options]);

  const selectValue = addingNew ? NEW_VALUE : matched || "Geral";

  return (
    <div className="field space-y-2">
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === NEW_VALUE) {
            setAddingNew(true);
            setCustom("");
            onChange("");
            return;
          }
          setAddingNew(false);
          setCustom("");
          onChange(next);
        }}
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_VALUE}>＋ Nova categoria…</option>
      </select>

      {addingNew ? (
        <input
          autoFocus
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Nome da nova categoria"
          required
        />
      ) : null}

      <input type="hidden" name={name} value={value.trim() || "Geral"} />
    </div>
  );
}
