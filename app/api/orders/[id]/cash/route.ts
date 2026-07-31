import {
  jsonError,
  enforceRateLimit,
  readDatabase,
  removeUpload,
  updateDatabase,
} from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, "proof-upload");
    if (rateLimitResponse) return rateLimitResponse;
    const { id } = await context.params;
    
    const database = await readDatabase();
    const order = database.orders.find((entry) => entry.id === id);
    if (!order) return jsonError("Order not found.", 404);
    if (order.status === "paid") return jsonError("Order is already paid.");
    
    // If they had a real proof file previously, we should remove it from R2
    // just in case they switched to cash after uploading.
    if (order.proofFile && order.proofFile !== "OFFLINE_CASH") {
      await removeUpload(order.proofFile);
    }
    
    await updateDatabase((nextDatabase) => {
      const nextOrder = nextDatabase.orders.find((entry) => entry.id === id);
      if (!nextOrder) throw new Error("Order not found.");
      nextOrder.proofFile = "OFFLINE_CASH";
      nextOrder.proofMime = null;
    });
    
    return Response.json({ ok: true });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not update payment method.");
  }
}
