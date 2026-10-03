"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  monthlyQuotas,
  productAliases,
  products,
  purchaseItems,
  purchases,
  stores,
} from "@/db/schema";
import { normalizeUnit, parseNfceUrl } from "@/lib/nfce";
import { parseReceiptWithGemini, suggestFoodNameWithGemini } from "@/lib/gemini-receipt";
import {
  buildPurchaseMeta,
  ensureSchema,
  findOrCreateProductByName,
  findOrCreateStoreByName,
  listProducts,
  upsertProductAlias,
} from "@/lib/queries";
import { parseDecimal } from "@/lib/money";
import { toDateInput, toYearMonth } from "@/lib/dates";

async function ready() {
  await ensureSchema();
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/alimentos");
  revalidatePath("/mercados");
  revalidatePath("/cotas");
  revalidatePath("/compras");
  revalidatePath("/comparativos");
  revalidatePath("/nota-fiscal");
}

export async function createProduct(formData: FormData) {
  await ready();
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const unit = String(formData.get("unit") ?? "un") as "un" | "kg" | "g" | "L" | "ml";
  const category = String(formData.get("category") ?? "Geral").trim() || "Geral";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;

  if (!name) throw new Error("Nome do alimento é obrigatório.");

  const [duplicate] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name})`)
    .limit(1);
  if (duplicate) {
    throw new Error(
      `Já existe um alimento com esse nome: “${duplicate.name}”. Use a edição nele ou escolha outro nome.`,
    );
  }

  try {
    const [created] = await db
      .insert(products)
      .values({ name, unit, category, barcode })
      .returning();
    revalidateAll();
    return created;
  } catch {
    throw new Error(
      "Não foi possível salvar o alimento. Verifique se o nome já existe.",
    );
  }
}

export async function updateProduct(formData: FormData) {
  await ready();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const unit = String(formData.get("unit") ?? "un") as "un" | "kg" | "g" | "L" | "ml";
  const category = String(formData.get("category") ?? "Geral").trim() || "Geral";
  const barcode = String(formData.get("barcode") ?? "").trim() || null;

  if (!id || !name) throw new Error("Informe o alimento e o nome.");

  const [duplicate] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`lower(${products.name}) = lower(${name})`)
    .limit(1);
  if (duplicate && duplicate.id !== id) {
    throw new Error(
      `Já existe um alimento com esse nome: “${duplicate.name}”. Apague o duplicado ou use outro nome.`,
    );
  }

  try {
    await db
      .update(products)
      .set({ name, unit, category, barcode })
      .where(eq(products.id, id));
  } catch {
    throw new Error("Não foi possível atualizar o alimento.");
  }
  revalidateAll();
}

export async function renameCategory(formData: FormData) {
  await ready();
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!from || !to) throw new Error("Informe a categoria atual e o novo nome.");
  if (from === to) return;

  await db
    .update(products)
    .set({ category: to })
    .where(eq(products.category, from));
  revalidateAll();
}

export async function deleteProduct(id: number) {
  await ready();
  if (!id) throw new Error("Alimento inválido.");

  // purchase_items tem ON DELETE RESTRICT — remove vínculos antes do alimento
  await db.delete(purchaseItems).where(eq(purchaseItems.productId, id));
  await db.delete(monthlyQuotas).where(eq(monthlyQuotas.productId, id));
  await db.delete(productAliases).where(eq(productAliases.productId, id));
  await db.delete(products).where(eq(products.id, id));
  revalidateAll();
}

export async function createStore(formData: FormData) {
  await ready();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!name) throw new Error("Nome do mercado é obrigatório.");
  await db.insert(stores).values({ name, city, notes });
  revalidateAll();
}

export async function deleteStore(id: number) {
  await ready();
  await db.delete(stores).where(eq(stores.id, id));
  revalidateAll();
}

export async function upsertQuota(formData: FormData) {
  await ready();
  const productId = Number(formData.get("productId"));
  const yearMonth = String(formData.get("yearMonth"));
  const targetQuantity = parseDecimal(String(formData.get("targetQuantity") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!productId || !yearMonth || targetQuantity <= 0) {
    throw new Error("Preencha alimento, mês e quantidade da cota.");
  }

  const [existing] = await db
    .select()
    .from(monthlyQuotas)
    .where(
      and(
        eq(monthlyQuotas.productId, productId),
        eq(monthlyQuotas.yearMonth, yearMonth),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(monthlyQuotas)
      .set({ targetQuantity, notes })
      .where(eq(monthlyQuotas.id, existing.id));
  } else {
    await db.insert(monthlyQuotas).values({
      productId,
      yearMonth,
      targetQuantity,
      notes,
    });
  }

  revalidateAll();
}

export async function deleteQuota(id: number) {
  await ready();
  await db.delete(monthlyQuotas).where(eq(monthlyQuotas.id, id));
  revalidateAll();
}

export async function copyQuotasFromPreviousMonth(
  fromMonth: string,
  toMonth: string,
) {
  await ready();
  const previous = await db
    .select()
    .from(monthlyQuotas)
    .where(eq(monthlyQuotas.yearMonth, fromMonth));

  for (const q of previous) {
    const [existing] = await db
      .select()
      .from(monthlyQuotas)
      .where(
        and(
          eq(monthlyQuotas.productId, q.productId),
          eq(monthlyQuotas.yearMonth, toMonth),
        ),
      )
      .limit(1);

    if (!existing) {
      await db.insert(monthlyQuotas).values({
        productId: q.productId,
        yearMonth: toMonth,
        targetQuantity: q.targetQuantity,
        notes: q.notes,
      });
    }
  }

  revalidateAll();
}

export type PurchaseItemInput = {
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  rawName?: string;
};

export async function createPurchase(input: {
  storeId: number;
  purchasedAt?: string;
  notes?: string;
  nfceUrl?: string;
  nfceKey?: string;
  items: PurchaseItemInput[];
}) {
  await ready();
  const purchasedAt = input.purchasedAt?.trim() || toDateInput();
  if (!input.storeId || input.items.length === 0) {
    throw new Error("Mercado e ao menos um item são obrigatórios.");
  }

  const meta = buildPurchaseMeta(purchasedAt);
  const totalAmount = input.items.reduce(
    (sum, item) =>
      sum + (item.totalPrice ?? item.quantity * item.unitPrice),
    0,
  );

  const [purchase] = await db
    .insert(purchases)
    .values({
      storeId: input.storeId,
      ...meta,
      notes: input.notes ?? null,
      nfceUrl: input.nfceUrl ?? null,
      nfceKey: input.nfceKey ?? null,
      totalAmount,
    })
    .returning();

  await db.insert(purchaseItems).values(
    input.items.map((item) => {
      const totalPrice = item.totalPrice ?? item.quantity * item.unitPrice;
      const unitPrice =
        item.quantity > 0 ? totalPrice / item.quantity : item.unitPrice;
      return {
        purchaseId: purchase.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        rawName: item.rawName ?? null,
      };
    }),
  );

  revalidateAll();
  return purchase.id;
}

export async function createPurchaseFromForm(formData: FormData) {
  const storeId = Number(formData.get("storeId"));
  const purchasedAt = String(formData.get("purchasedAt"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const productId = Number(formData.get("productId"));
  const quantity = parseDecimal(String(formData.get("quantity") ?? "0"));
  const unitPrice = parseDecimal(String(formData.get("unitPrice") ?? "0"));

  await createPurchase({
    storeId,
    purchasedAt,
    notes,
    items: [{ productId, quantity, unitPrice }],
  });
}

export async function createBatchPurchase(formData: FormData) {
  const storeId = Number(formData.get("storeId"));
  const purchasedAt = String(formData.get("purchasedAt"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const raw = String(formData.get("batch") ?? "");

  // Format: nome | quantidade | preço unitário  (one per line)
  const items: PurchaseItemInput[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length < 3) {
      throw new Error(
        `Linha inválida: "${trimmed}". Use: nome | quantidade | preço unitário`,
      );
    }
    const [name, qtyStr, priceStr] = parts;
    const product = await findOrCreateProductByName(name);
    items.push({
      productId: product.id,
      quantity: parseDecimal(qtyStr),
      unitPrice: parseDecimal(priceStr),
      rawName: name,
    });
  }

  await createPurchase({ storeId, purchasedAt, notes, items });
}

export async function deletePurchase(id: number) {
  await ready();
  await db.delete(purchases).where(eq(purchases.id, id));
  revalidateAll();
}

export async function updatePurchase(input: {
  id: number;
  storeId: number;
  purchasedAt?: string;
}) {
  await ready();
  if (!input.id || !input.storeId) {
    throw new Error("Informe a compra e o mercado.");
  }

  const patch: {
    storeId: number;
    purchasedAt?: string;
    yearMonth?: string;
    isoWeek?: string;
  } = { storeId: input.storeId };

  if (input.purchasedAt?.trim()) {
    Object.assign(patch, buildPurchaseMeta(input.purchasedAt.trim()));
  }

  await db.update(purchases).set(patch).where(eq(purchases.id, input.id));
  revalidateAll();
}

export async function updatePurchaseItem(input: {
  id: number;
  productId: number;
  quantity: number;
  totalPrice: number;
}) {
  await ready();
  const quantity = Number(input.quantity);
  const totalPrice = Number(input.totalPrice);
  if (!input.id || !input.productId || !(quantity > 0) || !(totalPrice >= 0)) {
    throw new Error("Preencha alimento, quantidade e valor pago.");
  }

  const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

  const [item] = await db
    .select({ purchaseId: purchaseItems.purchaseId })
    .from(purchaseItems)
    .where(eq(purchaseItems.id, input.id))
    .limit(1);
  if (!item) throw new Error("Item não encontrado.");

  await db
    .update(purchaseItems)
    .set({
      productId: input.productId,
      quantity,
      unitPrice,
      totalPrice,
    })
    .where(eq(purchaseItems.id, input.id));

  const [sumRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${purchaseItems.totalPrice}), 0)`,
    })
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, item.purchaseId));

  await db
    .update(purchases)
    .set({ totalAmount: Number(sumRow?.total ?? 0) })
    .where(eq(purchases.id, item.purchaseId));

  revalidateAll();
}

export async function deletePurchaseItem(id: number) {
  await ready();
  const [item] = await db
    .select({ purchaseId: purchaseItems.purchaseId })
    .from(purchaseItems)
    .where(eq(purchaseItems.id, id))
    .limit(1);
  if (!item) return;

  await db.delete(purchaseItems).where(eq(purchaseItems.id, id));

  const [sumRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${purchaseItems.totalPrice}), 0)`,
    })
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, item.purchaseId));

  await db
    .update(purchases)
    .set({ totalAmount: Number(sumRow?.total ?? 0) })
    .where(eq(purchases.id, item.purchaseId));

  revalidateAll();
}

export async function previewNfce(url: string) {
  await ready();
  return parseNfceUrl(url);
}

export async function readReceiptWithAi(input: {
  base64: string;
  mimeType: string;
}) {
  await ready();
  if (!input.base64 || input.base64.length < 100) {
    throw new Error("Imagem inválida.");
  }
  if (input.base64.length > 8_000_000) {
    throw new Error("Imagem muito grande. Tire uma foto mais leve ou aproxime o cupom.");
  }

  const catalog = await listProducts();
  return parseReceiptWithGemini({
    base64: input.base64,
    mimeType: input.mimeType || "image/jpeg",
    catalogNames: catalog.map((p) => p.name),
  });
}

export async function suggestFoodName(rawName: string) {
  await ready();
  const catalog = await listProducts();
  return suggestFoodNameWithGemini({
    rawName,
    catalogNames: catalog.map((p) => p.name),
  });
}

export async function importMappedPurchase(input: {
  storeId?: number;
  storeName?: string;
  purchasedAt?: string;
  notes?: string;
  nfceUrl?: string;
  nfceKey?: string;
  mappings: Array<{
    rawName: string;
    productId?: number;
    createName?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    totalPrice?: number;
    include: boolean;
  }>;
}) {
  await ready();

  let storeId = input.storeId;
  if (!storeId) {
    const store = await findOrCreateStoreByName(
      input.storeName?.trim() || "Mercado",
    );
    storeId = store.id;
  }

  const items: PurchaseItemInput[] = [];
  for (const map of input.mappings) {
    if (!map.include) continue;
    let productId = map.productId;
    if (!productId && map.createName) {
      const product = await findOrCreateProductByName(
        map.createName,
        normalizeUnit(map.unit ?? "un"),
      );
      productId = product.id;
    }
    if (!productId) continue;

    // Associa o nome lido na NF ao alimento escolhido para futuros matches
    if (map.rawName) {
      await upsertProductAlias(map.rawName, productId);
    }
    if (map.createName && map.createName !== map.rawName) {
      await upsertProductAlias(map.createName, productId);
    }

    const totalPrice =
      map.totalPrice ?? map.quantity * map.unitPrice;
    items.push({
      productId,
      quantity: map.quantity,
      unitPrice: map.quantity > 0 ? totalPrice / map.quantity : map.unitPrice,
      totalPrice,
      rawName: map.rawName,
    });
  }

  if (items.length === 0) {
    throw new Error("Nenhum item selecionado para importar.");
  }

  return createPurchase({
    storeId,
    purchasedAt: input.purchasedAt || toDateInput(),
    notes: input.notes,
    nfceUrl: input.nfceUrl,
    nfceKey: input.nfceKey,
    items,
  });
}

export async function addProductToMonthlyQuota(input: {
  productId: number;
  targetQuantity: number;
  yearMonth?: string;
}) {
  await ready();
  const yearMonth = input.yearMonth || toYearMonth();
  const targetQuantity = Number(input.targetQuantity);
  if (!input.productId || !(targetQuantity > 0)) {
    throw new Error("Informe o alimento e a quantidade da cota mensal.");
  }

  const [existing] = await db
    .select()
    .from(monthlyQuotas)
    .where(
      and(
        eq(monthlyQuotas.productId, input.productId),
        eq(monthlyQuotas.yearMonth, yearMonth),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(monthlyQuotas)
      .set({ targetQuantity })
      .where(eq(monthlyQuotas.id, existing.id));
  } else {
    await db.insert(monthlyQuotas).values({
      productId: input.productId,
      yearMonth,
      targetQuantity,
    });
  }

  revalidateAll();
}

export async function importNfce(input: {
  url: string;
  storeId?: number;
  purchasedAt?: string;
  mappings: Array<{
    rawName: string;
    productId?: number;
    createName?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    include: boolean;
  }>;
}) {
  await ready();
  const parsed = await parseNfceUrl(input.url);

  return importMappedPurchase({
    storeId: input.storeId,
    storeName: parsed.storeName,
    purchasedAt: input.purchasedAt ?? parsed.purchasedAt,
    notes: `Importado da NFC-e${parsed.nfceKey ? ` (${parsed.nfceKey})` : ""}`,
    nfceUrl: input.url,
    nfceKey: parsed.nfceKey,
    mappings: input.mappings,
  });
}

export async function seedDemoData() {
  await ready();

  const { CATALOG_PRODUCTS, RIO_STORES } = await import("@/lib/catalog-seed");

  for (const p of CATALOG_PRODUCTS) {
    await findOrCreateProductByName(p.name, p.unit, p.category);
  }

  for (const s of RIO_STORES) {
    await findOrCreateStoreByName(s.name, s.city, s.notes ?? null);
  }

  revalidateAll();
}
