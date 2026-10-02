import { AppShell } from "@/components/AppShell";
import { DeleteButton } from "@/components/DeleteButton";
import { ProductFormWithAi } from "@/components/ProductFormWithAi";
import { createProduct, deleteProduct } from "@/actions";
import { ensureSchema, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AlimentosPage() {
  await ensureSchema();
  const items = await listProducts();

  return (
    <AppShell
      title="Alimentos"
      subtitle="Catálogo dos itens. Use a IA para expandir nomes abreviados da nota."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form action={createProduct}>
          <ProductFormWithAi products={items} />
        </form>

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
                  <tr key={item.id}>
                    <td className="font-semibold">{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{item.category}</td>
                    <td>
                      <DeleteButton
                        action={deleteProduct.bind(null, item.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
