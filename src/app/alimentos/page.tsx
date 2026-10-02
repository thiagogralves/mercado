import { AppShell } from "@/components/AppShell";
import { DeleteButton } from "@/components/DeleteButton";
import { createProduct, deleteProduct } from "@/actions";
import { ensureSchema, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AlimentosPage() {
  await ensureSchema();
  const items = await listProducts();

  return (
    <AppShell
      title="Alimentos"
      subtitle="Catálogo dos itens que entram nas cotas e nas compras."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form action={createProduct} className="panel h-fit space-y-3 p-4">
          <h2 className="font-semibold">Novo alimento</h2>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" required placeholder="Ex.: Arroz 5kg" />
          </div>
          <div className="field">
            <label htmlFor="unit">Unidade</label>
            <select id="unit" name="unit" defaultValue="un">
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
              placeholder="Ex.: Grãos"
              defaultValue="Geral"
            />
          </div>
          <div className="field">
            <label htmlFor="barcode">Código de barras (opcional)</label>
            <input id="barcode" name="barcode" />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Salvar alimento
          </button>
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
