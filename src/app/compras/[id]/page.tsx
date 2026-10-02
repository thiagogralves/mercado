import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { formatDateBr, formatWeekLabel } from "@/lib/dates";
import { formatBRL, formatQty } from "@/lib/money";
import { ensureSchema, getPurchaseDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function CompraDetalhePage({
  params,
}: {
  params: Params;
}) {
  await ensureSchema();
  const { id } = await params;
  const purchase = await getPurchaseDetail(Number(id));
  if (!purchase) notFound();

  const total = purchase.items.reduce((sum, i) => sum + i.totalPrice, 0);

  return (
    <AppShell
      title={`Compra de ${formatDateBr(purchase.purchasedAt)}`}
      subtitle={`${purchase.storeName} · ${formatWeekLabel(purchase.isoWeek)}`}
      action={
        <Link href="/compras" className="btn btn-secondary">
          Voltar
        </Link>
      }
    >
      <div className="space-y-4">
        {purchase.notes ? (
          <p className="panel p-4 text-sm text-muted">{purchase.notes}</p>
        ) : null}

        <div className="panel table-wrap p-2 md:p-4">
          <table className="data">
            <thead>
              <tr>
                <th>Alimento</th>
                <th>Qtd</th>
                <th>Preço unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-semibold">{item.productName}</div>
                    {item.rawName && item.rawName !== item.productName ? (
                      <div className="text-xs text-muted">NF: {item.rawName}</div>
                    ) : null}
                  </td>
                  <td>{formatQty(item.quantity, item.unit)}</td>
                  <td>{formatBRL(item.unitPrice)}</td>
                  <td className="font-semibold">{formatBRL(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-right text-lg font-semibold">
          Total: {formatBRL(total)}
        </p>
      </div>
    </AppShell>
  );
}
