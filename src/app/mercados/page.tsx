import { AppShell } from "@/components/AppShell";
import { DeleteButton } from "@/components/DeleteButton";
import { createStore, deleteStore } from "@/actions";
import { ensureSchema, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MercadosPage() {
  await ensureSchema();
  const items = await listStores();

  return (
    <AppShell
      title="Mercados"
      subtitle="Onde você compra — base para comparar preços entre estabelecimentos."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form action={createStore} className="panel h-fit space-y-3 p-4">
          <h2 className="font-semibold">Novo mercado</h2>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" required placeholder="Ex.: Atacadão" />
          </div>
          <div className="field">
            <label htmlFor="city">Cidade</label>
            <input id="city" name="city" placeholder="Opcional" />
          </div>
          <div className="field">
            <label htmlFor="notes">Observações</label>
            <textarea id="notes" name="notes" rows={3} />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Salvar mercado
          </button>
        </form>

        <div className="panel table-wrap p-2 md:p-4">
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cidade</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Nenhum mercado cadastrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.name}</td>
                    <td>{item.city ?? "—"}</td>
                    <td className="text-sm text-muted">{item.notes ?? "—"}</td>
                    <td>
                      <DeleteButton action={deleteStore.bind(null, item.id)} />
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
