"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2, Plus, Sparkles, X } from "lucide-react";
import { readReceiptWithAi } from "@/actions";
import type { NfceParseResult } from "@/lib/nfce";

type Props = {
  onResult: (result: NfceParseResult) => void;
  appendMode?: boolean;
};

type Shot = {
  id: string;
  preview: string;
  status: "ok" | "error" | "loading";
  label: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) {
        reject(new Error("Formato de imagem inválido."));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Não foi possível abrir esta imagem. Tente tirar de novo em JPEG/PNG (evite HEIC).",
        ),
      );
    };
    img.src = url;
  });
}

async function fileToCompressedBase64(file: File): Promise<{
  base64: string;
  mimeType: string;
}> {
  if (!file || file.size < 50) {
    throw new Error("Arquivo de imagem inválido.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Imagem muito grande. Tire outra foto mais leve.");
  }

  let width = 0;
  let height = 0;
  let drawable: CanvasImageSource | null = null;
  let bitmap: ImageBitmap | null = null;

  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawable = bitmap;
    }
  } catch {
    bitmap = null;
  }

  if (!drawable) {
    const img = await loadImageElement(file);
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    drawable = img;
  }

  if (!width || !height) {
    throw new Error("Dimensões da imagem inválidas.");
  }

  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(drawable, 0, 0, targetW, targetH);
  bitmap?.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao compactar imagem."))),
      "image/jpeg",
      0.8,
    );
  });

  const base64 = await blobToBase64(blob);
  if (base64.length < 100) {
    throw new Error("Imagem processada ficou inválida. Tente outra foto.");
  }

  return { base64, mimeType: "image/jpeg" };
}

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message) {
    const msg = err.message;
    // Next/React production hides server details behind #441
    if (/Minified React error #441|#441|Server Components render/i.test(msg)) {
      return "Falha ao processar a nota no servidor. Tente outra foto (JPEG), com boa luz, ou tente de novo.";
    }
    return msg;
  }
  if (typeof err === "string" && err.trim()) return err;
  return "Falha ao ler a nota com IA.";
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
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const preview = URL.createObjectURL(file);
    setShots((prev) => [
      ...(appendMode ? prev : []),
      { id, preview, status: "loading", label: "Lendo…" },
    ]);
    setStatus("Gemini está lendo a foto…");

    try {
      const { base64, mimeType } = await fileToCompressedBase64(file);
      const result = await readReceiptWithAi({ base64, mimeType });

      if (!result.ok) {
        throw new Error(result.error);
      }

      onResult(result.data);
      setShots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: "ok",
                label: `${result.data.items.length} itens`,
              }
            : s,
        ),
      );
      setStatus(`${result.data.items.length} item(ns) lidos nesta foto`);
    } catch (err) {
      const message = friendlyError(err);
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
        accept="image/*,image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,image/jpeg,image/png,image/webp"
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
            Tire foto ou anexe da galeria. Preferível JPEG/PNG. Nota grande? use
            várias imagens (topo, meio, fim). A IA usa o{" "}
            <strong>valor pago</strong> (última coluna).
          </p>
        </div>
      )}

      {status ? <p className="text-sm text-accent">{status}</p> : null}
      {error ? <p className="text-sm text-up">{error}</p> : null}
    </div>
  );
}
