import { bindings, cleanText, ensureSchema, jsonError } from "@/lib/data";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json() as {
      menuId?: unknown;
      customerName?: unknown;
      selections?: Array<{ itemId?: unknown; quantity?: unknown }>;
    };
    const menuId = cleanText(body.menuId, 80, true)!;
    const customerName = cleanText(body.customerName, 80, true)!;
    if (!Array.isArray(body.selections) || body.selections.length < 1 || body.selections.length > 30) {
      return jsonError("Choose at least one item.");
    }
    const { DB } = bindings();
    const selections = await Promise.all(body.selections.map(async (selection) => {
      const itemId = cleanText(selection.itemId, 80, true)!;
      const quantity = Number(selection.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Invalid quantity.");
      const item = await DB.prepare(`SELECT name, price_cents AS priceCents FROM menu_items
        WHERE id = ? AND menu_id = ?`).bind(itemId, menuId).first<{ name: string; priceCents: number }>();
      if (!item) throw new Error("One selected item is unavailable.");
      return { ...item, quantity };
    }));
    const totalCents = selections.reduce((total, item) => total + item.priceCents * item.quantity, 0);
    const orderId = crypto.randomUUID();
    await DB.batch([
      DB.prepare(`INSERT INTO orders (id, menu_id, customer_name, total_cents, status, created_at)
        VALUES (?, ?, ?, ?, 'unpaid', ?)`).bind(orderId, menuId, customerName, totalCents, Date.now()),
      ...selections.map((item) =>
        DB.prepare(`INSERT INTO order_items (id, order_id, item_name, quantity, price_cents)
          VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), orderId, item.name, item.quantity, item.priceCents),
      ),
    ]);
    return Response.json({ orderId }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not place the order.");
  }
}
