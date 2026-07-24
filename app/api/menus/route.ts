import { bindings, cleanText, ensureSchema, hashSecret, jsonError, newSecret } from "@/lib/data";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as {
      title?: unknown;
      note?: unknown;
      paymentInstructions?: unknown;
      items?: Array<{ name?: unknown; description?: unknown; priceCents?: unknown }>;
    };
    const title = cleanText(body.title, 80, true)!;
    const note = cleanText(body.note, 240);
    const paymentInstructions = cleanText(body.paymentInstructions, 500);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return jsonError("Add between 1 and 30 menu items.");
    }
    const items = body.items.map((item, position) => {
      const priceCents = Number(item.priceCents);
      if (!Number.isInteger(priceCents) || priceCents < 1 || priceCents > 10_000_000) {
        throw new Error("Each item needs a valid price.");
      }
      return {
        id: crypto.randomUUID(),
        name: cleanText(item.name, 80, true)!,
        description: cleanText(item.description, 140),
        priceCents,
        position,
      };
    });
    const id = crypto.randomUUID();
    const creatorKey = newSecret();
    const createdAt = Date.now();
    const { DB } = bindings();
    await DB.batch([
      DB.prepare("INSERT INTO menus (id, title, note, payment_instructions, admin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, title, note, paymentInstructions, await hashSecret(creatorKey), createdAt),
      ...items.map((item) =>
        DB.prepare("INSERT INTO menu_items (id, menu_id, name, description, price_cents, position) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(item.id, id, item.name, item.description, item.priceCents, item.position),
      ),
    ]);
    return Response.json({
      creatorKey,
      menu: { id, title, note, paymentInstructions, items, orders: [] },
    }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not create the menu.");
  }
}
