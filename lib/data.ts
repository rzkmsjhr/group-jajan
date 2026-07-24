import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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

const dataDirectory = process.env.TINYTABLE_DATA_DIR
  ? path.resolve(process.env.TINYTABLE_DATA_DIR)
  : path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "tinytable.json");
const uploadDirectory = path.join(dataDirectory, "uploads");
const emptyDatabase: Database = { menus: [], orders: [] };

let writeQueue = Promise.resolve();

async function ensureDataDirectory() {
  await mkdir(uploadDirectory, { recursive: true });
}

export async function readDatabase(): Promise<Database> {
  await ensureDataDirectory();
  try {
    const contents = await readFile(databasePath, "utf8");
    return JSON.parse(contents) as Database;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(emptyDatabase);
    throw cause;
  }
}

export function updateDatabase<T>(update: (database: Database) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await update(database);
    const temporaryPath = `${databasePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8");
    await rename(temporaryPath, databasePath);
    return result;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
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

export async function saveImage(file: File, category: "menu" | "proof") {
  const extension = allowedImageTypes.get(file.type);
  if (!extension) throw new Error("Use a PNG, JPG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The image must be smaller than 5 MB.");
  await ensureDataDirectory();
  const fileName = `${category}-${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadDirectory, fileName), Buffer.from(await file.arrayBuffer()));
  return {
    fileName,
    mimeType: file.type,
    publicUrl: category === "menu" ? `/api/uploads/${fileName}` : null,
  };
}

export async function readUpload(fileName: string) {
  if (path.basename(fileName) !== fileName) return null;
  try {
    return await readFile(path.join(uploadDirectory, fileName));
  } catch {
    return null;
  }
}

export async function removeUpload(fileNameOrUrl: string | null) {
  if (!fileNameOrUrl) return;
  const fileName = fileNameOrUrl.split("/").pop();
  if (!fileName || path.basename(fileName) !== fileName) return;
  try {
    await unlink(path.join(uploadDirectory, fileName));
  } catch {
    // An already-missing orphan is harmless.
  }
}
