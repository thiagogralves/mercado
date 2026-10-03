"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  rankProducts,
  resolveProductFromQuery,
  type MatchableProduct,
} from "@/lib/product-match";

export type ComboboxProduct = MatchableProduct;

export function ProductCombobox({
  products,
  value,
  onChange,
  name,
  required,
  placeholder = "Digite para buscar…",
  label = "Alimento",
  inputRef,
  onPick,
  onQueryChange,
}: {
  products: ComboboxProduct[];
  value: string;
  onChange: (productId: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  label?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onPick?: (productId: string) => void;
  onQueryChange?: (query: string) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
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
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // ao sair, tenta casar o texto digitado com um alimento
        const resolved = resolveProductFromQuery(products, query, value);
        if (resolved && String(resolved.id) !== value) {
          onChange(String(resolved.id));
          setQuery(resolved.name);
        }
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [onChange, products, query, value]);

  const results = useMemo(
    () => rankProducts(products, query, 40),
    [products, query],
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function choose(product: ComboboxProduct) {
    onChange(String(product.id));
    setQuery(product.name);
    onQueryChange?.(product.name);
    setOpen(false);
    onPick?.(String(product.id));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key !== "Enter") return;

    if (open && results.length > 0) {
      e.preventDefault();
      const item = results[highlight] ?? results[0];
      if (item) choose(item);
      return;
    }

    const resolved = resolveProductFromQuery(products, query, value);
    if (resolved && String(resolved.id) !== value) {
      e.preventDefault();
      choose(resolved);
      return;
    }

    if (value || resolved) {
      setOpen(false);
      return;
    }

    e.preventDefault();
    setOpen(true);
  }

  return (
    <div className="field" ref={rootRef}>
      {label ? <label>{label}</label> : null}
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <div className="relative z-10">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={(node) => {
            localInputRef.current = node;
            if (inputRef) {
              (inputRef as MutableRefObject<HTMLInputElement | null>).current =
                node;
            }
          }}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onQueryChange?.(next);
            setOpen(true);
            if (selected && next !== selected.name) {
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
          className="relative z-10 w-full !rounded-[0.9rem] !border !border-line !bg-[rgba(7,11,20,0.65)] !py-2.5 !pl-10 !pr-11 text-ink outline-none transition focus:!border-[rgba(200,245,66,0.55)] focus:!shadow-[0_0_0_3px_rgba(200,245,66,0.12)]"
          required={required && !value}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
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
          className="max-h-52 w-full overflow-auto rounded-xl border border-line bg-[#121a2b] py-1 shadow-lg"
        >
          {!query.trim() ? (
            <li className="px-3 py-2 text-sm text-muted">
              Digite o nome do alimento para buscar no catálogo…
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              Nenhum alimento encontrado para “{query}”. Cadastre em Alimentos se
              ainda não existir.
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(product);
                    }}
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
