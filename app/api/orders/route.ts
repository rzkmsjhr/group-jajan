import { cleanText, enforceBodyLimit, enforceRateLimit, jsonError, readDatabase, updateDatabase } from "@/lib/data";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, "order-create");
    if (rateLimitResponse) return rateLimitResponse;
    const bodyLimitResponse = enforceBodyLimit(request, 128 * 1024);
    if (bodyLimitResponse) return bodyLimitResponse;
    const body = await request.json() as {
      menuId?: unknown;
      customerName?: unknown;
      sellerNote?: unknown;
      selections?: Array<{ itemId?: unknown; quantity?: unknown }>;
    };
    const menuId = cleanText(body.menuId, 80, true)!;
    const customerName = cleanText(body.customerName, 80, true)!;
    const sellerNote = cleanText(body.sellerNote, 300);
    if (!Array.isArray(body.selections) || body.selections.length < 1 || body.selections.length > 30) {
      return jsonError("Choose at least one item.");
    }
    const database = await readDatabase();
    const menu = database.menus.find((entry) => entry.id === menuId);
    if (!menu) return jsonError("Menu not found.", 404);
    const selections = body.selections.map((selection) => {
      const itemId = cleanText(selection.itemId, 80, true)!;
      const quantity = Number(selection.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Invalid quantity.");
      const item = menu.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error("One selected item is unavailable.");
      return { name: item.name, priceCents: item.priceCents, quantity };
    });
    const totalCents = selections.reduce((total, item) => total + item.priceCents * item.quantity, 0);
    const orderId = randomUUID();
    await updateDatabase((nextDatabase) => {
      nextDatabase.orders.push({
        id: orderId,
        menuId,
        customerName,
        sellerNote,
        totalCents,
        status: "unpaid",
        proofFile: null,
        proofMime: null,
        createdAt: Date.now(),
        items: selections,
      });
    });
    return Response.json({ orderId }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not place the order.");
  }
}
