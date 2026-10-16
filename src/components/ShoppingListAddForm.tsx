"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Minus, Plus, Search } from "lucide-react";
import { getShoppingListCatalog } from "@/actions";
import { useShoppingList } from "@/components/ShoppingListProvider";
import {
  normalizeProductText,
  rankProducts,
  type MatchableProduct,
} from "@/lib/product-match";

type CatalogProduct = MatchableProduct & { unit: string };

export function ShoppingListAddForm() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addItem } = useShoppingList();

  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [qty, setQty] = useState("1");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getShoppingListCatalog()
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocPointer(e: Event) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  const results = useMemo(
    () => rankProducts(catalog, query, 8) as CatalogProduct[],
    [catalog, query],
  );

  const trimmed = query.trim();
  const exactMatch = useMemo(() => {
    const q = normalizeProductText(trimmed);
    if (!q) return null;
    return catalog.find((p) => normalizeProductText(p.name) === q) ?? null;
  }, [catalog, trimmed]);

  const showCustomOption = Boolean(trimmed) && !exactMatch && !selected;
  const optionCount = results.length + (showCustomOption ? 1 : 0);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function qtyNum() {
    return Math.max(0.001, Number(String(qty).replace(",", ".")) || 1);
  }

  function pickSuggestion(product: CatalogProduct) {
    setSelected(product);
    setQuery(product.name);
    setOpen(false);
    inputRef.current?.focus();
  }

  function pickCustomLabel() {
    setSelected(null);
    setQuery(trimmed);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (
      selected &&
      normalizeProductText(value) !== normalizeProductText(selected.name)
    ) {
      setSelected(null);
    }
  }

  function commit() {
    const name = trimmed;
    if (!name) return;

    if (selected) {
      addItem({
        productId: selected.id,
        productName: selected.name,
        unit: selected.unit || "un",
        quantity: qtyNum(),
      });
    } else if (exactMatch) {
      addItem({
        productId: exactMatch.id,
        productName: exactMatch.name,
        unit: exactMatch.unit || "un",
        quantity: qtyNum(),
      });
    } else {
      addItem({
        productId: null,
        productName: name,
        unit: "un",
        quantity: qtyNum(),
      });
    }

    setQuery("");
    setSelected(null);
    setQty("1");
    setOpen(false);
    inputRef.current?.focus();
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
      else setHighlight((h) => Math.min(h + 1, Math.max(optionCount - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      if (!open) return;
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key !== "Enter") return;
    e.preventDefault();

    // Com sugestões abertas: só preenche o campo (não adiciona ainda).
    if (open && optionCount > 0) {
      if (highlight < results.length) {
        const item = results[highlight];
        if (item) pickSuggestion(item);
        return;
      }
      if (showCustomOption) {
        pickCustomLabel();
        return;
      }
    }

    commit();
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            className="w-full rounded-xl border border-line bg-black/30 py-2.5 pl-9 pr-3 text-sm font-semibold text-ink"
            placeholder={
              loading ? "Carregando alimentos…" : "Digite para buscar ou criar…"
            }
            value={query}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              if (!selected) setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-secondary !px-2 !py-2"
            aria-label="Diminuir quantidade"
            onClick={() =>
              setQty(String(Math.max(0.001, Number((qtyNum() - 1).toFixed(3)))))
            }
          >
            <Minus size={14} />
          </button>
          <input
            className="w-14 rounded-lg border border-line bg-black/30 px-1 py-2 text-center text-sm font-semibold text-ink"
            value={qty}
            inputMode="decimal"
            aria-label="Quantidade"
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary !px-2 !py-2"
            aria-label="Aumentar quantidade"
            onClick={() => setQty(String(Number((qtyNum() + 1).toFixed(3))))}
          >
            <Plus size={14} />
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary !py-2"
          disabled={!trimmed}
          onClick={commit}
        >
          Adicionar
        </button>
      </div>

      {open && trimmed && !selected ? (
        <ul
          id={listId}
          role="listbox"
          className="max-h-56 overflow-auto rounded-xl border border-line bg-[rgba(10,16,28,0.98)] p-1 shadow-xl"
        >
          {results.map((product, index) => (
            <li key={product.id} role="option" aria-selected={highlight === index}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  highlight === index
                    ? "bg-brand text-brand-ink"
                    : "text-ink hover:bg-white/5"
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pickSuggestion(product)}
              >
                <span className="font-semibold">{product.name}</span>
                <span
                  className={`text-xs ${
                    highlight === index ? "text-brand-ink/80" : "text-muted"
                  }`}
                >
                  {product.unit}
                </span>
              </button>
            </li>
          ))}

          {showCustomOption ? (
            <li role="option" aria-selected={highlight === results.length}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  highlight === results.length
                    ? "bg-brand text-brand-ink"
                    : "text-ink hover:bg-white/5"
                }`}
                onMouseEnter={() => setHighlight(results.length)}
                onClick={pickCustomLabel}
              >
                <Plus size={14} />
                <span>
                  Usar{" "}
                  <strong className="font-bold">&quot;{trimmed}&quot;</strong>
                  <span
                    className={`ml-1 text-xs ${
                      highlight === results.length
                        ? "text-brand-ink/80"
                        : "text-muted"
                    }`}
                  >
                    (não cadastrado)
                  </span>
                </span>
              </button>
            </li>
          ) : null}

          {results.length === 0 && !showCustomOption ? (
            <li className="px-3 py-2 text-sm text-muted">Nada encontrado.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
