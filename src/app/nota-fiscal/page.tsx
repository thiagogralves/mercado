import { AppShell } from "@/components/AppShell";
import { NfImportForm } from "@/components/NfImportForm";
import { toDateInput } from "@/lib/dates";
import { ensureSchema, listProducts, listStores } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NotaFiscalPage() {
  await ensureSchema();
  const [products, stores] = await Promise.all([listProducts(), listStores()]);

  return (
    <AppShell
      title="Escanear nota"
      subtitle="Use a câmera para ler o QR Code ou fotografar o cupom e importar os itens."
    >
      <NfImportForm
        products={products}
        stores={stores}
        defaultDate={toDateInput()}
      />
    </AppShell>
  );
}
