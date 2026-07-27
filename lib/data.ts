import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAppStateTableSql, seedAppStateSql } from "@/db/schema";

export type MenuItemRecord = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
};

export type MenuRecord = {
  id: string;
  title: string;
  note: string | null;
  paymentInstructions: string | null;
  paymentImageUrl: string | null;
  showPublicOrders: boolean;
  adminHash: string;
  createdAt: number;
  items: MenuItemRecord[];
};

export type OrderRecord = {
  id: string;
  menuId: string;
  customerName: string;
  sellerNote: string | null;
  totalCents: number;
  status: "unpaid" | "paid";
  proofFile: string | null;
  proofMime: string | null;
  createdAt: number;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
};

type Database = {
  menus: MenuRecord[];
  orders: OrderRecord[];
};

type AppStateRow = {
  data: string;
  version: number;
};

type Bindings = {
  DB: D1Database;
  UPLOADS: R2Bucket;
};

const emptyDatabase: Database = { menus: [], orders: [] };
let schemaReady: Promise<void> | null = null;

function getBindings() {
  return getCloudflareContext().env as unknown as Bindings;
}

async function ensureDatabase(database: D1Database) {
  schemaReady ??= database
    .batch([
      database.prepare(createAppStateTableSql),
      database.prepare(seedAppStateSql),
    ])
    .then(() => undefined)
    .catch((cause) => {
      schemaReady = null;
      throw cause;
    });
  await schemaReady;
}

function parseDatabase(contents: string): Database {
  const database = JSON.parse(contents) as Partial<Database>;
  if (!Array.isArray(database.menus) || !Array.isArray(database.orders)) {
    throw new Error("Stored application data is invalid.");
  }
  return database as Database;
}

export async function readDatabase(): Promise<Database> {
  const database = getBindings().DB;
  await ensureDatabase(database);
  const row = await database
    .prepare("SELECT data, version FROM app_state WHERE id = 1")
    .first<AppStateRow>();
  return row ? parseDatabase(row.data) : structuredClone(emptyDatabase);
}

export async function updateDatabase<T>(
  update: (database: Database) => T | Promise<T>,
): Promise<T> {
  const databaseBinding = getBindings().DB;
  await ensureDatabase(databaseBinding);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await databaseBinding
      .prepare("SELECT data, version FROM app_state WHERE id = 1")
      .first<AppStateRow>();
    const database = row ? parseDatabase(row.data) : structuredClone(emptyDatabase);
    const version = row?.version ?? 0;
    const result = await update(database);
    const saved = await databaseBinding
      .prepare(`
        UPDATE app_state
        SET data = ?, version = ?, updated_at = ?
        WHERE id = 1 AND version = ?
      `)
      .bind(JSON.stringify(database), version + 1, Date.now(), version)
      .run();

    if ((saved.meta.changes ?? 0) === 1) return result;
  }

  throw new Error("The data changed while saving. Please try again.");
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

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function newSecret() {
  return randomBytes(24).toString("base64url");
}

export async function verifyCreator(menuId: string, creatorKey: string | null) {
  if (!creatorKey) return false;
  const database = await readDatabase();
  const menu = database.menus.find((entry) => entry.id === menuId);
  return Boolean(menu && menu.adminHash === hashSecret(creatorKey));
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const allowedImageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const maxImageSizeBytes = 4 * 1024 * 1024;

function safeUploadName(fileName: string) {
  return /^[a-z]+-[0-9a-f-]+\.(png|jpg|webp)$/.test(fileName);
}

export async function saveImage(file: File, category: "menu" | "proof") {
  const extension = allowedImageTypes.get(file.type);
  if (!extension) throw new Error("Use a PNG, JPG, or WebP image.");
  if (file.size > maxImageSizeBytes) throw new Error("Each image must be 4 MB or smaller.");
  const fileName = `${category}-${randomUUID()}.${extension}`;
  await getBindings().UPLOADS.put(fileName, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return {
    fileName,
    mimeType: file.type,
    publicUrl: category === "menu" ? `/api/uploads/${fileName}` : null,
  };
}

export async function readUpload(fileName: string) {
  if (!safeUploadName(fileName)) return null;
  const object = await getBindings().UPLOADS.get(fileName);
  if (!object) return null;
  return {
    contents: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType || null,
  };
}

export async function removeUpload(fileNameOrUrl: string | null) {
  if (!fileNameOrUrl) return;
  const fileName = fileNameOrUrl.split("/").pop();
  if (!fileName || !safeUploadName(fileName)) return;
  await getBindings().UPLOADS.delete(fileName);
}
