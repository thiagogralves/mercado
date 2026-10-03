"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/actions";
import { CategoryManager } from "@/components/CategoryManager";
import { DeleteButton } from "@/components/DeleteButton";
import {
  ProductFormWithAi,
  type ProductFormItem,
} from "@/components/ProductFormWithAi";

function restoreScroll(y: number) {
  window.scrollTo({ top: y });
  requestAnimationFrame(() => window.scrollTo({ top: y }));
  setTimeout(() => window.scrollTo({ top: y }), 80);
  setTimeout(() => window.scrollTo({ top: y }), 250);
}

export function AlimentosPanel({ products }: { products: ProductFormItem[] }) {
  const router = useRouter();
  const deletedIds = useRef(new Set<number>());
  const [items, setItems] = useState(products);
  const [editing, setEditing] = useState<ProductFormItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(products.filter((p) => !deletedIds.current.has(p.id)));
  }, [products]);

  const categories = useMemo(
    () =>
      [
        ...new Set(items.map((p) => p.category.trim()).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <form
          key={editing?.id ?? "new"}
          action={async (formData) => {
            setError(null);
            const y = window.scrollY;
            if (editing) {
              await updateProduct(formData);
              const id = editing.id;
              const name = String(formData.get("name") ?? "").trim();
              const unit = String(formData.get("unit") ?? "un");
              const category =
                String(formData.get("category") ?? "Geral").trim() || "Geral";
              const barcode =
                String(formData.get("barcode") ?? "").trim() || null;
              setItems((prev) =>
                prev.map((p) =>
                  p.id === id ? { ...p, name, unit, category, barcode } : p,
                ),
              );
              setEditing(null);
            } else {
              await createProduct(formData);
            }
            startTransition(() => {
              router.refresh();
              restoreScroll(y);
            });
          }}
        >
          <ProductFormWithAi
            products={items}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
        </form>
        <CategoryManager categories={categories} />
      </div>

      <div className="panel table-wrap p-2 md:p-4">
        {error ? <p className="mb-2 px-2 text-sm text-up">{error}</p> : null}
        <table className="data">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Unidade</th>
              <th>Categoria</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  Nenhum alimento cadastrado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={
                    editing?.id === item.id ? "bg-brand/10" : undefined
                  }
                >
                  <td className="font-semibold">{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{item.category}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary !px-3 !py-1.5 text-xs"
                        onClick={() => setEditing(item)}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <DeleteButton
                        refresh={false}
                        confirmMessage="Excluir este alimento? Se ele estiver em compras, cotas ou atalhos de NF, esses vínculos também serão removidos."
                        action={async () => {
                          setError(null);
                          const y = window.scrollY;
                          deletedIds.current.add(item.id);
                          setItems((prev) =>
                            prev.filter((p) => p.id !== item.id),
                          );
                          if (editing?.id === item.id) setEditing(null);
                          try {
                            await deleteProduct(item.id);
                          } catch (err) {
                            deletedIds.current.delete(item.id);
                            setItems((prev) => {
                              if (prev.some((p) => p.id === item.id)) return prev;
                              return [...prev, item].sort((a, b) =>
                                a.name.localeCompare(b.name, "pt-BR"),
                              );
                            });
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Não foi possível excluir.",
                            );
                            throw err;
                          }
                          startTransition(() => {
                            router.refresh();
                            restoreScroll(y);
                          });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
