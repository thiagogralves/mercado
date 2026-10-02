import Link from "next/link";
import { Camera, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MonthSwitcher } from "@/components/MonthSwitcher";
import { ProductComparisons } from "@/components/ProductComparisons";
import { QuotaCards } from "@/components/QuotaCards";
import { WeeklyChangesTable } from "@/components/WeeklyChangesTable";
import { formatBRL } from "@/lib/money";
import { formatMonthLabel, toYearMonth } from "@/lib/dates";
import {
  ensureSchema,
  getMonthlySpend,
  getProductPriceHistory,
  getQuotaProgress,
  getWeeklyPriceChanges,
  getWeeklySpend,
} from "@/lib/queries";
import { seedDemoData } from "@/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ mes?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await ensureSchema();
  const params = await searchParams;
  const yearMonth = params.mes ?? toYearMonth();

  const [quotas, spend, weeklySpend, weeklyChanges, productHistory] =
    await Promise.all([
      getQuotaProgress(yearMonth),
      getMonthlySpend(yearMonth),
      getWeeklySpend(yearMonth),
      getWeeklyPriceChanges(yearMonth),
      getProductPriceHistory(yearMonth),
    ]);

  const remainingItems = quotas.filter((q) => q.remainingQuantity > 0).length;
  const completeItems = quotas.filter((q) => q.remainingQuantity <= 0).length;

  return (
    <AppShell
      title="Painel do mês"
      subtitle={`Visão de ${formatMonthLabel(yearMonth)} — cotas, gastos e comparativos.`}
      action={<MonthSwitcher yearMonth={yearMonth} basePath="/" />}
    >
      <div className="space-y-6">
        <section className="panel panel-glow relative overflow-hidden p-5 md:p-7">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">
                <Sparkles size={14} /> Seu mercado, em tempo real
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-tight md:text-4xl">
                Compre com intenção.
                <span className="block text-brand"> Acompanhe com clareza.</span>
              </h2>
              <p className="mt-3 text-sm text-muted md:text-base">
                Escaneie a nota no caixa, preencha a cota do mês e compare preços
                entre mercados e datas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/nota-fiscal" className="btn btn-primary">
                <Camera size={16} /> Escanear nota
              </Link>
              <Link href="/compras/nova" className="btn btn-secondary">
                <Plus size={16} /> Nova compra
              </Link>
            </div>
          </div>
        </section>

        <section className="stagger grid gap-3 md:grid-cols-4">
          <article className="panel stat-card">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Gasto no mês
            </p>
            <p className="value">{formatBRL(spend.total)}</p>
          </article>
          <article className="panel stat-card">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Idas ao mercado
            </p>
            <p className="value">{spend.trips}</p>
          </article>
          <article className="panel stat-card">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Cotas em aberto
            </p>
            <p className="value text-brand">{remainingItems}</p>
          </article>
          <article className="panel stat-card">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Cotas completas
            </p>
            <p className="value text-accent">{completeItems}</p>
          </article>
        </section>

        {quotas.length === 0 && spend.trips === 0 ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Comece em 1 minuto
            </h2>
            <p className="text-sm text-muted">
              Cadastre alimentos e cotas, registre compras semanais e acompanhe
              o que ainda falta. Ou importe o catálogo completo (alimentos +
              mercados do RJ).
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={seedDemoData}>
                <button type="submit" className="btn btn-primary">
                  Cadastrar catálogo RJ
                </button>
              </form>
              <Link href="/cotas" className="btn btn-secondary">
                Criar cotas
              </Link>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
              Progresso das cotas
            </h2>
            <Link href="/cotas" className="text-sm font-semibold text-brand">
              Gerenciar
            </Link>
          </div>
          <QuotaCards items={quotas} />
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
                Comparativo de produtos
              </h2>
              <p className="text-sm text-muted">
                Mesmo alimento em mercados diferentes ou datas diferentes
              </p>
            </div>
            <Link
              href="/comparativos"
              className="text-sm font-semibold text-brand"
            >
              Ver mais
            </Link>
          </div>
          <ProductComparisons rows={productHistory} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-4">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl tracking-tight">
              Gastos por semana
            </h2>
            {weeklySpend.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma compra neste mês.</p>
            ) : (
              <ul className="space-y-2">
                {weeklySpend.map((w) => (
                  <li
                    key={w.isoWeek}
                    className="flex items-center justify-between rounded-xl border border-line bg-white/[0.03] px-3 py-2"
                  >
                    <span className="text-sm font-semibold">{w.isoWeek}</span>
                    <span className="font-semibold text-brand">
                      {formatBRL(w.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
              Alta / baixa na semana
            </h2>
            <WeeklyChangesTable rows={weeklyChanges.slice(0, 6)} />
            {weeklyChanges.length > 6 ? (
              <Link
                href="/comparativos"
                className="text-sm font-semibold text-brand"
              >
                Ver todos os comparativos
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
