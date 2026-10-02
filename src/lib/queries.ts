import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  monthlyQuotas,
  productAliases,
  products,
  purchaseItems,
  purchases,
  stores,
} from "@/db/schema";
import { toIsoWeek, toYearMonth } from "@/lib/dates";
import { calcPriceDelta, type PriceDelta } from "@/lib/money";

export async function ensureSchema() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'un',
      category TEXT NOT NULL DEFAULT 'Geral',
      barcode TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS products_name_idx ON products(name)
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS monthly_quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      year_month TEXT NOT NULL,
      target_quantity REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS quota_product_month_idx
    ON monthly_quotas(product_id, year_month)
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
      purchased_at TEXT NOT NULL,
      year_month TEXT NOT NULL,
      iso_week TEXT NOT NULL,
      notes TEXT,
      nfce_key TEXT,
      nfce_url TEXT,
      total_amount REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      raw_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS product_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS product_aliases_alias_idx
    ON product_aliases(alias)
  `);
}

export type QuotaProgress = {
  quotaId: number;
  productId: number;
  productName: string;
  unit: string;
  category: string;
  targetQuantity: number;
  purchasedQuantity: number;
  remainingQuantity: number;
  progressPercent: number;
  spent: number;
};

export async function getQuotaProgress(
  yearMonth: string,
): Promise<QuotaProgress[]> {
  const quotas = await db
    .select({
      quotaId: monthlyQuotas.id,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      category: products.category,
      targetQuantity: monthlyQuotas.targetQuantity,
    })
    .from(monthlyQuotas)
    .innerJoin(products, eq(monthlyQuotas.productId, products.id))
    .where(eq(monthlyQuotas.yearMonth, yearMonth))
    .orderBy(asc(products.name));

  if (quotas.length === 0) return [];

  const purchased = await db
    .select({
      productId: purchaseItems.productId,
      quantity: sql<number>`coalesce(sum(${purchaseItems.quantity}), 0)`,
      spent: sql<number>`coalesce(sum(${purchaseItems.totalPrice}), 0)`,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(eq(purchases.yearMonth, yearMonth))
    .groupBy(purchaseItems.productId);

  const map = new Map(
    purchased.map((p) => [
      p.productId,
      { quantity: Number(p.quantity), spent: Number(p.spent) },
    ]),
  );

  return quotas.map((q) => {
    const bought = map.get(q.productId) ?? { quantity: 0, spent: 0 };
    const remaining = Math.max(0, q.targetQuantity - bought.quantity);
    const progress =
      q.targetQuantity <= 0
        ? 0
        : Math.min(100, (bought.quantity / q.targetQuantity) * 100);

    return {
      ...q,
      purchasedQuantity: bought.quantity,
      remainingQuantity: remaining,
      progressPercent: progress,
      spent: bought.spent,
    };
  });
}

export async function listProducts() {
  return db.select().from(products).orderBy(asc(products.name));
}

export async function listStores() {
  return db.select().from(stores).orderBy(asc(stores.name));
}

export async function listPurchases(yearMonth?: string) {
  const rows = await db
    .select({
      id: purchases.id,
      purchasedAt: purchases.purchasedAt,
      yearMonth: purchases.yearMonth,
      isoWeek: purchases.isoWeek,
      notes: purchases.notes,
      totalAmount: purchases.totalAmount,
      storeId: stores.id,
      storeName: stores.name,
      itemCount: sql<number>`(
        select count(*) from purchase_items pi where pi.purchase_id = ${purchases.id}
      )`,
      itemsTotal: sql<number>`(
        select coalesce(sum(pi.total_price), 0) from purchase_items pi where pi.purchase_id = ${purchases.id}
      )`,
    })
    .from(purchases)
    .innerJoin(stores, eq(purchases.storeId, stores.id))
    .where(yearMonth ? eq(purchases.yearMonth, yearMonth) : undefined)
    .orderBy(desc(purchases.purchasedAt), desc(purchases.id));

  const purchaseIds = rows.map((r) => r.id);
  const itemRows =
    purchaseIds.length === 0
      ? []
      : await db
          .select({
            id: purchaseItems.id,
            purchaseId: purchaseItems.purchaseId,
            quantity: purchaseItems.quantity,
            unitPrice: purchaseItems.unitPrice,
            totalPrice: purchaseItems.totalPrice,
            rawName: purchaseItems.rawName,
            productId: products.id,
            productName: products.name,
            unit: products.unit,
          })
          .from(purchaseItems)
          .innerJoin(products, eq(purchaseItems.productId, products.id))
          .orderBy(asc(products.name));

  const itemsByPurchase = new Map<number, typeof itemRows>();
  for (const item of itemRows) {
    if (!purchaseIds.includes(item.purchaseId)) continue;
    const list = itemsByPurchase.get(item.purchaseId) ?? [];
    list.push(item);
    itemsByPurchase.set(item.purchaseId, list);
  }

  return rows.map((r) => ({
    ...r,
    itemCount: Number(r.itemCount),
    itemsTotal: Number(r.itemsTotal),
    items: itemsByPurchase.get(r.id) ?? [],
  }));
}

export function normalizeAlias(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function upsertProductAlias(aliasRaw: string, productId: number) {
  const alias = normalizeAlias(aliasRaw);
  if (!alias || alias.length < 2) return;

  const [existing] = await db
    .select()
    .from(productAliases)
    .where(eq(productAliases.alias, alias))
    .limit(1);

  if (existing) {
    if (existing.productId !== productId) {
      await db
        .update(productAliases)
        .set({ productId })
        .where(eq(productAliases.id, existing.id));
    }
    return;
  }

  await db.insert(productAliases).values({ alias, productId });
}

export async function resolveProductByAlias(aliasRaw: string) {
  const alias = normalizeAlias(aliasRaw);
  if (!alias) return null;
  const [row] = await db
    .select({
      productId: productAliases.productId,
      productName: products.name,
      unit: products.unit,
    })
    .from(productAliases)
    .innerJoin(products, eq(productAliases.productId, products.id))
    .where(eq(productAliases.alias, alias))
    .limit(1);
  return row ?? null;
}

export async function listProductAliases() {
  return db
    .select({
      alias: productAliases.alias,
      productId: productAliases.productId,
      productName: products.name,
    })
    .from(productAliases)
    .innerJoin(products, eq(productAliases.productId, products.id));
}

export type ProductHistoryRow = {
  productId: number;
  productName: string;
  unit: string;
  entries: Array<{
    storeName: string;
    purchasedAt: string;
    unitPrice: number;
    totalPrice: number;
    quantity: number;
  }>;
};

/** Histórico do mesmo produto em mercados/datas diferentes no mês */
export async function getProductPriceHistory(
  yearMonth: string,
): Promise<ProductHistoryRow[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      storeName: stores.name,
      purchasedAt: purchases.purchasedAt,
      unitPrice: purchaseItems.unitPrice,
      totalPrice: purchaseItems.totalPrice,
      quantity: purchaseItems.quantity,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .innerJoin(stores, eq(purchases.storeId, stores.id))
    .where(eq(purchases.yearMonth, yearMonth))
    .orderBy(asc(products.name), desc(purchases.purchasedAt));

  const map = new Map<number, ProductHistoryRow>();
  for (const row of rows) {
    const entry = map.get(row.productId) ?? {
      productId: row.productId,
      productName: row.productName,
      unit: row.unit,
      entries: [],
    };
    entry.entries.push({
      storeName: row.storeName,
      purchasedAt: row.purchasedAt,
      unitPrice: row.unitPrice,
      totalPrice: row.totalPrice,
      quantity: row.quantity,
    });
    map.set(row.productId, entry);
  }

  return [...map.values()].filter((p) => {
    const stores = new Set(p.entries.map((e) => e.storeName));
    const dates = new Set(p.entries.map((e) => e.purchasedAt));
    return stores.size > 1 || dates.size > 1;
  });
}

export async function getPurchaseDetail(id: number) {
  const [purchase] = await db
    .select({
      id: purchases.id,
      purchasedAt: purchases.purchasedAt,
      yearMonth: purchases.yearMonth,
      isoWeek: purchases.isoWeek,
      notes: purchases.notes,
      nfceUrl: purchases.nfceUrl,
      storeId: stores.id,
      storeName: stores.name,
    })
    .from(purchases)
    .innerJoin(stores, eq(purchases.storeId, stores.id))
    .where(eq(purchases.id, id))
    .limit(1);

  if (!purchase) return null;

  const items = await db
    .select({
      id: purchaseItems.id,
      quantity: purchaseItems.quantity,
      unitPrice: purchaseItems.unitPrice,
      totalPrice: purchaseItems.totalPrice,
      rawName: purchaseItems.rawName,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
    })
    .from(purchaseItems)
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchaseItems.purchaseId, id))
    .orderBy(asc(products.name));

  return { ...purchase, items };
}

export type StorePriceRow = {
  productId: number;
  productName: string;
  unit: string;
  storeId: number;
  storeName: string;
  unitPrice: number;
  purchasedAt: string;
  isoWeek: string;
};

export async function getLatestPricesByStore(
  yearMonth?: string,
): Promise<StorePriceRow[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      storeId: stores.id,
      storeName: stores.name,
      unitPrice: purchaseItems.unitPrice,
      purchasedAt: purchases.purchasedAt,
      isoWeek: purchases.isoWeek,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .innerJoin(stores, eq(purchases.storeId, stores.id))
    .where(yearMonth ? eq(purchases.yearMonth, yearMonth) : undefined)
    .orderBy(desc(purchases.purchasedAt), desc(purchaseItems.id));

  // Keep latest per product+store
  const seen = new Set<string>();
  const latest: StorePriceRow[] = [];
  for (const row of rows) {
    const key = `${row.productId}:${row.storeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }
  return latest;
}

export type WeeklyPriceChange = {
  productId: number;
  productName: string;
  unit: string;
  storeId: number;
  storeName: string;
  currentWeek: string;
  previousWeek: string;
  currentPrice: number;
  previousPrice: number;
  delta: PriceDelta;
};

export async function getWeeklyPriceChanges(
  yearMonth: string,
): Promise<WeeklyPriceChange[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      storeId: stores.id,
      storeName: stores.name,
      unitPrice: purchaseItems.unitPrice,
      isoWeek: purchases.isoWeek,
      purchasedAt: purchases.purchasedAt,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .innerJoin(stores, eq(purchases.storeId, stores.id))
    .where(eq(purchases.yearMonth, yearMonth))
    .orderBy(desc(purchases.purchasedAt), desc(purchaseItems.id));

  // Latest price per product+store+week
  const byWeek = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.productId}:${row.storeId}:${row.isoWeek}`;
    if (!byWeek.has(key)) byWeek.set(key, row);
  }

  const grouped = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of byWeek.values()) {
    const key = `${row.productId}:${row.storeId}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const changes: WeeklyPriceChange[] = [];
  for (const list of grouped.values()) {
    list.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
    if (list.length < 2) continue;
    const current = list[0];
    const previous = list.find((r) => r.isoWeek !== current.isoWeek);
    if (!previous) continue;

    changes.push({
      productId: current.productId,
      productName: current.productName,
      unit: current.unit,
      storeId: current.storeId,
      storeName: current.storeName,
      currentWeek: current.isoWeek,
      previousWeek: previous.isoWeek,
      currentPrice: current.unitPrice,
      previousPrice: previous.unitPrice,
      delta: calcPriceDelta(previous.unitPrice, current.unitPrice),
    });
  }

  return changes.sort((a, b) =>
    Math.abs(b.delta.percent) - Math.abs(a.delta.percent),
  );
}

export async function getMonthlySpend(yearMonth: string) {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${purchaseItems.totalPrice}), 0)`,
      trips: sql<number>`count(distinct ${purchases.id})`,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(eq(purchases.yearMonth, yearMonth));

  return {
    total: Number(row?.total ?? 0),
    trips: Number(row?.trips ?? 0),
  };
}

export async function getWeeklySpend(yearMonth: string) {
  const rows = await db
    .select({
      isoWeek: purchases.isoWeek,
      total: sql<number>`coalesce(sum(${purchaseItems.totalPrice}), 0)`,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .where(eq(purchases.yearMonth, yearMonth))
    .groupBy(purchases.isoWeek)
    .orderBy(asc(purchases.isoWeek));

  return rows.map((r) => ({
    isoWeek: r.isoWeek,
    total: Number(r.total),
  }));
}

export function buildPurchaseMeta(purchasedAt: string) {
  return {
    purchasedAt,
    yearMonth: toYearMonth(purchasedAt),
    isoWeek: toIsoWeek(purchasedAt),
  };
}

export async function findOrCreateProductByName(
  name: string,
  unit: "un" | "kg" | "g" | "L" | "ml" = "un",
  category?: string,
) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.name, normalized))
    .limit(1);
  if (existing) {
    if (category || unit) {
      await db
        .update(products)
        .set({
          unit: unit ?? existing.unit,
          category: category ?? existing.category,
        })
        .where(eq(products.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(products)
    .values({
      name: normalized,
      unit,
      category: category ?? "Geral",
    })
    .returning();
  return created;
}

export async function findOrCreateStoreByName(
  name: string,
  city?: string | null,
  notes?: string | null,
) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const [existing] = await db
    .select()
    .from(stores)
    .where(eq(stores.name, normalized))
    .limit(1);
  if (existing) {
    if (city || notes) {
      await db
        .update(stores)
        .set({
          city: city ?? existing.city,
          notes: notes ?? existing.notes,
        })
        .where(eq(stores.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(stores)
    .values({
      name: normalized,
      city: city ?? null,
      notes: notes ?? null,
    })
    .returning();
  return created;
}
