import { bindings, ensureSchema, jsonError, verifyCreator } from "@/lib/data";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const { DB } = bindings();
  const menu = await DB.prepare(`SELECT id, title, note, payment_instructions AS paymentInstructions
    FROM menus WHERE id = ?`).bind(id).first();
  if (!menu) return jsonError("Menu not found.", 404);
  const items = (await DB.prepare(`SELECT id, name, description, price_cents AS priceCents
    FROM menu_items WHERE menu_id = ? ORDER BY position`).bind(id).all()).results;
  const url = new URL(request.url);
  if (url.searchParams.get("manage") !== "1") return Response.json({ ...menu, items });
  if (!(await verifyCreator(id, request.headers.get("x-creator-key")))) {
    return jsonError("This creator link is invalid.", 403);
  }
  const orders = (await DB.prepare(`SELECT id, customer_name AS customerName, total_cents AS totalCents,
    status, proof_key AS proofKey, created_at AS createdAt FROM orders
    WHERE menu_id = ? ORDER BY created_at DESC`).bind(id).all()).results as Array<Record<string, unknown> & { id: string }>;
  const hydrated = await Promise.all(orders.map(async (order) => {
    const orderItems = (await DB.prepare(`SELECT item_name AS name, quantity, price_cents AS priceCents
      FROM order_items WHERE order_id = ?`).bind(order.id).all()).results;
    return { ...order, items: orderItems };
  }));
  return Response.json({ ...menu, items, orders: hydrated });
}
