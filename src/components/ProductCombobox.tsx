"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export type ComboboxProduct = {
  id: number;
  name: string;
  unit?: string;
};

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scoreMatch(query: string, name: string) {
  const q = normalize(query);
  const n = normalize(name);
  if (!q) return 1;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 75;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => n.includes(t)).length;
  if (hits === 0) return 0;
  return 40 + hits * 15;
}

export function ProductCombobox({
  products,
  value,
  onChange,
  name,
  required,
  placeholder = "Digite para buscar…",
  label = "Alimento",
}: {
  products: ComboboxProduct[];
  value: string;
  onChange: (productId: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => String(p.id) === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setQuery(selected?.name ?? "");
    if (!value) setOpen(false);
  }, [selected?.name, value]);

  useEffect(() => {
    function onDocPointer(e: Event) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  const results = useMemo(() => {
    const ranked = products
      .map((p) => ({ product: p, score: scoreMatch(query, p.name) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    return ranked.slice(0, 12).map((r) => r.product);
  }, [products, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function choose(product: ComboboxProduct) {
    onChange(String(product.id));
    setQuery(product.name);
    setOpen(false);
    // tira o foco para a lista não reabrir no mesmo toque (mobile)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlight];
      if (item) choose(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="field relative" ref={rootRef}>
      {label ? <label>{label}</label> : null}
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected && e.target.value !== selected.name) {
              onChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full rounded-[0.9rem] border border-line bg-[rgba(7,11,20,0.65)] py-2.5 pl-9 pr-10 text-ink outline-none transition focus:border-[rgba(200,245,66,0.55)] focus:shadow-[0_0_0_3px_rgba(200,245,66,0.12)]"
          required={required && !value}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir lista"
        >
          <ChevronsUpDown size={16} />
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-line bg-[#121a2b] py-1 shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              Nenhum alimento encontrado para “{query}”
            </li>
          ) : (
            results.map((product, index) => {
              const active = String(product.id) === value;
              const focused = index === highlight;
              return (
                <li key={product.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      focused ? "bg-brand/20 text-ink" : "hover:bg-white/5"
                    }`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(product)}
                  >
                    <span>
                      {product.name}
                      {product.unit ? (
                        <span className="text-muted"> ({product.unit})</span>
                      ) : null}
                    </span>
                    {active ? <Check size={14} className="text-brand" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
