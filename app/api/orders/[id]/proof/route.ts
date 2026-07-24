import { bindings, ensureSchema, jsonError, verifyCreator } from "@/lib/data";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await context.params;
    const form = await request.formData();
    const proof = form.get("proof");
    if (!(proof instanceof File)) return jsonError("Choose an image to upload.");
    if (!allowedTypes.has(proof.type)) return jsonError("Use a PNG, JPG, or WebP image.");
    if (proof.size > 5 * 1024 * 1024) return jsonError("The image must be smaller than 5 MB.");
    const { DB, PROOFS } = bindings();
    const order = await DB.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
    if (!order) return jsonError("Order not found.", 404);
    const extension = proof.type === "image/png" ? "png" : proof.type === "image/webp" ? "webp" : "jpg";
    const proofKey = `${id}/${crypto.randomUUID()}.${extension}`;
    await PROOFS.put(proofKey, proof.stream(), {
      httpMetadata: { contentType: proof.type },
      customMetadata: { orderId: id },
    });
    await DB.prepare("UPDATE orders SET proof_key = ? WHERE id = ?").bind(proofKey, id).run();
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not upload this image.");
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const { DB, PROOFS } = bindings();
  const order = await DB.prepare(`SELECT menu_id AS menuId, proof_key AS proofKey FROM orders WHERE id = ?`)
    .bind(id).first<{ menuId: string; proofKey: string | null }>();
  if (!order?.proofKey) return jsonError("Payment proof not found.", 404);
  const creatorKey = new URL(request.url).searchParams.get("key");
  if (!(await verifyCreator(order.menuId, creatorKey))) return jsonError("Creator access required.", 403);
  const object = await PROOFS.get(order.proofKey);
  if (!object) return jsonError("Payment proof not found.", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", "inline");
  return new Response(object.body, { headers });
}
