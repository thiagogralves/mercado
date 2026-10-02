"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { parseReceiptOcrText } from "@/lib/receipt-ocr";
import type { NfceParseResult } from "@/lib/nfce";

type Props = {
  onResult: (result: NfceParseResult) => void;
};

export function ReceiptPhotoReader({ onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    setStatus("Preparando imagem…");

    const url = URL.createObjectURL(file);
    setPreview(url);

    try {
      setStatus("Lendo texto da nota (OCR)…");
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "por", {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress) {
            setStatus(`Lendo texto… ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      setStatus("Extraindo produtos e valores…");
      const parsed = parseReceiptOcrText(data.text || "");
      if (parsed.items.length === 0) {
        throw new Error(
          "Não encontramos itens na foto. Tente aproximar a câmera, melhorar a luz, ou use o QR Code.",
        );
      }
      onResult(parsed);
      setStatus(`${parsed.items.length} item(ns) encontrados`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no OCR da nota.");
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
        {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
        {busy ? "Processando…" : "Tirar foto / escolher imagem"}
      </button>

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Prévia da nota" className="max-h-72 w-full object-cover" />
        </div>
      ) : (
        <div className="panel grid place-items-center p-8 text-center">
          <Sparkles className="mb-2 text-brand" size={28} />
          <p className="text-sm text-muted">
            Fotografe o cupom inteiro, com boa iluminação. O OCR funciona melhor
            em notas impressas nítidas.
          </p>
        </div>
      )}

      {status ? <p className="text-sm text-accent">{status}</p> : null}
      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
