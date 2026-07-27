import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, R2Bucket, RateLimit } from "@cloudflare/workers-types";
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

type RateLimitBucket =
  | "menu-create"
  | "menu-update"
  | "order-create"
  | "order-cancel"
  | "proof-upload"
  | "status-update"
  | "visibility-update";

const rateLimitBindings: Record<RateLimitBucket, string> = {
  "menu-create": "MENU_CREATE_LIMITER",
  "menu-update": "MENU_UPDATE_LIMITER",
  "order-create": "ORDER_CREATE_LIMITER",
  "order-cancel": "ORDER_CANCEL_LIMITER",
  "proof-upload": "PROOF_UPLOAD_LIMITER",
  "status-update": "STATUS_UPDATE_LIMITER",
  "visibility-update": "VISIBILITY_UPDATE_LIMITER",
};

const localRateLimitPolicies: Record<RateLimitBucket, { limit: number; periodMs: number }> = {
  "menu-create": { limit: 10, periodMs: 60_000 },
  "menu-update": { limit: 20, periodMs: 60_000 },
  "order-create": { limit: 2, periodMs: 60_000 },
  "order-cancel": { limit: 5, periodMs: 60_000 },
  "proof-upload": { limit: 5, periodMs: 60_000 },
  "status-update": { limit: 30, periodMs: 60_000 },
  "visibility-update": { limit: 20, periodMs: 60_000 },
};
const localRateLimitState = new Map<string, { count: number; resetAt: number }>();

const emptyDatabase: Database = { menus: [], orders: [] };
let schemaReady: Promise<void> | null = null;

function getBindings() {
  return getCloudflareContext().env as unknown as Bindings;
}

function clientAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip");
  if (cloudflareAddress) return cloudflareAddress.slice(0, 128);
  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  return (forwardedAddress || "local").slice(0, 128);
}

function tooManyRequests() {
  return Response.json(
    { error: "Too many requests. Please try again in a minute." },
    { status: 429, headers: { "cache-control": "no-store", "retry-after": "60" } },
  );
}

export async function enforceRateLimit(request: Request, bucket: RateLimitBucket) {
  const key = `${bucket}:${clientAddress(request)}`;
  let binding: RateLimit | undefined;
  try {
    const bindings = getBindings() as unknown as Record<string, RateLimit | undefined>;
    binding = bindings[rateLimitBindings[bucket]];
  } catch {
    // Next.js local development does not provide Cloudflare bindings.
  }
  if (binding) {
    try {
      const outcome = await binding.limit({ key });
      return outcome.success ? null : tooManyRequests();
    } catch {
      // Fall back to the local limiter if the binding is unavailable.
    }
  }

  const policy = localRateLimitPolicies[bucket];
  const now = Date.now();
  const current = localRateLimitState.get(key);
  if (!current || current.resetAt <= now) {
    localRateLimitState.set(key, { count: 1, resetAt: now + policy.periodMs });
    return null;
  }
  if (current.count >= policy.limit) return tooManyRequests();
  current.count += 1;
  return null;
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

export function enforceBodyLimit(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return jsonError("This request is too large.", 413);
  }
  return null;
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
