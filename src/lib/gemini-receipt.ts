import type { NfceItem, NfceParseResult } from "@/lib/nfce";

type GeminiReceiptJson = {
  storeName?: string;
  storeCnpj?: string;
  purchasedAt?: string;
  totalAmount?: number;
  items?: Array<{
    name?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
  }>;
};

const PROMPT = `Você é um extrator de cupons fiscais / notas de supermercado brasileiros.
Analise a imagem da nota (pode ser cupom térmico, DANFE, NFC-e impressa ou foto de celular).
Extraia TODOS os produtos com quantidade, unidade e preços.

Responda APENAS um JSON válido (sem markdown) neste formato:
{
  "storeName": "nome do mercado",
  "storeCnpj": "opcional",
  "purchasedAt": "YYYY-MM-DD ou string vazia",
  "totalAmount": 0,
  "items": [
    {
      "name": "nome do produto",
      "quantity": 1,
      "unit": "un|kg|g|L|ml",
      "unitPrice": 0,
      "totalPrice": 0
    }
  ]
}

Regras:
- Use ponto como decimal nos números (ex: 12.90).
- Se só houver preço total do item, calcule unitPrice = totalPrice / quantity.
- Ignore taxas, pagamento, troco, CPF e mensagens legais.
- Normalize nomes (ex: "ARZ TIO JOAO 5KG" → "Arroz Tio João 5kg") sem inventar produtos.
- Se a imagem estiver ruim, ainda assim tente extrair o que for legível.
- unit deve ser uma de: un, kg, g, L, ml.`;

function extractJson(text: string): GeminiReceiptJson {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as GeminiReceiptJson;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou um JSON válido.");
    return JSON.parse(match[0]) as GeminiReceiptJson;
  }
}

function normalizeUnit(unit?: string): string {
  const u = (unit ?? "un").toLowerCase().trim();
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  if (["g", "gr", "grama", "gramas"].includes(u)) return "g";
  if (["l", "lt", "litro", "litros"].includes(u)) return "L";
  if (["ml", "mililitro", "mililitros"].includes(u)) return "ml";
  return "un";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    // Formato BR: 1.234,56
    if (/^\d{1,3}(\.\d{3})*,\d+$/.test(trimmed)) {
      return Number(trimmed.replace(/\./g, "").replace(",", "."));
    }
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function parseReceiptWithGemini(input: {
  base64: string;
  mimeType: string;
}): Promise<NfceParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Crie uma chave gratuita em https://aistudio.google.com/apikey",
    );
  }

  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: {
                mime_type: input.mimeType || "image/jpeg",
                data: input.base64,
              },
            },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    if (res.status === 400 && /model/i.test(errText)) {
      throw new Error(
        `Modelo Gemini inválido (${model}). Defina GEMINI_MODEL (ex: gemini-3-flash-preview).`,
      );
    }
    if (res.status === 403 || res.status === 401) {
      throw new Error("Chave do Gemini inválida ou sem permissão.");
    }
    if (res.status === 429) {
      throw new Error(
        "Limite gratuito do Gemini atingido. Aguarde um pouco e tente de novo.",
      );
    }
    throw new Error(
      `Falha na API Gemini (${res.status}). ${errText.slice(0, 180)}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      data.error?.message ||
        "A IA não conseguiu ler a nota. Tente outra foto com mais luz.",
    );
  }

  const parsed = extractJson(text);
  const items: NfceItem[] = (parsed.items ?? [])
    .map((raw) => {
      const quantity = Math.max(toNumber(raw.quantity) || 1, 0.001);
      let unitPrice = toNumber(raw.unitPrice);
      let totalPrice = toNumber(raw.totalPrice);
      if (!totalPrice && unitPrice) totalPrice = unitPrice * quantity;
      if (!unitPrice && totalPrice) unitPrice = totalPrice / quantity;
      const name = String(raw.name ?? "").trim();
      if (!name || (!unitPrice && !totalPrice)) return null;
      return {
        name,
        quantity,
        unit: normalizeUnit(raw.unit),
        unitPrice: Number(unitPrice.toFixed(4)),
        totalPrice: Number((totalPrice || unitPrice * quantity).toFixed(2)),
      } satisfies NfceItem;
    })
    .filter((item): item is NfceItem => Boolean(item));

  if (items.length === 0) {
    throw new Error(
      "A IA não identificou produtos na foto. Tire a foto de perto, com boa luz, cobrindo a lista de itens.",
    );
  }

  const purchasedAt =
    parsed.purchasedAt && /^\d{4}-\d{2}-\d{2}/.test(parsed.purchasedAt)
      ? parsed.purchasedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  return {
    storeName: (parsed.storeName || "Mercado (foto)").trim().slice(0, 120),
    storeCnpj: parsed.storeCnpj,
    purchasedAt,
    items,
    totalAmount: toNumber(parsed.totalAmount) || undefined,
    source: "gemini",
  };
}
