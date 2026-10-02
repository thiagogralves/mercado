export type NfceItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  code?: string;
  barcode?: string;
};

export type NfceParseResult = {
  storeName: string;
  storeCnpj?: string;
  purchasedAt: string;
  items: NfceItem[];
  totalAmount?: number;
  nfceKey?: string;
  source: "nfparse" | "html" | "manual" | "ocr";
};

function parseBrNumber(value: string | undefined | null): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function extractAccessKey(url: string): string | undefined {
  const match = url.match(/(\d{44})/);
  return match?.[1];
}

function guessDateFromKey(key?: string): string | undefined {
  if (!key || key.length < 10) return undefined;
  const yy = key.slice(2, 4);
  const mm = key.slice(4, 6);
  const dd = key.slice(6, 8);
  const year = Number(yy) > 70 ? `19${yy}` : `20${yy}`;
  if (!mm || !dd) return undefined;
  return `${year}-${mm}-${dd}`;
}

async function parseWithNfparse(url: string): Promise<NfceParseResult | null> {
  const apiKey = process.env.NFPARSE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://nfparse.com.br/api/parse", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    store?: { name?: string; cnpj?: string };
    emitente?: { nome?: string; cnpj?: string };
    items?: Array<{
      name?: string;
      description?: string;
      qty?: number;
      quantity?: number;
      unit?: string;
      unit_price?: number;
      total?: number;
      gross_total?: number;
      ean?: string;
      code?: string;
    }>;
    itens?: Array<Record<string, unknown>>;
    total?: number;
    chave?: string;
    issued_at?: string;
  };

  const itemsSource = data.items ?? data.itens ?? [];
  const items: NfceItem[] = itemsSource.map((raw) => {
    const item = raw as Record<string, unknown>;
    const name = String(item.name ?? item.description ?? item.tit ?? "Item");
    const quantity = Number(item.qty ?? item.quantity ?? item.qtde ?? 1);
    const unitPrice = Number(
      item.unit_price ?? item.unitPrice ?? item.vl_unit ?? 0,
    );
    const totalPrice = Number(
      item.total ?? item.gross_total ?? item.vl_sem_desconto ?? quantity * unitPrice,
    );
    return {
      name,
      quantity: quantity || 1,
      unit: String(item.unit ?? item.un ?? "un"),
      unitPrice,
      totalPrice,
      barcode: item.ean ? String(item.ean) : undefined,
      code: item.code ? String(item.code) : undefined,
    };
  });

  const storeName =
    data.store?.name ?? data.emitente?.nome ?? "Mercado (NF-e)";
  const nfceKey = data.chave ?? extractAccessKey(url);

  return {
    storeName,
    storeCnpj: data.store?.cnpj ?? data.emitente?.cnpj,
    purchasedAt:
      data.issued_at?.slice(0, 10) ??
      guessDateFromKey(nfceKey) ??
      new Date().toISOString().slice(0, 10),
    items,
    totalAmount: data.total,
    nfceKey,
    source: "nfparse",
  };
}

async function parseFromHtml(url: string): Promise<NfceParseResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MercadoTracker/1.0; +https://vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(
      `Não foi possível abrir a nota (${res.status}). Cole a URL do QR Code ou use importação manual.`,
    );
  }

  const html = await res.text();
  const { load } = await import("cheerio");
  const $ = load(html);

  const storeName =
    $(".txtTopo").first().text().trim() ||
    $("title").text().trim() ||
    $('[class*="emitente"]').first().text().trim() ||
    "Mercado (NF-e)";

  const items: NfceItem[] = [];

  // Common NFC-e HTML table pattern (several state portals)
  $("table tr, .item, tr[id^='Item']").each((_, el) => {
    const cells = $(el)
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    if (cells.length < 3) return;

    const joined = cells.join(" | ");
    // Skip headers
    if (/descri|produto|qtde|valor/i.test(joined) && cells.length <= 4) return;

    const name = cells[0];
    if (!name || name.length < 2) return;

    const qtyMatch = joined.match(/(\d+[.,]?\d*)\s*(UN|KG|L|ML|G|PCT|CX)/i);
    const moneyMatches = joined.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);

    if (!moneyMatches || moneyMatches.length === 0) return;

    const totalPrice = parseBrNumber(moneyMatches[moneyMatches.length - 1]);
    const unitPrice =
      moneyMatches.length > 1
        ? parseBrNumber(moneyMatches[moneyMatches.length - 2])
        : totalPrice;
    const quantity = qtyMatch
      ? parseBrNumber(qtyMatch[1])
      : unitPrice > 0
        ? totalPrice / unitPrice
        : 1;

    items.push({
      name,
      quantity: quantity || 1,
      unit: (qtyMatch?.[2] ?? "un").toLowerCase(),
      unitPrice: unitPrice || totalPrice,
      totalPrice: totalPrice || unitPrice,
    });
  });

  // Fallback: look for lines with R$
  if (items.length === 0) {
    const text = $("body").text().replace(/\s+/g, " ");
    const regex =
      /([A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇa-záéíóúãõç0-9 .%\-\/]{3,60})\s+(\d+[.,]\d+)\s*(UN|KG|L)?\s*x?\s*R?\$?\s*(\d+[.,]\d+)\s*R?\$?\s*(\d+[.,]\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      items.push({
        name: match[1].trim(),
        quantity: parseBrNumber(match[2]),
        unit: (match[3] ?? "un").toLowerCase(),
        unitPrice: parseBrNumber(match[4]),
        totalPrice: parseBrNumber(match[5]),
      });
    }
  }

  const nfceKey = extractAccessKey(url);
  const totalText =
    $("body")
      .text()
      .match(/Valor\s+a\s+pagar\s*R?\$?\s*([\d.,]+)/i)?.[1] ??
    $("body")
      .text()
      .match(/Total\s*R?\$?\s*([\d.,]+)/i)?.[1];

  return {
    storeName,
    purchasedAt:
      guessDateFromKey(nfceKey) ?? new Date().toISOString().slice(0, 10),
    items,
    totalAmount: totalText ? parseBrNumber(totalText) : undefined,
    nfceKey,
    source: "html",
  };
}

export async function parseNfceUrl(url: string): Promise<NfceParseResult> {
  if (!url.startsWith("http")) {
    throw new Error("Informe a URL completa do QR Code da NFC-e.");
  }

  const viaApi = await parseWithNfparse(url);
  if (viaApi && viaApi.items.length > 0) return viaApi;

  const viaHtml = await parseFromHtml(url);
  if (viaHtml.items.length === 0) {
    throw new Error(
      "A nota foi aberta, mas nenhum item foi identificado. Use a importação manual em lote ou configure NFPARSE_API_KEY.",
    );
  }
  return viaHtml;
}

export function normalizeUnit(unit: string): "un" | "kg" | "g" | "L" | "ml" {
  const u = unit.toLowerCase().trim();
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  if (["g", "gr", "grama", "gramas"].includes(u)) return "g";
  if (["l", "lt", "litro", "litros"].includes(u)) return "L";
  if (["ml", "mililitro", "mililitros"].includes(u)) return "ml";
  return "un";
}
