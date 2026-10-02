import { AppShell } from "@/components/AppShell";
import { AlimentosPanel } from "@/components/AlimentosPanel";
import { ensureSchema, listProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AlimentosPage() {
  await ensureSchema();
  const items = await listProducts();

  return (
    <AppShell
      title="Alimentos"
      subtitle="Catálogo dos itens. Edite alimentos e categorias, ou use a IA para expandir nomes abreviados."
    >
      <AlimentosPanel products={items} />
    </AppShell>
  );
}
