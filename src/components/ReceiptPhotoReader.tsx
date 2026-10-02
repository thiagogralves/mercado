"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2, Plus, Sparkles, X } from "lucide-react";
import { readReceiptWithAi } from "@/actions";
import type { NfceParseResult } from "@/lib/nfce";

type Props = {
  onResult: (result: NfceParseResult) => void;
  /** Quando true, cada foto adiciona itens sem substituir a leitura anterior */
  appendMode?: boolean;
};

type Shot = {
  id: string;
  preview: string;
  status: "ok" | "error" | "loading";
  label: string;
};

async function fileToCompressedBase64(file: File): Promise<{
  base64: string;
  mimeType: string;
}> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao compactar imagem."))),
      "image/jpeg",
      0.82,
    );
  });

  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return {
    base64: btoa(binary),
    mimeType: "image/jpeg",
  };
}

export function ReceiptPhotoReader({ onResult, appendMode = true }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    const id = String(Date.now());
    const preview = URL.createObjectURL(file);
    setShots((prev) => [
      ...(appendMode ? prev : []),
      { id, preview, status: "loading", label: "Lendo…" },
    ]);
    setStatus("Gemini está lendo a foto…");

    try {
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const parsed = await readReceiptWithAi({ base64, mimeType });
      onResult(parsed);
      setShots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "ok",
                label: `${parsed.items.length} itens`,
              }
            : s,
        ),
      );
      setStatus(`${parsed.items.length} item(ns) lidos nesta foto`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao ler a nota com IA.";
      setError(message);
      setStatus(null);
      setShots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "error", label: "Falhou" } : s,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : shots.length > 0 ? (
            <Plus size={18} />
          ) : (
            <Camera size={18} />
          )}
          {busy
            ? "Lendo com Gemini…"
            : shots.length > 0
              ? "Outra foto"
              : "Tirar foto"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus size={18} />
          {shots.length > 0 ? "Anexar outra" : "Anexar imagem"}
        </button>
      </div>

      {shots.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {shots.map((shot) => (
            <div
              key={shot.id}
              className="relative overflow-hidden rounded-xl border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.preview}
                alt="Foto da nota"
                className="h-28 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-1 text-xs font-semibold">
                {shot.label}
              </div>
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1"
                aria-label="Remover foto"
                onClick={() =>
                  setShots((prev) => prev.filter((s) => s.id !== shot.id))
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel grid place-items-center p-8 text-center">
          <Sparkles className="mb-2 text-brand" size={28} />
          <p className="text-sm text-muted">
            Tire foto ou anexe da galeria. Nota grande? use várias imagens
            (topo, meio, fim). A IA usa o <strong>valor pago</strong> (última
            coluna).
          </p>
        </div>
      )}

      {status ? <p className="text-sm text-accent">{status}</p> : null}
      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
