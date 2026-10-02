import { formatBRL, formatQty } from "@/lib/money";
import type { QuotaProgress } from "@/lib/queries";

export function QuotaCards({ items }: { items: QuotaProgress[] }) {
  if (items.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted">
        Nenhuma cota cadastrada para este mês. Vá em{" "}
        <strong className="text-ink">Cotas</strong> e defina o que você pretende
        comprar.
      </div>
    );
  }

  return (
    <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const complete = item.progressPercent >= 100;
        return (
          <article key={item.quotaId} className="panel panel-glow p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">{item.productName}</h3>
                <p className="text-xs text-muted">{item.category}</p>
              </div>
              <span className="badge badge-same">
                {complete ? "Completo" : `${Math.round(item.progressPercent)}%`}
              </span>
            </div>

            <div
              className={`progress mb-3 ${complete ? "is-complete" : ""}`}
              aria-hidden
            >
              <span style={{ width: `${Math.min(100, item.progressPercent)}%` }} />
            </div>

            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Cota</dt>
                <dd className="font-semibold">
                  {formatQty(item.targetQuantity, item.unit)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Comprado</dt>
                <dd className="font-semibold">
                  {formatQty(item.purchasedQuantity, item.unit)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Falta</dt>
                <dd className="font-semibold text-brand">
                  {formatQty(item.remainingQuantity, item.unit)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-muted">
              Gasto no mês: {formatBRL(item.spent)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
