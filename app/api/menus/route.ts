import {
  cleanText,
  enforceBodyLimit,
  enforceRateLimit,
  hashSecret,
  jsonError,
  MenuItemRecord,
  newSecret,
  saveImage,
  updateDatabase,
} from "@/lib/data";
import { randomUUID } from "node:crypto";

type ItemPayload = {
  name?: unknown;
  description?: unknown;
  priceCents?: unknown;
};

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, "menu-create");
    if (rateLimitResponse) return rateLimitResponse;
    const bodyLimitResponse = enforceBodyLimit(request, 25 * 1024 * 1024);
    if (bodyLimitResponse) return bodyLimitResponse;
    const form = await request.formData();
    const payloadValue = form.get("payload");
    if (typeof payloadValue !== "string") return jsonError("Menu details are missing.");
    const body = JSON.parse(payloadValue) as {
      title?: unknown;
      note?: unknown;
      paymentInstructions?: unknown;
      items?: ItemPayload[];
    };
    const title = cleanText(body.title, 80, true)!;
    const note = cleanText(body.note, 240);
    const paymentInstructions = cleanText(body.paymentInstructions, 500);
    const paymentImage = form.get("paymentImage");
    const savedPaymentImage = paymentImage instanceof File && paymentImage.size > 0
      ? await saveImage(paymentImage, "menu")
      : null;
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return jsonError("Add between 1 and 30 menu items.");
    }
    const items: MenuItemRecord[] = [];
    for (const [position, item] of body.items.entries()) {
      const priceCents = Number(item.priceCents);
      if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 1_000_000_000_00) {
        throw new Error("Each item needs a valid price.");
      }
      const image = form.get(`itemImage-${position}`);
      const savedImage = image instanceof File && image.size > 0 ? await saveImage(image, "menu") : null;
      items.push({
        id: randomUUID(),
        name: cleanText(item.name, 80, true)!,
        description: cleanText(item.description, 140),
        priceCents,
        imageUrl: savedImage?.publicUrl || null,
      });
    }
    const id = randomUUID();
    const creatorKey = newSecret();
    const menu = {
      id,
      title,
      note,
      paymentInstructions,
      paymentImageUrl: savedPaymentImage?.publicUrl || null,
      showPublicOrders: true,
      adminHash: hashSecret(creatorKey),
      createdAt: Date.now(),
      items,
    };
    await updateDatabase((database) => {
      database.menus.push(menu);
    });
    return Response.json({
      creatorKey,
      menu: {
        id,
        title,
        note,
        paymentInstructions,
        paymentImageUrl: savedPaymentImage?.publicUrl || null,
        showPublicOrders: true,
        items,
        orders: [],
      },
    }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not create the menu.");
  }
}
