import {
  cleanText,
  enforceBodyLimit,
  enforceRateLimit,
  hashSecret,
  jsonError,
  MenuItemRecord,
  readDatabase,
  removeUpload,
  saveImage,
  updateDatabase,
  verifyCreator,
} from "@/lib/data";
import { randomUUID } from "node:crypto";

type ItemPayload = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  priceCents?: unknown;
  imageUrl?: unknown;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const database = await readDatabase();
  const menu = database.menus.find((entry) => entry.id === id);
  if (!menu) return jsonError("Menu not found.", 404);
  const isManage = new URL(request.url).searchParams.get("manage") === "1";
  if (isManage && !(await verifyCreator(id, request.headers.get("x-creator-key")))) {
    return jsonError("This creator link is invalid.", 403);
  }
  const showPublicOrders = menu.showPublicOrders !== false;
  const orders = isManage || showPublicOrders
    ? database.orders
      .filter((order) => order.menuId === id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((order) => ({
        id: isManage ? order.id : hashSecret(order.id).slice(0, 10),
        customerName: order.customerName,
        sellerNote: isManage ? order.sellerNote || null : null,
        totalCents: order.totalCents,
        status: order.status,
        proofKey: isManage ? order.proofFile : (order.proofFile ? (order.proofFile === "OFFLINE_CASH" ? "OFFLINE_CASH" : "HAS_PROOF") : null),
        createdAt: order.createdAt,
        items: order.items,
      }))
    : [];
  const publicMenu = {
    id: menu.id,
    title: menu.title,
    note: menu.note,
    paymentInstructions: menu.paymentInstructions,
    paymentImageUrl: menu.paymentImageUrl || null,
    showPublicOrders,
    createdAt: menu.createdAt,
    items: menu.items,
  };
  return Response.json({ ...publicMenu, orders });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, "menu-update");
    if (rateLimitResponse) return rateLimitResponse;
    const bodyLimitResponse = enforceBodyLimit(request, 25 * 1024 * 1024);
    if (bodyLimitResponse) return bodyLimitResponse;
    const { id } = await context.params;
    if (!(await verifyCreator(id, request.headers.get("x-creator-key")))) {
      return jsonError("Creator access required.", 403);
    }
    const form = await request.formData();
    const payloadValue = form.get("payload");
    if (typeof payloadValue !== "string") return jsonError("Menu details are missing.");
    const body = JSON.parse(payloadValue) as {
      title?: unknown;
      note?: unknown;
      paymentInstructions?: unknown;
      paymentImageUrl?: unknown;
      items?: ItemPayload[];
    };
    const title = cleanText(body.title, 80, true)!;
    const note = cleanText(body.note, 240);
    const paymentInstructions = cleanText(body.paymentInstructions, 500);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return jsonError("Keep between 1 and 30 menu items.");
    }
    const database = await readDatabase();
    const existingMenu = database.menus.find((entry) => entry.id === id);
    if (!existingMenu) return jsonError("Menu not found.", 404);
    const uploadedPaymentImage = form.get("paymentImage");
    let paymentImageUrl = existingMenu.paymentImageUrl || null;
    if (uploadedPaymentImage instanceof File && uploadedPaymentImage.size > 0) {
      const savedPaymentImage = await saveImage(uploadedPaymentImage, "menu");
      await removeUpload(paymentImageUrl);
      paymentImageUrl = savedPaymentImage.publicUrl;
    } else if (body.paymentImageUrl === null) {
      await removeUpload(paymentImageUrl);
      paymentImageUrl = null;
    }
    const nextItems: MenuItemRecord[] = [];
    for (const [position, item] of body.items.entries()) {
      const priceCents = Number(item.priceCents);
      if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 1_000_000_000_00) {
        throw new Error("Each item needs a valid price.");
      }
      const existingId = typeof item.id === "string" ? item.id : null;
      const existingItem = existingMenu.items.find((entry) => entry.id === existingId);
      const uploadedImage = form.get(`itemImage-${position}`);
      let imageUrl = existingItem?.imageUrl || null;
      if (uploadedImage instanceof File && uploadedImage.size > 0) {
        const savedImage = await saveImage(uploadedImage, "menu");
        await removeUpload(imageUrl);
        imageUrl = savedImage.publicUrl;
      } else if (item.imageUrl === null) {
        await removeUpload(imageUrl);
        imageUrl = null;
      }
      nextItems.push({
        id: existingId || randomUUID(),
        name: cleanText(item.name, 80, true)!,
        description: cleanText(item.description, 140),
        priceCents,
        imageUrl,
      });
    }
    const keptIds = new Set(nextItems.map((item) => item.id));
    for (const removedItem of existingMenu.items.filter((item) => !keptIds.has(item.id))) {
      await removeUpload(removedItem.imageUrl);
    }
    await updateDatabase((nextDatabase) => {
      const menu = nextDatabase.menus.find((entry) => entry.id === id);
      if (!menu) throw new Error("Menu not found.");
      menu.title = title;
      menu.note = note;
      menu.paymentInstructions = paymentInstructions;
      menu.paymentImageUrl = paymentImageUrl;
      menu.items = nextItems;
    });
    return Response.json({
      id,
      title,
      note,
      paymentInstructions,
      paymentImageUrl,
      items: nextItems,
    });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not update the menu.");
  }
}
