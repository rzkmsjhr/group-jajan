import {
  jsonError,
  enforceBodyLimit,
  enforceRateLimit,
  readDatabase,
  readUpload,
  removeUpload,
  saveImage,
  updateDatabase,
  verifyCreator,
} from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResponse = await enforceRateLimit(request, "proof-upload");
    if (rateLimitResponse) return rateLimitResponse;
    const bodyLimitResponse = enforceBodyLimit(request, 5 * 1024 * 1024);
    if (bodyLimitResponse) return bodyLimitResponse;
    const { id } = await context.params;
    const form = await request.formData();
    const proof = form.get("proof");
    if (!(proof instanceof File)) return jsonError("Choose an image to upload.");
    const database = await readDatabase();
    const order = database.orders.find((entry) => entry.id === id);
    if (!order) return jsonError("Order not found.", 404);
    const savedImage = await saveImage(proof, "proof");
    await removeUpload(order.proofFile);
    await updateDatabase((nextDatabase) => {
      const nextOrder = nextDatabase.orders.find((entry) => entry.id === id);
      if (!nextOrder) throw new Error("Order not found.");
      nextOrder.proofFile = savedImage.fileName;
      nextOrder.proofMime = savedImage.mimeType;
    });
    return Response.json({ ok: true });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not upload this image.");
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const database = await readDatabase();
  const order = database.orders.find((entry) => entry.id === id);
  if (!order?.proofFile) return jsonError("Payment proof not found.", 404);
  const creatorKey = new URL(request.url).searchParams.get("key");
  if (!(await verifyCreator(order.menuId, creatorKey))) return jsonError("Creator access required.", 403);
  const upload = await readUpload(order.proofFile);
  if (!upload) return jsonError("Payment proof not found.", 404);
  return new Response(upload.contents, {
    headers: {
      "content-type": upload.contentType || order.proofMime || "application/octet-stream",
      "cache-control": "private, no-store",
      "content-disposition": "inline",
    },
  });
}
