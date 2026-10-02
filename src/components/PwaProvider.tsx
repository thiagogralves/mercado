"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;

    setIsIos(ios && !standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!standalone) setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }

  if (!visible && !isIos) return null;

  return (
    <div className="install-banner">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">Instalar Mercado</p>
        <p className="text-xs text-muted">
          {isIos
            ? "No Safari: Compartilhar → Adicionar à Tela de Início"
            : "Atalho na tela inicial, como um app"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isIos ? (
          <button type="button" className="btn btn-primary" onClick={install}>
            <Download size={16} /> Instalar
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          aria-label="Fechar"
          onClick={() => {
            setVisible(false);
            setIsIos(false);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
