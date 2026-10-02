"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  MoreHorizontal,
  Receipt,
  ShoppingBasket,
  Store,
  Target,
  Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";

const primaryLinks = [
  { href: "/", label: "Painel", icon: Home },
  { href: "/cotas", label: "Cotas", icon: Target },
  { href: "/compras", label: "Compras", icon: ShoppingBasket },
  { href: "/nota-fiscal", label: "Escanear", icon: Receipt },
  { href: "/comparativos", label: "Preços", icon: BarChart3 },
];

const moreLinks = [
  { href: "/alimentos", label: "Alimentos", icon: Wheat },
  { href: "/mercados", label: "Mercados", icon: Store },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="mb-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="brand-mark animate-rise">
            <div className="brand-orb">M</div>
            <div>
              <p className="brand-title">Mercado</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Cotas, preços e notas — no bolso.
              </p>
            </div>
          </div>
          {action}
        </div>

        <nav className="desktop-nav panel gap-1 overflow-x-auto p-1.5">
          {[...primaryLinks, ...moreLinks].map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-brand text-brand-ink"
                    : "text-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3 animate-rise">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight tracking-tight text-ink md:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {primaryLinks.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={isActive(pathname, href) ? "active" : undefined}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
        <button
          type="button"
          className={`flex flex-col items-center gap-0.5 rounded-[1rem] px-1 py-2 text-[0.65rem] font-bold ${
            moreOpen || moreLinks.some((l) => isActive(pathname, l.href))
              ? "bg-brand text-brand-ink"
              : "text-muted"
          }`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal size={18} />
          Mais
        </button>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMoreOpen(false)}>
          <div
            className="panel absolute bottom-[calc(var(--nav-h)+1.5rem+var(--safe-bottom))] left-1/2 w-[min(360px,calc(100%-1rem))] -translate-x-1/2 space-y-1 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {[...moreLinks, primaryLinks[4]].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold hover:bg-white/5"
              >
                <Icon size={18} className="text-brand" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
