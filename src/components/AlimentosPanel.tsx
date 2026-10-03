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
import { refreshKeepingScroll } from "@/lib/refresh-keep-scroll";

export function AlimentosPanel({ products }: { products: ProductFormItem[] }) {
  const router = useRouter();
  const deletedIds = useRef(new Set<number>());
  const [items, setItems] = useState(products);
  const [editing, setEditing] = useState<ProductFormItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
            setOk(null);
            setSaving(true);
            try {
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
                setOk(`“${name}” atualizado.`);
              } else {
                const created = await createProduct(formData);
                if (created) {
                  setItems((prev) =>
                    [...prev, created as ProductFormItem].sort((a, b) =>
                      a.name.localeCompare(b.name, "pt-BR"),
                    ),
                  );
                  setOk(`“${created.name}” cadastrado.`);
                } else {
                  setOk("Alimento cadastrado.");
                }
              }
              startTransition(() => {
                refreshKeepingScroll(router);
              });
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Não foi possível salvar o alimento.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <ProductFormWithAi
            products={items}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
          {error ? (
            <p className="mt-2 text-sm text-up">{error}</p>
          ) : null}
          {ok ? <p className="mt-2 text-sm text-accent">{ok}</p> : null}
          {saving ? (
            <p className="mt-2 text-xs text-muted">Salvando…</p>
          ) : null}
        </form>
        <CategoryManager categories={categories} />
      </div>

      <div className="panel table-wrap p-2 md:p-4">
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
                        onClick={() => {
                          setError(null);
                          setOk(null);
                          setEditing(item);
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <DeleteButton
                        refresh={false}
                        confirmMessage="Excluir este alimento? Se ele estiver em compras, cotas ou atalhos de NF, esses vínculos também serão removidos."
                        action={async () => {
                          setError(null);
                          setOk(null);
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
                            refreshKeepingScroll(router);
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
