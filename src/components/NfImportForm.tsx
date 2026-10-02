"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Link2 } from "lucide-react";
import { importMappedPurchase, previewNfce } from "@/actions";
import type { NfceParseResult } from "@/lib/nfce";
import { QrScanner } from "@/components/QrScanner";
import { ReceiptPhotoReader } from "@/components/ReceiptPhotoReader";

type Product = { id: number; name: string; unit: string };
type Store = { id: number; name: string };

type MappingRow = {
  rawName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  include: boolean;
  mode: "existing" | "create";
  productId: string;
  createName: string;
};

type Tab = "qr" | "photo" | "url";

function scoreName(a: string, b: string) {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const tokensA = new Set(na.split(/\s+/));
  const tokensB = nb.split(/\s+/);
  const hits = tokensB.filter((t) => t.length > 2 && tokensA.has(t)).length;
  return hits * 20;
}

function suggestProduct(rawName: string, products: Product[]) {
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const score = scoreName(rawName, p.name);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return bestScore >= 40 ? best : null;
}

export function NfImportForm({
  products,
  stores,
  defaultDate,
}: {
  products: Product[];
  stores: Store[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("qr");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NfceParseResult | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [storeId, setStoreId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(defaultDate);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.include).length,
    [rows],
  );

  function applyPreview(result: NfceParseResult, sourceUrl?: string) {
    setPreview(result);
    setPurchasedAt(result.purchasedAt || defaultDate);
    if (sourceUrl) setScannedUrl(sourceUrl);
    setRows(
      result.items.map((item) => {
        const suggested = suggestProduct(item.name, products);
        return {
          rawName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          include: true,
          mode: suggested ? "existing" : "create",
          productId: suggested ? String(suggested.id) : "",
          createName: item.name,
        };
      }),
    );
  }

  const handleQrScan = useCallback(
    (decoded: string) => {
      setError(null);
      setUrl(decoded);
      setTab("url");
      startTransition(async () => {
        try {
          if (!/^https?:\/\//i.test(decoded)) {
            throw new Error(
              "QR lido, mas não parece uma URL de NFC-e. Tente a foto da nota.",
            );
          }
          const result = await previewNfce(decoded);
          applyPreview(result, decoded);
        } catch (err) {
          setPreview(null);
          setRows([]);
          setError(
            err instanceof Error ? err.message : "Falha ao processar o QR Code.",
          );
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, defaultDate],
  );

  function loadPreviewFromUrl() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewNfce(url.trim());
        applyPreview(result, url.trim());
      } catch (err) {
        setPreview(null);
        setRows([]);
        setError(
          err instanceof Error ? err.message : "Falha ao ler a nota fiscal.",
        );
      }
    });
  }

  function updateRow(index: number, patch: Partial<MappingRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function confirmImport() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      try {
        await importMappedPurchase({
          storeId: storeId ? Number(storeId) : undefined,
          storeName: preview.storeName,
          purchasedAt,
          notes:
            preview.source === "ocr"
              ? "Importado por foto da nota (OCR)"
              : `Importado da NFC-e${preview.nfceKey ? ` (${preview.nfceKey})` : ""}`,
          nfceUrl: scannedUrl ?? (url.trim() || undefined),
          nfceKey: preview.nfceKey,
          mappings: rows.map((row) => ({
            rawName: row.rawName,
            include: row.include,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            unit: row.unit,
            productId:
              row.mode === "existing" && row.productId
                ? Number(row.productId)
                : undefined,
            createName: row.mode === "create" ? row.createName : undefined,
          })),
        });
        router.push("/compras");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro na importação.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="panel panel-glow space-y-4 p-4 md:p-6">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            Captura inteligente
          </h2>
          <p className="mt-1 text-sm text-muted">
            Escaneie o QR, fotografe o cupom ou cole a URL da SEFAZ.
          </p>
        </div>

        <div className="tab-bar">
          <button
            type="button"
            className={tab === "qr" ? "active" : undefined}
            onClick={() => setTab("qr")}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Camera size={15} /> QR Code
            </span>
          </button>
          <button
            type="button"
            className={tab === "photo" ? "active" : undefined}
            onClick={() => setTab("photo")}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <ImagePlus size={15} /> Foto
            </span>
          </button>
          <button
            type="button"
            className={tab === "url" ? "active" : undefined}
            onClick={() => setTab("url")}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Link2 size={15} /> URL
            </span>
          </button>
        </div>

        {tab === "qr" ? (
          <QrScanner active={tab === "qr" && !preview} onScan={handleQrScan} />
        ) : null}

        {tab === "photo" ? (
          <ReceiptPhotoReader
            onResult={(result) => {
              setError(null);
              setScannedUrl(null);
              applyPreview(result);
            }}
          />
        ) : null}

        {tab === "url" ? (
          <div className="space-y-3">
            <div className="field">
              <label htmlFor="nfceUrl">URL do QR Code da NFC-e</label>
              <textarea
                id="nfceUrl"
                rows={3}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do QR Code ou use a aba QR Code para escanear…"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadPreviewFromUrl}
              disabled={pending || !url.trim()}
            >
              {pending && !preview ? "Lendo nota…" : "Ler nota fiscal"}
            </button>
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="panel space-y-4 p-4 md:p-6 animate-rise">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                Mercado detectado
              </p>
              <p className="font-semibold">{preview.storeName}</p>
              <p className="mt-1 text-xs text-accent">fonte: {preview.source}</p>
            </div>
            <div className="field">
              <label>Usar mercado</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">Criar/usar: {preview.storeName}</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Data</label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Preço</th>
                  <th>Vincular a</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.rawName}-${index}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) =>
                          updateRow(index, { include: e.target.checked })
                        }
                      />
                    </td>
                    <td className="max-w-[220px]">
                      <div className="font-medium">{row.rawName}</div>
                      <div className="text-xs text-muted">{row.unit}</div>
                    </td>
                    <td>
                      <input
                        className="w-20 rounded-lg border border-line bg-black/30 px-2 py-1"
                        value={row.quantity}
                        onChange={(e) =>
                          updateRow(index, {
                            quantity:
                              Number(e.target.value.replace(",", ".")) || 0,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="w-24 rounded-lg border border-line bg-black/30 px-2 py-1"
                        value={row.unitPrice}
                        onChange={(e) =>
                          updateRow(index, {
                            unitPrice:
                              Number(e.target.value.replace(",", ".")) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="min-w-[220px] space-y-2">
                      <select
                        value={row.mode}
                        onChange={(e) =>
                          updateRow(index, {
                            mode: e.target.value as "existing" | "create",
                          })
                        }
                        className="w-full rounded-lg border border-line bg-black/30 px-2 py-1"
                      >
                        <option value="existing">Alimento existente</option>
                        <option value="create">Criar alimento</option>
                      </select>
                      {row.mode === "existing" ? (
                        <select
                          value={row.productId}
                          onChange={(e) =>
                            updateRow(index, { productId: e.target.value })
                          }
                          className="w-full rounded-lg border border-line bg-black/30 px-2 py-1"
                        >
                          <option value="">Selecione</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={row.createName}
                          onChange={(e) =>
                            updateRow(index, { createName: e.target.value })
                          }
                          className="w-full rounded-lg border border-line bg-black/30 px-2 py-1"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {selectedCount} item(ns) selecionado(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPreview(null);
                  setRows([]);
                  setTab("qr");
                }}
              >
                Nova leitura
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmImport}
                disabled={pending || selectedCount === 0}
              >
                {pending ? "Importando…" : "Confirmar importação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
