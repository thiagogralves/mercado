import { AppShell } from "@/components/AppShell";
import { DeleteButton } from "@/components/DeleteButton";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { QuotaCards } from "@/components/QuotaCards";
import {
  copyQuotasFromPreviousMonth,
  deleteQuota,
  upsertQuota,
} from "@/actions";
import { formatMonthLabel, toYearMonth } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import {
  ensureSchema,
  getQuotaProgress,
  listProducts,
} from "@/lib/queries";
import { db } from "@/db";
import { monthlyQuotas, products } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ mes?: string }>;

function previousMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CotasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureSchema();
  const params = await searchParams;
  const yearMonth = params.mes ?? toYearMonth();
  const fromMonth = previousMonth(yearMonth);

  const [progress, productList, quotaRows] = await Promise.all([
    getQuotaProgress(yearMonth),
    listProducts(),
    db
      .select({
        id: monthlyQuotas.id,
        targetQuantity: monthlyQuotas.targetQuantity,
        notes: monthlyQuotas.notes,
        productName: products.name,
        unit: products.unit,
      })
      .from(monthlyQuotas)
      .innerJoin(products, eq(monthlyQuotas.productId, products.id))
      .where(eq(monthlyQuotas.yearMonth, yearMonth))
      .orderBy(asc(products.name)),
  ]);

  async function copyAction() {
    "use server";
    await copyQuotasFromPreviousMonth(fromMonth, yearMonth);
  }

  return (
    <AppShell
      title="Cotas mensais"
      subtitle={`Defina quanto pretende comprar em ${formatMonthLabel(yearMonth)} e acompanhe o que ainda falta.`}
      action={<MonthSwitcher yearMonth={yearMonth} basePath="/cotas" />}
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-3">
            <form action={upsertQuota} className="panel h-fit space-y-3 p-4">
              <h2 className="font-semibold">Definir / atualizar cota</h2>
              <input type="hidden" name="yearMonth" value={yearMonth} />
              <div className="field">
                <label htmlFor="productId">Alimento</label>
                <select id="productId" name="productId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {productList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="targetQuantity">Quantidade mensal</label>
                <input
                  id="targetQuantity"
                  name="targetQuantity"
                  required
                  inputMode="decimal"
                  placeholder="Ex.: 2 ou 3,5"
                />
              </div>
              <div className="field">
                <label htmlFor="notes">Notas</label>
                <input id="notes" name="notes" placeholder="Opcional" />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Salvar cota
              </button>
            </form>
            <form action={copyAction} className="panel p-4">
              <button type="submit" className="btn btn-secondary w-full">
                Copiar cotas de {fromMonth}
              </button>
            </form>
          </div>

          <div className="panel table-wrap p-2 md:p-4">
            <table className="data">
              <thead>
                <tr>
                  <th>Alimento</th>
                  <th>Cota</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotaRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      Nenhuma cota neste mês.
                    </td>
                  </tr>
                ) : (
                  quotaRows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold">{row.productName}</td>
                      <td>{formatQty(row.targetQuantity, row.unit)}</td>
                      <td className="text-sm text-muted">{row.notes ?? "—"}</td>
                      <td>
                        <DeleteButton action={deleteQuota.bind(null, row.id)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Quanto falta comprar
          </h2>
          <QuotaCards items={progress} />
        </section>
      </div>
    </AppShell>
  );
}
