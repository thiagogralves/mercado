"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteButton({
  action,
  label = "Excluir",
}: {
  action: () => Promise<void>;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        startTransition(async () => {
          await action();
          router.refresh();
        });
      }}
    >
      {pending ? "..." : label}
    </button>
  );
}
