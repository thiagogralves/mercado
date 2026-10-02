import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { CATALOG_PRODUCTS, RIO_STORES } from "../src/lib/catalog-seed.ts";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const db = drizzle(client, { schema });

async function ensureSchema() {
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
}

async function main() {
  await ensureSchema();

  let productsCreated = 0;
  let storesCreated = 0;

  for (const p of CATALOG_PRODUCTS) {
    const [existing] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.name, p.name))
      .limit(1);

    if (existing) {
      await db
        .update(schema.products)
        .set({ unit: p.unit, category: p.category })
        .where(eq(schema.products.id, existing.id));
    } else {
      await db.insert(schema.products).values({
        name: p.name,
        unit: p.unit,
        category: p.category,
      });
      productsCreated += 1;
    }
  }

  for (const s of RIO_STORES) {
    const [existing] = await db
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.name, s.name))
      .limit(1);

    if (existing) {
      await db
        .update(schema.stores)
        .set({ city: s.city, notes: s.notes ?? null })
        .where(eq(schema.stores.id, existing.id));
    } else {
      await db.insert(schema.stores).values({
        name: s.name,
        city: s.city,
        notes: s.notes ?? null,
      });
      storesCreated += 1;
    }
  }

  const productCount = await db.select({ c: sql<number>`count(*)` }).from(schema.products);
  const storeCount = await db.select({ c: sql<number>`count(*)` }).from(schema.stores);

  console.log(
    JSON.stringify(
      {
        productsCreated,
        storesCreated,
        productsTotal: Number(productCount[0]?.c ?? 0),
        storesTotal: Number(storeCount[0]?.c ?? 0),
        catalogSize: CATALOG_PRODUCTS.length,
        rioStoresSize: RIO_STORES.length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
