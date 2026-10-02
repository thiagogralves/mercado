import { formatBRL } from "@/lib/money";
import { formatWeekLabel } from "@/lib/dates";
import type { WeeklyPriceChange } from "@/lib/queries";
import type { PriceDelta } from "@/lib/money";

export function DeltaBadge({ delta }: { delta: PriceDelta }) {
  if (delta.direction === "same") {
    return <span className="badge badge-same">Estável</span>;
  }

  const sign = delta.direction === "up" ? "+" : "";
  const cls = delta.direction === "up" ? "badge-up" : "badge-down";
  const label = delta.direction === "up" ? "Alta" : "Baixa";

  return (
    <span className={`badge ${cls}`}>
      {label} {sign}
      {formatBRL(delta.absolute)} ({sign}
      {delta.percent.toFixed(1)}%)
    </span>
  );
}

export function WeeklyChangesTable({ rows }: { rows: WeeklyPriceChange[] }) {
  if (rows.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted">
        Ainda não há compras do mesmo alimento no mesmo mercado em semanas
        diferentes neste mês. Registre ao menos duas semanas para ver alta/baixa.
      </div>
    );
  }

  return (
    <div className="panel table-wrap p-2 md:p-4">
      <table className="data">
        <thead>
          <tr>
            <th>Alimento</th>
            <th>Mercado</th>
            <th>Semanas</th>
            <th>Antes</th>
            <th>Agora</th>
            <th>Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.productId}-${row.storeId}-${row.currentWeek}`}>
              <td>
                <div className="font-semibold">{row.productName}</div>
                <div className="text-xs text-muted">por {row.unit}</div>
              </td>
              <td>{row.storeName}</td>
              <td className="text-xs text-muted">
                <div>{formatWeekLabel(row.previousWeek)}</div>
                <div>→ {formatWeekLabel(row.currentWeek)}</div>
              </td>
              <td>{formatBRL(row.previousPrice)}</td>
              <td>{formatBRL(row.currentPrice)}</td>
              <td>
                <DeltaBadge delta={row.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
