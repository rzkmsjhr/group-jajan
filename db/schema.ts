import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const menus = sqliteTable("menus", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  note: text("note"),
  paymentInstructions: text("payment_instructions"),
  adminHash: text("admin_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  menuId: text("menu_id").notNull().references(() => menus.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  position: integer("position").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  menuId: text("menu_id").notNull().references(() => menus.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text("status", { enum: ["unpaid", "paid"] }).notNull().default("unpaid"),
  proofKey: text("proof_key"),
  createdAt: integer("created_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  priceCents: integer("price_cents").notNull(),
});
