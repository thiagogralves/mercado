import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DeleteButton } from "@/components/DeleteButton";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { createBatchPurchase, deletePurchase } from "@/actions";
import { formatDateBr, formatMonthLabel, toDateInput, toYearMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { ensureSchema, listPurchases, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ mes?: string }>;

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureSchema();
  const params = await searchParams;
  const yearMonth = params.mes ?? toYearMonth();
  const [rows, stores] = await Promise.all([
    listPurchases(yearMonth),
    listStores(),
  ]);

  return (
    <AppShell
      title="Compras"
      subtitle={`Registros de ${formatMonthLabel(yearMonth)}. Cadastre item a item ou em lote.`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher yearMonth={yearMonth} basePath="/compras" />
          <Link href="/compras/nova" className="btn btn-primary">
            Nova compra
          </Link>
          <Link href="/nota-fiscal" className="btn btn-secondary">
            Escanear NF
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="panel table-wrap p-2 md:p-4">
          <table className="data">
            <thead>
              <tr>
                <th>Data</th>
                <th>Mercado</th>
                <th>Semana</th>
                <th>Itens</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Nenhuma compra neste mês.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/compras/${row.id}`}
                        className="font-semibold text-brand"
                      >
                        {formatDateBr(row.purchasedAt)}
                      </Link>
                    </td>
                    <td>{row.storeName}</td>
                    <td className="text-sm text-muted">{row.isoWeek}</td>
                    <td>{row.itemCount}</td>
                    <td className="font-semibold">
                      {formatBRL(row.itemsTotal || row.totalAmount || 0)}
                    </td>
                    <td>
                      <DeleteButton
                        action={deletePurchase.bind(null, row.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="panel space-y-3 p-4 md:p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Importação em lote (texto)
          </h2>
          <p className="text-sm text-muted">
            Uma linha por item no formato:{" "}
            <code>nome | quantidade | preço unitário</code>
          </p>
          <form action={createBatchPurchase} className="grid gap-3 md:grid-cols-3">
            <div className="field">
              <label htmlFor="storeId">Mercado</label>
              <select id="storeId" name="storeId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="purchasedAt">Data</label>
              <input
                id="purchasedAt"
                name="purchasedAt"
                type="date"
                required
                defaultValue={toDateInput()}
              />
            </div>
            <div className="field">
              <label htmlFor="notes">Observação</label>
              <input id="notes" name="notes" placeholder="Opcional" />
            </div>
            <div className="field md:col-span-3">
              <label htmlFor="batch">Itens</label>
              <textarea
                id="batch"
                name="batch"
                rows={6}
                required
                placeholder={"Arroz 5kg | 1 | 24,90\nBanana | 1,2 | 5,99"}
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="btn btn-primary">
                Importar lote
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
