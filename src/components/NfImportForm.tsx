"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Link2 } from "lucide-react";
import { importMappedPurchase, previewNfce } from "@/actions";
import type { NfceParseResult } from "@/lib/nfce";
import { formatBRL } from "@/lib/money";
import { QrScanner } from "@/components/QrScanner";
import { ReceiptPhotoReader } from "@/components/ReceiptPhotoReader";

type Product = { id: number; name: string; unit: string };
type Store = { id: number; name: string };
type Alias = { alias: string; productId: number; productName: string };

type MappingRow = {
  key: string;
  rawName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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

function normalizeAlias(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function suggestProduct(
  rawName: string,
  products: Product[],
  aliases: Alias[],
) {
  const aliasHit = aliases.find(
    (a) => a.alias === normalizeAlias(rawName),
  );
  if (aliasHit) {
    const product = products.find((p) => p.id === aliasHit.productId);
    if (product) return product;
  }

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
  aliases,
  defaultDate,
}: {
  products: Product[];
  stores: Store[];
  aliases: Alias[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("photo");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detectedStore, setDetectedStore] = useState<string>("");
  const [photoCount, setPhotoCount] = useState(0);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [storeId, setStoreId] = useState("");
  const [storeNameManual, setStoreNameManual] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(defaultDate);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => rows.filter((r) => r.include).length,
    [rows],
  );
  const selectedTotal = useMemo(
    () =>
      rows
        .filter((r) => r.include)
        .reduce((sum, r) => sum + (r.totalPrice || r.quantity * r.unitPrice), 0),
    [rows],
  );

  const appendItems = useCallback(
    (result: NfceParseResult, sourceUrl?: string) => {
      if (sourceUrl) setScannedUrl(sourceUrl);
      if (result.storeName) setDetectedStore(result.storeName);
      if (result.purchasedAt && photoCount === 0) {
        setPurchasedAt(result.purchasedAt || defaultDate);
      }
      setPhotoCount((c) => c + 1);

      const newRows: MappingRow[] = result.items.map((item, idx) => {
        const byCatalog = item.matchedCatalogName
          ? products.find(
              (p) =>
                p.name.toLowerCase() ===
                item.matchedCatalogName!.toLowerCase(),
            )
          : null;
        const suggested =
          byCatalog ||
          suggestProduct(
            item.suggestedName || item.name,
            products,
            aliases,
          ) ||
          suggestProduct(item.name, products, aliases);

        const totalPrice = item.totalPrice || item.quantity * item.unitPrice;
        const unitPrice =
          item.quantity > 0 ? totalPrice / item.quantity : item.unitPrice;
        const niceName = item.suggestedName || item.name;

        return {
          key: `${Date.now()}-${idx}-${item.name}`,
          rawName: item.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          unit: item.unit,
          include: true,
          mode: suggested ? "existing" : "create",
          productId: suggested ? String(suggested.id) : "",
          createName: niceName,
        };
      });
      setRows((prev) => [...prev, ...newRows]);
    },
    [aliases, defaultDate, photoCount, products],
  );

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
          appendItems(result, decoded);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Falha ao processar o QR Code.",
          );
        }
      });
    },
    [appendItems],
  );

  function loadPreviewFromUrl() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewNfce(url.trim());
        appendItems(result, url.trim());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falha ao ler a nota fiscal.",
        );
      }
    });
  }

  function updateRow(index: number, patch: Partial<MappingRow>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if ("totalPrice" in patch && next.quantity > 0) {
          next.unitPrice = next.totalPrice / next.quantity;
        }
        if ("quantity" in patch && next.quantity > 0) {
          next.unitPrice = next.totalPrice / next.quantity;
        }
        return next;
      }),
    );
  }

  function confirmImport() {
    if (rows.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const purchaseId = await importMappedPurchase({
          storeId: storeId ? Number(storeId) : undefined,
          storeName:
            storeNameManual.trim() ||
            detectedStore ||
            stores.find((s) => String(s.id) === storeId)?.name ||
            "Mercado",
          purchasedAt: purchasedAt || defaultDate,
          notes:
            photoCount > 0
              ? `Importado por foto da nota (IA Gemini)${photoCount > 1 ? ` · ${photoCount} fotos` : ""}`
              : scannedUrl
                ? "Importado da NFC-e"
                : "Importado",
          nfceUrl: scannedUrl ?? (url.trim() || undefined),
          mappings: rows.map((row) => ({
            rawName: row.rawName,
            include: row.include,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            totalPrice: row.totalPrice,
            unit: row.unit,
            productId:
              row.mode === "existing" && row.productId
                ? Number(row.productId)
                : undefined,
            createName: row.mode === "create" ? row.createName : undefined,
          })),
        });
        router.push(`/compras/${purchaseId}`);
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
            Informe o mercado, tire uma ou várias fotos da nota e revise os
            itens antes de salvar numa compra só.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="field md:col-span-1">
            <label>Mercado</label>
            <select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                if (e.target.value) setStoreNameManual("");
              }}
            >
              <option value="">Detectar / digitar abaixo</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ou digite o mercado</label>
            <input
              value={storeNameManual}
              onChange={(e) => {
                setStoreNameManual(e.target.value);
                if (e.target.value) setStoreId("");
              }}
              placeholder={detectedStore || "Ex.: Guanabara"}
            />
          </div>
          <div className="field">
            <label>Data da compra</label>
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </div>
        </div>

        <div className="tab-bar">
          <button
            type="button"
            className={tab === "photo" ? "active" : undefined}
            onClick={() => setTab("photo")}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <ImagePlus size={15} /> Foto + IA
            </span>
          </button>
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
            className={tab === "url" ? "active" : undefined}
            onClick={() => setTab("url")}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Link2 size={15} /> URL
            </span>
          </button>
        </div>

        {tab === "qr" ? (
          <QrScanner active={tab === "qr"} onScan={handleQrScan} />
        ) : null}

        {tab === "photo" ? (
          <ReceiptPhotoReader
            appendMode
            onResult={(result) => {
              setError(null);
              appendItems(result);
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
                placeholder="Cole o link do QR Code…"
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={loadPreviewFromUrl}
              disabled={pending || !url.trim()}
            >
              {pending ? "Lendo nota…" : "Ler e adicionar itens"}
            </button>
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="panel space-y-4 p-4 md:p-6 animate-rise">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold">Itens da compra</h3>
              <p className="text-xs text-muted">
                {photoCount > 0
                  ? `${photoCount} foto(s) · `
                  : ""}
                {detectedStore ? `detectado: ${detectedStore}` : "revise mercado e data acima"}
              </p>
            </div>
            <p className="text-sm font-semibold text-brand">
              Total: {formatBRL(selectedTotal)}
            </p>
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>OK</th>
                  <th>Item (nota)</th>
                  <th>Qtd</th>
                  <th>Valor pago</th>
                  <th>Vincular a</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
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
                      <div className="font-medium">{row.createName}</div>
                      {row.rawName !== row.createName ? (
                        <div className="text-xs text-muted">NF: {row.rawName}</div>
                      ) : (
                        <div className="text-xs text-muted">{row.unit}</div>
                      )}
                      {row.mode === "existing" && row.productId ? (
                        <div className="text-xs text-accent">casado com catálogo</div>
                      ) : (
                        <div className="text-xs text-brand">nome sugerido pela IA</div>
                      )}
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
                        value={row.totalPrice}
                        onChange={(e) =>
                          updateRow(index, {
                            totalPrice:
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
              {selectedCount} item(ns) · ao vincular, o nome da NF fica
              memorizado para próximas leituras
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRows([]);
                  setPhotoCount(0);
                  setDetectedStore("");
                  setTab("photo");
                }}
              >
                Limpar itens
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmImport}
                disabled={pending || selectedCount === 0}
              >
                {pending ? "Salvando…" : "Salvar compra"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
