import type { NfceItem, NfceParseResult } from "@/lib/nfce";

function parseBrNumber(value: string): number {
  const cleaned = value
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extrai itens de texto OCR de cupom/NFC-e impresso.
 * Aceita padrões comuns: NOME QTD UN x PRECO TOTAL ou NOME ... R$ X,XX
 */
export function parseReceiptOcrText(text: string): NfceParseResult {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "I")
    .replace(/\u00a0/g, " ");

  const lines = normalized
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2);

  const items: NfceItem[] = [];
  const moneyRe = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g;

  for (const line of lines) {
    if (/^(cnpj|cpf|total|subtotal|desconto|tribut|pag|visa|master|pix|troco|qtd\s*total)/i.test(line)) {
      continue;
    }
    if (/^\d{44}$/.test(line.replace(/\s/g, ""))) continue;

    const qtyMatch = line.match(
      /(\d+[.,]?\d*)\s*(UN|KG|G|L|ML|PCT|CX|BD)\b/i,
    );
    const moneys = [...line.matchAll(moneyRe)].map((m) => m[1]);
    if (moneys.length === 0) continue;

    const totalPrice = parseBrNumber(moneys[moneys.length - 1]);
    const unitPrice =
      moneys.length > 1 ? parseBrNumber(moneys[moneys.length - 2]) : totalPrice;

    let name = line
      .replace(moneyRe, " ")
      .replace(/\d+[.,]?\d*\s*(UN|KG|G|L|ML|PCT|CX|BD)\b/gi, " ")
      .replace(/\bx\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Remove leading product codes
    name = name.replace(/^\d{3,}\s+/, "").trim();
    if (name.length < 3 || name.length > 80) continue;
    if (/^(item|desc|valor|qtde|codigo)/i.test(name)) continue;

    const quantity = qtyMatch
      ? parseBrNumber(qtyMatch[1])
      : unitPrice > 0
        ? Number((totalPrice / unitPrice).toFixed(3))
        : 1;

    items.push({
      name,
      quantity: quantity || 1,
      unit: (qtyMatch?.[2] ?? "un").toLowerCase(),
      unitPrice: unitPrice || totalPrice,
      totalPrice: totalPrice || unitPrice,
    });
  }

  // Fallback: multiline pattern "NAME" then numbers on same/next lines
  if (items.length === 0) {
    const blob = lines.join("\n");
    const regex =
      /([A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇa-záéíóúãõç0-9 .%\-\/]{2,50})\s+(\d+[.,]\d+)\s*(UN|KG|L|ML|G)?\s*[xX]?\s*R?\$?\s*(\d+[.,]\d+)\s*R?\$?\s*(\d+[.,]\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(blob)) !== null) {
      items.push({
        name: match[1].trim(),
        quantity: parseBrNumber(match[2]),
        unit: (match[3] ?? "un").toLowerCase(),
        unitPrice: parseBrNumber(match[4]),
        totalPrice: parseBrNumber(match[5]),
      });
    }
  }

  const storeGuess =
    lines.find((l) =>
      /(mercado|super|atacad|carrefour|assai|extra|pao|pão|wallmart|walmart|sams|sam'?s)/i.test(
        l,
      ),
    ) ?? "Mercado (foto)";

  const totalMatch = normalized.match(
    /(?:valor\s+a\s+pagar|total(?:\s+da\s+nota)?)\s*:?\s*R?\$?\s*([\d.,]+)/i,
  );

  return {
    storeName: storeGuess.slice(0, 80),
    purchasedAt: new Date().toISOString().slice(0, 10),
    items,
    totalAmount: totalMatch ? parseBrNumber(totalMatch[1]) : undefined,
    source: "ocr",
  };
}
