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
    /** Preço unitário de referência (ex.: R$/kg) — NÃO usar como valor pago */
    unitPrice?: number;
    /** Valor efetivamente pago pelo item (última coluna do cupom) */
    totalPrice?: number;
  }>;
};

const PROMPT = `Você é um extrator de cupons fiscais / notas de supermercado brasileiros.
Analise a imagem da nota (cupom térmico, DANFE, NFC-e impressa ou foto).

IMPORTANTE SOBRE PREÇOS EM CUPONS BRASILEIROS:
- Em itens pesados (kg), costuma haver UMA coluna com o preço do QUILO (referência) e a ÚLTIMA coluna com o VALOR PAGO do item.
- O campo totalPrice DEVE ser sempre o VALOR PAGO (última coluna / valor do item na nota).
- NÃO use o preço do quilo como totalPrice.
- unitPrice deve ser o preço unitário efetivo: totalPrice ÷ quantity.
- Se houver só uma coluna de preço, use-a como totalPrice.

Extraia TODOS os produtos visíveis nesta foto.

Responda APENAS um JSON válido neste formato:
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
- Use ponto como decimal (ex: 12.90).
- Ignore taxas, pagamento, troco, CPF e textos legais.
- Normalize nomes sem inventar produtos.
- unit deve ser uma de: un, kg, g, L, ml.
- Se a foto for só uma parte da nota, extraia só o que estiver legível nela.`;

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

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
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
      const reportedUnit = toNumber(raw.unitPrice);
      let totalPrice = toNumber(raw.totalPrice);

      // Se a IA trocou as colunas (preço/kg no total), corrige:
      // quando total ≈ unit * qty, ok; se total parece preço/kg e unit maior, inverte.
      if (!totalPrice && reportedUnit) {
        totalPrice = reportedUnit * quantity;
      } else if (
        totalPrice &&
        reportedUnit &&
        quantity > 0 &&
        // totalPrice parece preço unitário e reportedUnit parece total pago
        Math.abs(reportedUnit - totalPrice * quantity) < 0.05 &&
        reportedUnit > totalPrice
      ) {
        totalPrice = reportedUnit;
      }

      // Sempre prioriza valor pago e deriva unitário efetivo
      if (!totalPrice && reportedUnit) totalPrice = reportedUnit * quantity;
      const unitPrice = totalPrice / quantity;
      const name = String(raw.name ?? "").trim();
      if (!name || !totalPrice) return null;

      return {
        name,
        quantity,
        unit: normalizeUnit(raw.unit),
        unitPrice: Number(unitPrice.toFixed(4)),
        totalPrice: Number(totalPrice.toFixed(2)),
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
