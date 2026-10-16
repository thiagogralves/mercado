import { AppShell } from "@/components/AppShell";
import { ShoppingListView } from "@/components/ShoppingListView";

export default function ListaPage() {
  return (
    <AppShell
      title="Lista de compras"
      subtitle="Acompanhamento no mercado — marcar aqui não registra compra nem altera a cota."
    >
      <ShoppingListView />
    </AppShell>
  );
}
