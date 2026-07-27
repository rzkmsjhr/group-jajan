import { jsonError, removeUpload, updateDatabase } from "@/lib/data";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const removedOrder = await updateDatabase((database) => {
      const index = database.orders.findIndex((entry) => entry.id === id);
      if (index < 0) return null;
      const order = database.orders[index];
      if (order.status !== "unpaid" || order.proofFile) return false;
      database.orders.splice(index, 1);
      return order;
    });
    if (removedOrder === null) return jsonError("Order not found.", 404);
    if (removedOrder === false) return jsonError("This order can no longer be cancelled.", 409);
    await removeUpload(removedOrder.proofFile);
    return Response.json({ ok: true });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not cancel this order.");
  }
}
