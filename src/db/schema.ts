import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    unit: text("unit", { enum: ["un", "kg", "g", "L", "ml"] })
      .notNull()
      .default("un"),
    category: text("category").notNull().default("Geral"),
    barcode: text("barcode"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("products_name_idx").on(table.name)],
);

export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  city: text("city"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const monthlyQuotas = sqliteTable(
  "monthly_quotas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // YYYY-MM
    targetQuantity: real("target_quantity").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("quota_product_month_idx").on(table.productId, table.yearMonth),
    index("quota_month_idx").on(table.yearMonth),
  ],
);

export const purchases = sqliteTable(
  "purchases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "restrict" }),
    purchasedAt: text("purchased_at").notNull(), // YYYY-MM-DD
    yearMonth: text("year_month").notNull(),
    isoWeek: text("iso_week").notNull(), // YYYY-Www
    notes: text("notes"),
    nfceKey: text("nfce_key"),
    nfceUrl: text("nfce_url"),
    totalAmount: real("total_amount"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("purchases_month_idx").on(table.yearMonth),
    index("purchases_week_idx").on(table.isoWeek),
    index("purchases_store_idx").on(table.storeId),
  ],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: real("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    totalPrice: real("total_price").notNull(),
    rawName: text("raw_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("items_product_idx").on(table.productId),
    index("items_purchase_idx").on(table.purchaseId),
  ],
);

/** Associa nome bruto da nota fiscal a um alimento cadastrado */
export const productAliases = sqliteTable(
  "product_aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    alias: text("alias").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("product_aliases_alias_idx").on(table.alias),
    index("product_aliases_product_idx").on(table.productId),
  ],
);

export const productsRelations = relations(products, ({ many }) => ({
  quotas: many(monthlyQuotas),
  items: many(purchaseItems),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  purchases: many(purchases),
}));

export const monthlyQuotasRelations = relations(monthlyQuotas, ({ one }) => ({
  product: one(products, {
    fields: [monthlyQuotas.productId],
    references: [products.id],
  }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  store: one(stores, {
    fields: [purchases.storeId],
    references: [stores.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type MonthlyQuota = typeof monthlyQuotas.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type ProductAlias = typeof productAliases.$inferSelect;
