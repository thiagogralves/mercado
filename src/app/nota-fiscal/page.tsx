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
      subtitle="Fotografe o cupom e a IA Gemini extrai produtos e preços — QR Code é opcional."
    >
      <NfImportForm
        products={products}
        stores={stores}
        defaultDate={toDateInput()}
      />
    </AppShell>
  );
}
