"use client";

import { useMemo, useState } from "react";
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

export function AlimentosPanel({ products }: { products: ProductFormItem[] }) {
  const [editing, setEditing] = useState<ProductFormItem | null>(null);
  const categories = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((p) => p.category.trim())
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <form
          key={editing?.id ?? "new"}
          action={async (formData) => {
            if (editing) {
              await updateProduct(formData);
              setEditing(null);
            } else {
              await createProduct(formData);
            }
          }}
        >
          <ProductFormWithAi
            products={products}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
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
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted">
                  Nenhum alimento cadastrado.
                </td>
              </tr>
            ) : (
              products.map((item) => (
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
                          setEditing(item);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <DeleteButton
                        action={deleteProduct.bind(null, item.id)}
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
