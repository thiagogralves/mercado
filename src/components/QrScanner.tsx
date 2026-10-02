"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";

type Props = {
  onScan: (text: string) => void;
  active: boolean;
};

export function QrScanner({ onScan, active }: Props) {
  const regionId = "mercado-qr-reader";
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!active) {
      handled.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => undefined).finally(() => {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
        });
      }
      return;
    }

    let cancelled = false;

    async function start() {
      setStarting(true);
      setError(null);
      handled.current = false;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (decoded) => {
            if (handled.current) return;
            handled.current = true;
            onScan(decoded.trim());
            scanner.stop().catch(() => undefined);
          },
          () => undefined,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível acessar a câmera.";
        setError(
          /Permission|NotAllowed|denied/i.test(message)
            ? "Permissão da câmera negada. Libere o acesso nas configurações do navegador."
            : message,
        );
      } finally {
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => undefined).finally(() => {
          try {
            s.clear();
          } catch {
            /* ignore */
          }
        });
      }
    };
  }, [active, onScan]);

  return (
    <div className="space-y-3">
      <div className="scan-stage">
        <div id={regionId} className="min-h-[280px] w-full overflow-hidden" />
        {active ? <div className="scan-frame" aria-hidden /> : null}
        {!active ? (
          <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
            <div>
              <CameraOff className="mx-auto mb-2 text-muted" size={28} />
              <p className="text-sm text-muted">Câmera pausada</p>
            </div>
          </div>
        ) : null}
      </div>

      {starting ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Camera size={16} className="text-brand" /> Abrindo câmera traseira…
        </p>
      ) : null}
      {error ? <p className="text-sm text-up">{error}</p> : null}
      <p className="text-xs text-muted">
        Aponte para o QR Code impresso no cupom. Assim que ler, buscamos os
        produtos automaticamente.
      </p>
    </div>
  );
}
