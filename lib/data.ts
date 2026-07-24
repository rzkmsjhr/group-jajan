import { env } from "cloudflare:workers";

type AppEnv = {
  DB: D1Database;
  PROOFS: R2Bucket;
};

export function bindings() {
  return env as unknown as AppEnv;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  if (!schemaReady) {
    const { DB } = bindings();
    schemaReady = DB.batch([
      DB.prepare(`CREATE TABLE IF NOT EXISTS menus (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        note TEXT,
        payment_instructions TEXT,
        admin_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        menu_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price_cents INTEGER NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        menu_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        total_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'unpaid',
        proof_key TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price_cents INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`),
      DB.prepare("CREATE INDEX IF NOT EXISTS menu_items_menu_idx ON menu_items(menu_id)"),
      DB.prepare("CREATE INDEX IF NOT EXISTS orders_menu_idx ON orders(menu_id)"),
      DB.prepare("CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id)"),
    ]).then(() => undefined);
  }
  return schemaReady;
}

export function cleanText(value: unknown, max: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new Error("A required field is missing.");
    return null;
  }
  const text = value.trim().slice(0, max);
  if (required && !text) throw new Error("A required field is missing.");
  return text || null;
}

export async function hashSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function verifyCreator(menuId: string, creatorKey: string | null) {
  if (!creatorKey) return false;
  await ensureSchema();
  const result = await bindings().DB.prepare("SELECT admin_hash AS adminHash FROM menus WHERE id = ?")
    .bind(menuId)
    .first<{ adminHash: string }>();
  return Boolean(result && result.adminHash === (await hashSecret(creatorKey)));
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
