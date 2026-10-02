import { formatDateBr } from "@/lib/dates";
import { calcPriceDelta, formatBRL } from "@/lib/money";
import type { ProductHistoryRow } from "@/lib/queries";
import { DeltaBadge } from "@/components/WeeklyChangesTable";

export function ProductComparisons({ rows }: { rows: ProductHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="panel p-5 text-sm text-muted">
        Compre o mesmo alimento em mercados ou datas diferentes para ver o
        comparativo aqui.
      </div>
    );
  }

  return (
    <div className="stagger space-y-3">
      {rows.slice(0, 8).map((product) => {
        const prices = product.entries.map((e) => e.unitPrice);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const spread = calcPriceDelta(min, max);

        return (
          <article key={product.productId} className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">{product.productName}</h3>
                <p className="text-xs text-muted">por {product.unit}</p>
              </div>
              {min !== max ? <DeltaBadge delta={spread} /> : null}
            </div>
            <div className="space-y-2">
              {product.entries.map((entry, idx) => (
                <div
                  key={`${entry.storeName}-${entry.purchasedAt}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{entry.storeName}</p>
                    <p className="text-xs text-muted">
                      {formatDateBr(entry.purchasedAt)} · qtd {entry.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand">
                      {formatBRL(entry.unitPrice)}
                      <span className="text-xs font-normal text-muted">
                        /{product.unit}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      pago {formatBRL(entry.totalPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
