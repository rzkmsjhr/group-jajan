import { jsonError, readDatabase, updateDatabase, verifyCreator } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as { status?: unknown };
  if (body.status !== "paid" && body.status !== "unpaid") return jsonError("Invalid payment status.");
  const status = body.status;
  const database = await readDatabase();
  const order = database.orders.find((entry) => entry.id === id);
  if (!order) return jsonError("Order not found.", 404);
  if (!(await verifyCreator(order.menuId, request.headers.get("x-creator-key")))) {
    return jsonError("Creator access required.", 403);
  }
  await updateDatabase((nextDatabase) => {
    const nextOrder = nextDatabase.orders.find((entry) => entry.id === id);
    if (!nextOrder) throw new Error("Order not found.");
    nextOrder.status = status;
  });
  return Response.json({ ok: true });
}
