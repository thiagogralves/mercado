import { AppShell } from "@/components/AppShell";
import { NfImportForm } from "@/components/NfImportForm";
import { toDateInput } from "@/lib/dates";
import {
  ensureSchema,
  listProductAliases,
  listProducts,
  listStores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NotaFiscalPage() {
  await ensureSchema();
  const [products, stores, aliases] = await Promise.all([
    listProducts(),
    listStores(),
    listProductAliases(),
  ]);

  return (
    <AppShell
      title="Escanear nota"
      subtitle="Fotografe o cupom (uma ou várias fotos). Informe o mercado e a data antes de salvar."
    >
      <NfImportForm
        products={products}
        stores={stores}
        aliases={aliases}
        defaultDate={toDateInput()}
      />
    </AppShell>
  );
}
