"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { readReceiptWithAi } from "@/actions";
import type { NfceParseResult } from "@/lib/nfce";

type Props = {
  onResult: (result: NfceParseResult) => void;
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

export function ReceiptPhotoReader({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    setStatus("Preparando foto…");

    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      setStatus("Compactando imagem…");
      const { base64, mimeType } = await fileToCompressedBase64(file);

      setStatus("Gemini está lendo produtos e preços…");
      const parsed = await readReceiptWithAi({ base64, mimeType });

      onResult(parsed);
      setStatus(`${parsed.items.length} item(ns) lidos com IA`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao ler a nota com IA.",
      );
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ImagePlus size={18} />
        )}
        {busy ? "Lendo com Gemini…" : "Tirar foto / escolher imagem"}
      </button>

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Prévia da nota"
            className="max-h-72 w-full object-cover"
          />
        </div>
      ) : (
        <div className="panel grid place-items-center p-8 text-center">
          <Sparkles className="mb-2 text-brand" size={28} />
          <p className="text-sm text-muted">
            Fotografe o cupom inteiro. A IA Gemini identifica mercado, produtos,
            quantidades e preços — mesmo sem QR Code.
          </p>
        </div>
      )}

      {status ? <p className="text-sm text-accent">{status}</p> : null}
      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
