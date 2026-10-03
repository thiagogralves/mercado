"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshKeepingScroll } from "@/lib/refresh-keep-scroll";

export function DeleteButton({
  action,
  label = "Excluir",
  confirmMessage = "Tem certeza que deseja excluir?",
  onSuccess,
  refresh = true,
}: {
  action: () => Promise<void>;
  label?: string;
  confirmMessage?: string;
  onSuccess?: () => void;
  /** Se false, não chama router.refresh (útil com UI otimista). */
  refresh?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            try {
              await action();
              onSuccess?.();
              if (refresh) refreshKeepingScroll(router);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Não foi possível excluir.",
              );
            }
          });
        }}
      >
        {pending ? "..." : label}
      </button>
      {error ? <p className="max-w-48 text-right text-xs text-up">{error}</p> : null}
    </div>
  );
}
