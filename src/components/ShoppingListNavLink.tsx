"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { useShoppingList } from "@/components/ShoppingListProvider";

export function ShoppingListNavLink({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const { pendingCount } = useShoppingList();
  const active = pathname === "/lista" || pathname.startsWith("/lista/");

  if (variant === "mobile") {
    return (
      <Link
        href="/lista"
        className={active || pendingCount > 0 ? "active" : undefined}
      >
        <span className="relative">
          <ClipboardList size={18} />
          {pendingCount > 0 ? (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.6rem] font-bold text-brand-ink">
              {pendingCount}
            </span>
          ) : null}
        </span>
        Lista
      </Link>
    );
  }

  return (
    <Link
      href="/lista"
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? "bg-brand text-brand-ink"
          : "text-muted hover:bg-white/5 hover:text-ink"
      }`}
    >
      <ClipboardList size={16} />
      Lista
      {pendingCount > 0 ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold ${
            active ? "bg-black/20" : "bg-brand/20 text-brand"
          }`}
        >
          {pendingCount}
        </span>
      ) : null}
    </Link>
  );
}
