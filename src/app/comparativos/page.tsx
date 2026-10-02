import { AppShell } from "@/components/AppShell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { WeeklyChangesTable } from "@/components/WeeklyChangesTable";
import { formatMonthLabel, toYearMonth } from "@/lib/dates";
import { calcPriceDelta, formatBRL } from "@/lib/money";
import {
  ensureSchema,
  getLatestPricesByStore,
  getWeeklyPriceChanges,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ mes?: string }>;

export default async function ComparativosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureSchema();
  const params = await searchParams;
  const yearMonth = params.mes ?? toYearMonth();

  const [latest, weekly] = await Promise.all([
    getLatestPricesByStore(yearMonth),
    getWeeklyPriceChanges(yearMonth),
  ]);

  // Group by product for store comparison
  const byProduct = new Map<
    number,
    {
      productName: string;
      unit: string;
      stores: Array<{ storeName: string; unitPrice: number; purchasedAt: string }>;
    }
  >();

  for (const row of latest) {
    const entry = byProduct.get(row.productId) ?? {
      productName: row.productName,
      unit: row.unit,
      stores: [],
    };
    entry.stores.push({
      storeName: row.storeName,
      unitPrice: row.unitPrice,
      purchasedAt: row.purchasedAt,
    });
    byProduct.set(row.productId, entry);
  }

  const storeComparisons = [...byProduct.values()]
    .filter((p) => p.stores.length >= 2)
    .map((p) => {
      const sorted = [...p.stores].sort((a, b) => a.unitPrice - b.unitPrice);
      const cheapest = sorted[0];
      const priciest = sorted[sorted.length - 1];
      return {
        ...p,
        stores: sorted,
        spread: calcPriceDelta(cheapest.unitPrice, priciest.unitPrice),
      };
    });

  return (
    <AppShell
      title="Comparativos"
      subtitle={`Preços entre mercados e variação semana a semana em ${formatMonthLabel(yearMonth)}.`}
      action={<MonthSwitcher yearMonth={yearMonth} basePath="/comparativos" />}
    >
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Entre mercados
          </h2>
          {storeComparisons.length === 0 ? (
            <div className="panel p-5 text-sm text-muted">
              Compre o mesmo alimento em pelo menos dois mercados neste mês para
              comparar preços.
            </div>
          ) : (
            <div className="stagger grid gap-3">
              {storeComparisons.map((item) => (
                <article key={item.productName} className="panel p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{item.productName}</h3>
                      <p className="text-xs text-muted">por {item.unit}</p>
                    </div>
                    <span className="badge badge-same">
                      Diferença {formatBRL(item.spread.absolute)} (
                      {item.spread.percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {item.stores.map((store) => (
                      <div
                        key={`${item.productName}-${store.storeName}`}
                        className="rounded-xl bg-bg-accent/80 px-3 py-2"
                      >
                        <p className="text-sm font-semibold">{store.storeName}</p>
                        <p className="text-lg font-bold">{formatBRL(store.unitPrice)}</p>
                        <p className="text-xs text-muted">
                          último: {store.purchasedAt}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Mesmo mercado · semana a semana
          </h2>
          <p className="text-sm text-muted">
            Mostra alta ou baixa, diferença em R$ e percentual entre a semana
            atual e a anterior do mesmo mercado.
          </p>
          <WeeklyChangesTable rows={weekly} />
        </section>
      </div>
    </AppShell>
  );
}
