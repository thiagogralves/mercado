import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MonthSwitcher({
  yearMonth,
  basePath,
}: {
  yearMonth: string;
  basePath: string;
}) {
  const [y, m] = yearMonth.split("-").map(Number);
  const current = new Date(y, m - 1, 1);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}?mes=${fmt(prev)}`}
        className="btn btn-secondary !px-3"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={16} />
      </Link>
      <span className="min-w-28 text-center text-sm font-semibold capitalize text-ink">
        {current.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <Link
        href={`${basePath}?mes=${fmt(next)}`}
        className="btn btn-secondary !px-3"
        aria-label="Próximo mês"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
