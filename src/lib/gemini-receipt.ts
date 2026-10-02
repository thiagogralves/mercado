import type { NfceItem, NfceParseResult } from "@/lib/nfce";

type GeminiReceiptJson = {
  storeName?: string;
  storeCnpj?: string;
  purchasedAt?: string;
  totalAmount?: number;
  items?: Array<{
    name?: string;
    suggestedName?: string;
    matchedCatalogName?: string | null;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
  }>;
};

function buildReceiptPrompt(catalogNames: string[]) {
  const catalogBlock =
    catalogNames.length > 0
      ? `\nCATÁLOGO DE ALIMENTOS JÁ CADASTRADOS (prefira casar com um destes):\n${catalogNames
          .slice(0, 400)
          .map((n) => `- ${n}`)
          .join("\n")}\n`
      : "";

  return `Você é um extrator de cupons fiscais / notas de supermercado brasileiros.
Analise a imagem da nota (cupom térmico, DANFE, NFC-e impressa ou foto).

IMPORTANTE SOBRE PREÇOS EM CUPONS BRASILEIROS:
- Em itens pesados (kg), costuma haver UMA coluna com o preço do QUILO (referência) e a ÚLTIMA coluna com o VALOR PAGO do item.
- O campo totalPrice DEVE ser sempre o VALOR PAGO (última coluna / valor do item na nota).
- NÃO use o preço do quilo como totalPrice.
- unitPrice deve ser o preço unitário efetivo: totalPrice ÷ quantity.
- Se houver só uma coluna de preço, use-a como totalPrice.

IMPORTANTE SOBRE NOMES ABREVIADOS:
- Cupons usam abreviações (ex.: "BAT ATA AST", "ARZ TIO JOAO 5KG", "QUEI MUSS KG", "ALFACE CRES").
- "name" = texto como aparece na nota (abreviado).
- "suggestedName" = nome completo/corrigido em português claro (ex.: "Batata asterix", "Arroz Tio João 5kg", "Queijo mussarela", "Alface crespa").
- "matchedCatalogName" = copie EXATAMENTE um nome do catálogo abaixo se for o mesmo alimento (ou o mais próximo). Se não houver parecido, use null.
${catalogBlock}
Extraia TODOS os produtos visíveis nesta foto.

Responda APENAS um JSON válido neste formato:
{
  "storeName": "nome do mercado",
  "storeCnpj": "opcional",
  "purchasedAt": "YYYY-MM-DD ou string vazia",
  "totalAmount": 0,
  "items": [
    {
      "name": "texto da nota",
      "suggestedName": "nome legível completo",
      "matchedCatalogName": "nome do catálogo ou null",
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
- unit deve ser uma de: un, kg, g, L, ml.
- Se a foto for só uma parte da nota, extraia só o que estiver legível nela.`;
}

function extractJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA não retornou um JSON válido.");
    return JSON.parse(match[0]) as T;
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

async function callGeminiJson(promptParts: Array<Record<string, unknown>>) {
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
      contents: [{ role: "user", parts: promptParts }],
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
        "A IA não conseguiu responder. Tente novamente.",
    );
  }

  return text;
}

export async function parseReceiptWithGemini(input: {
  base64: string;
  mimeType: string;
  catalogNames?: string[];
}): Promise<NfceParseResult> {
  const catalogNames = input.catalogNames ?? [];
  const text = await callGeminiJson([
    {
      inline_data: {
        mime_type: input.mimeType || "image/jpeg",
        data: input.base64,
      },
    },
    { text: buildReceiptPrompt(catalogNames) },
  ]);

  const parsed = extractJson<GeminiReceiptJson>(text);
  const catalogSet = new Map(
    catalogNames.map((n) => [n.toLowerCase(), n] as const),
  );

  const items = (parsed.items ?? [])
    .map((raw): NfceItem | null => {
      const quantity = Math.max(toNumber(raw.quantity) || 1, 0.001);
      const reportedUnit = toNumber(raw.unitPrice);
      let totalPrice = toNumber(raw.totalPrice);

      if (!totalPrice && reportedUnit) {
        totalPrice = reportedUnit * quantity;
      } else if (
        totalPrice &&
        reportedUnit &&
        quantity > 0 &&
        Math.abs(reportedUnit - totalPrice * quantity) < 0.05 &&
        reportedUnit > totalPrice
      ) {
        totalPrice = reportedUnit;
      }

      if (!totalPrice && reportedUnit) totalPrice = reportedUnit * quantity;
      const unitPrice = totalPrice / quantity;
      const name = String(raw.name ?? "").trim();
      if (!name || !totalPrice) return null;

      const suggestedName = String(raw.suggestedName ?? "").trim() || name;
      let matchedCatalogName =
        String(raw.matchedCatalogName ?? "").trim() || undefined;
      if (matchedCatalogName) {
        const exact =
          catalogSet.get(matchedCatalogName.toLowerCase()) ??
          catalogNames.find(
            (n) =>
              n.toLowerCase() === matchedCatalogName!.toLowerCase() ||
              n.toLowerCase().includes(matchedCatalogName!.toLowerCase()) ||
              matchedCatalogName!.toLowerCase().includes(n.toLowerCase()),
          );
        matchedCatalogName = exact ?? undefined;
      }

      return {
        name,
        suggestedName,
        matchedCatalogName,
        quantity,
        unit: normalizeUnit(raw.unit),
        unitPrice: Number(unitPrice.toFixed(4)),
        totalPrice: Number(totalPrice.toFixed(2)),
      };
    })
    .filter((item): item is NfceItem => item !== null);

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

export type FoodNameSuggestion = {
  suggestedName: string;
  matchedCatalogName: string | null;
  unit: "un" | "kg" | "g" | "L" | "ml";
  category: string;
  confidence: "high" | "medium" | "low";
};

export async function suggestFoodNameWithGemini(input: {
  rawName: string;
  catalogNames?: string[];
}): Promise<FoodNameSuggestion> {
  const rawName = input.rawName.trim();
  if (rawName.length < 2) {
    throw new Error("Informe um nome para sugerir.");
  }

  const catalogNames = input.catalogNames ?? [];
  const catalogBlock =
    catalogNames.length > 0
      ? `\nCatálogo cadastrado:\n${catalogNames
          .slice(0, 400)
          .map((n) => `- ${n}`)
          .join("\n")}\n`
      : "";

  const text = await callGeminiJson([
    {
      text: `Você normaliza nomes de alimentos de supermercado brasileiro.
O usuário digitou ou leu na nota (muitas vezes abreviado): "${rawName}"
${catalogBlock}
Responda APENAS JSON:
{
  "suggestedName": "nome completo e claro",
  "matchedCatalogName": "copie exatamente um item do catálogo se for o mesmo alimento, senão null",
  "unit": "un|kg|g|L|ml",
  "category": "categoria curta (ex: Hortifruti, Grãos, Laticínios)",
  "confidence": "high|medium|low"
}

Regras:
- Expanda abreviações comuns de cupom (ARZ→Arroz, FEIJ→Feijão, QUEI MUSS→Queijo mussarela, etc.).
- Se casar com o catálogo, matchedCatalogName deve ser idêntico ao cadastrado.
- Não invente marca se não estiver clara.`,
    },
  ]);

  const parsed = extractJson<{
    suggestedName?: string;
    matchedCatalogName?: string | null;
    unit?: string;
    category?: string;
    confidence?: string;
  }>(text);

  let matched =
    parsed.matchedCatalogName && parsed.matchedCatalogName !== "null"
      ? String(parsed.matchedCatalogName).trim()
      : null;
  if (matched) {
    matched =
      catalogNames.find((n) => n.toLowerCase() === matched!.toLowerCase()) ??
      catalogNames.find(
        (n) =>
          n.toLowerCase().includes(matched!.toLowerCase()) ||
          matched!.toLowerCase().includes(n.toLowerCase()),
      ) ??
      null;
  }

  return {
    suggestedName: (parsed.suggestedName || rawName).trim(),
    matchedCatalogName: matched,
    unit: normalizeUnit(parsed.unit) as FoodNameSuggestion["unit"],
    category: (parsed.category || "Geral").trim(),
    confidence:
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
  };
}
