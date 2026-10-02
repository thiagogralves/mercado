"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { renameCategory } from "@/actions";

export function CategoryManager({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [nextName, setNextName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (categories.length === 0) {
    return (
      <div className="panel p-4 text-sm text-muted">
        Nenhuma categoria em uso ainda.
      </div>
    );
  }

  function startEdit(name: string) {
    setEditing(name);
    setNextName(name);
    setError(null);
  }

  function save() {
    if (!editing) return;
    setError(null);
    const formData = new FormData();
    formData.set("from", editing);
    formData.set("to", nextName.trim());
    startTransition(async () => {
      try {
        await renameCategory(formData);
        setEditing(null);
        setNextName("");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível renomear.",
        );
      }
    });
  }

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="font-semibold">Categorias</h2>
      <p className="text-xs text-muted">
        Renomear atualiza todos os alimentos dessa categoria.
      </p>
      <ul className="space-y-2">
        {categories.map((cat) => (
          <li
            key={cat}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
          >
            {editing === cat ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-2 py-1"
                  value={nextName}
                  onChange={(e) => setNextName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary !px-3 !py-1.5 text-xs"
                  disabled={pending || !nextName.trim()}
                  onClick={save}
                >
                  {pending ? "…" : "Salvar"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary !px-3 !py-1.5 text-xs"
                  disabled={pending}
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium">{cat}</span>
                <button
                  type="button"
                  className="btn btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => startEdit(cat)}
                >
                  <Pencil size={14} /> Editar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-up">{error}</p> : null}
    </div>
  );
}
