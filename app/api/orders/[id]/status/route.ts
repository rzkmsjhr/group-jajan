import { bindings, ensureSchema, jsonError, verifyCreator } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const body = await request.json() as { status?: unknown };
  if (body.status !== "paid" && body.status !== "unpaid") return jsonError("Invalid payment status.");
  const { DB } = bindings();
  const order = await DB.prepare("SELECT menu_id AS menuId FROM orders WHERE id = ?")
    .bind(id).first<{ menuId: string }>();
  if (!order) return jsonError("Order not found.", 404);
  if (!(await verifyCreator(order.menuId, request.headers.get("x-creator-key")))) {
    return jsonError("Creator access required.", 403);
  }
  await DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(body.status, id).run();
  return Response.json({ ok: true });
}
