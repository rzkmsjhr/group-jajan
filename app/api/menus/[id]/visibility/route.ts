import { jsonError, updateDatabase, verifyCreator } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await verifyCreator(id, request.headers.get("x-creator-key")))) {
    return jsonError("Creator access required.", 403);
  }
  const body = await request.json() as { showPublicOrders?: unknown };
  if (typeof body.showPublicOrders !== "boolean") return jsonError("Invalid visibility setting.");
  const showPublicOrders = body.showPublicOrders;
  await updateDatabase((database) => {
    const menu = database.menus.find((entry) => entry.id === id);
    if (!menu) throw new Error("Menu not found.");
    menu.showPublicOrders = showPublicOrders;
  });
  return Response.json({ showPublicOrders });
}
