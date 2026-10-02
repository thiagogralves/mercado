import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PurchaseForm } from "@/components/PurchaseForm";
import { toDateInput } from "@/lib/dates";
import { ensureSchema, listProducts, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NovaCompraPage() {
  await ensureSchema();
  const [products, stores] = await Promise.all([listProducts(), listStores()]);

  return (
    <AppShell
      title="Nova compra"
      subtitle="Registre um ou mais alimentos comprados, com preço e mercado."
      action={
        <Link href="/compras" className="btn btn-secondary">
          Voltar
        </Link>
      }
    >
      {stores.length === 0 || products.length === 0 ? (
        <div className="panel space-y-3 p-5">
          <p className="text-sm text-muted">
            Cadastre ao menos um alimento e um mercado antes de registrar
            compras.
          </p>
          <div className="flex gap-2">
            <Link href="/alimentos" className="btn btn-primary">
              Alimentos
            </Link>
            <Link href="/mercados" className="btn btn-secondary">
              Mercados
            </Link>
          </div>
        </div>
      ) : (
        <PurchaseForm
          products={products}
          stores={stores}
          defaultDate={toDateInput()}
        />
      )}
    </AppShell>
  );
}
