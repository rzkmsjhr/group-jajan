"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
};

type Order = {
  id: string;
  customerName: string;
  totalCents: number;
  status: "unpaid" | "paid";
  proofKey: string | null;
  createdAt: number;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
};

type Menu = {
  id: string;
  title: string;
  note: string | null;
  paymentInstructions: string | null;
  items: Item[];
  orders?: Order[];
};

type DraftItem = { name: string; description: string; price: string };
type View = "home" | "create" | "menu" | "checkout" | "manage";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function creatorKeyName(menuId: string) {
  return `tinytable:creator:${menuId}`;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [menuTitle, setMenuTitle] = useState("");
  const [menuNote, setMenuNote] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { name: "", description: "", price: "" },
  ]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [orderId, setOrderId] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [creatorKey, setCreatorKey] = useState("");

  const loadMenu = useCallback(async (menuId: string, manage = false) => {
    setLoading(true);
    setError("");
    try {
      const headers: HeadersInit = {};
      const localCreatorKey = localStorage.getItem(creatorKeyName(menuId));
      if (localCreatorKey) setCreatorKey(localCreatorKey);
      if (manage) {
        const hashKey = new URLSearchParams(window.location.hash.slice(1)).get("key");
        if (hashKey) {
          localStorage.setItem(creatorKeyName(menuId), hashKey);
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
        const activeCreatorKey = localStorage.getItem(creatorKeyName(menuId));
        if (!activeCreatorKey) throw new Error("This creator link is not available on this device.");
        setCreatorKey(activeCreatorKey);
        headers["x-creator-key"] = activeCreatorKey;
      }
      const response = await fetch(`/api/menus/${menuId}${manage ? "?manage=1" : ""}`, {
        headers,
      });
      const data = (await response.json()) as Menu & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load this menu.");
      setMenu(data);
      setView(manage ? "manage" : "menu");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const menuId = params.get("menu");
    const checkoutId = params.get("checkout");
    if (menuId) {
      void loadMenu(menuId, params.get("manage") === "1").then(() => {
        if (checkoutId) {
          setOrderId(checkoutId);
          setView("checkout");
        }
      });
    }
  }, [loadMenu]);

  useEffect(() => {
    if (!proof) {
      setProofPreview("");
      return;
    }
    const url = URL.createObjectURL(proof);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proof]);

  const totalCents = useMemo(
    () =>
      menu?.items.reduce(
        (total, item) => total + item.priceCents * (quantities[item.id] || 0),
        0,
      ) || 0,
    [menu, quantities],
  );

  function setRoute(next: string) {
    window.history.pushState(null, "", next);
  }

  function updateDraft(index: number, field: keyof DraftItem, value: string) {
    setDraftItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  async function createMenu(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/menus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: menuTitle,
          note: menuNote,
          paymentInstructions,
          items: draftItems.map((item) => ({
            ...item,
            priceCents: Math.round(Number(item.price) * 100),
          })),
        }),
      });
      const data = (await response.json()) as { menu?: Menu; creatorKey?: string; error?: string };
      if (!response.ok || !data.menu || !data.creatorKey) {
        throw new Error(data.error || "Could not create the menu.");
      }
      localStorage.setItem(creatorKeyName(data.menu.id), data.creatorKey);
      setCreatorKey(data.creatorKey);
      setMenu(data.menu);
      setView("manage");
      setRoute(`/?menu=${data.menu.id}&manage=1`);
      setNotice("Your menu is live. Copy the order link and share it.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function placeOrder(event: FormEvent) {
    event.preventDefault();
    if (!menu) return;
    setLoading(true);
    setError("");
    try {
      const selections = Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ menuId: menu.id, customerName, selections }),
      });
      const data = (await response.json()) as { orderId?: string; error?: string };
      if (!response.ok || !data.orderId) throw new Error(data.error || "Could not place your order.");
      setOrderId(data.orderId);
      setView("checkout");
      setRoute(`/?menu=${menu.id}&checkout=${data.orderId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadProof(event: FormEvent) {
    event.preventDefault();
    if (!proof || !orderId || !menu) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("proof", proof);
      const response = await fetch(`/api/orders/${orderId}/proof`, { method: "POST", body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not upload this image.");
      setNotice("Payment proof sent. The menu creator will review it.");
      setProof(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(order: Order) {
    if (!menu) return;
    setError("");
    const storedCreatorKey = creatorKey || localStorage.getItem(creatorKeyName(menu.id));
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-creator-key": storedCreatorKey || "" },
        body: JSON.stringify({ status: order.status === "paid" ? "unpaid" : "paid" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update this order.");
      await loadMenu(menu.id, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  async function copyShareLink() {
    if (!menu) return;
    const link = `${window.location.origin}/?menu=${menu.id}`;
    await navigator.clipboard.writeText(link);
    setNotice("Order link copied.");
  }

  async function copyCreatorLink() {
    if (!menu) return;
    const key = creatorKey || localStorage.getItem(creatorKeyName(menu.id));
    if (!key) return;
    const link = `${window.location.origin}/?menu=${menu.id}&manage=1#key=${encodeURIComponent(key)}`;
    await navigator.clipboard.writeText(link);
    setNotice("Private creator link copied. Keep it safe.");
  }

  const goHome = () => {
    setView("home");
    setMenu(null);
    setError("");
    setNotice("");
    setCreatorKey("");
    setRoute("/");
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="TinyTable home">
          <span className="brand-mark">t</span>
          <span>TinyTable</span>
        </button>
        {menu && view !== "manage" && creatorKey ? (
          <button
            className="text-button"
            onClick={() => {
              setRoute(`/?menu=${menu.id}&manage=1`);
              void loadMenu(menu.id, true);
            }}
          >
            Manage
          </button>
        ) : null}
      </header>

      <section className="shell">
        {error ? <div className="message error" role="alert">{error}</div> : null}
        {notice ? <div className="message success">{notice}</div> : null}

        {view === "home" ? (
          <div className="hero">
            <p className="eyebrow">Group ordering, minus the group chat chaos.</p>
            <h1>A tiny menu.<br />A tidy order list.</h1>
            <p className="hero-copy">
              Create a menu, share one link, collect payment proof, and mark orders paid.
            </p>
            <button className="primary large" onClick={() => setView("create")}>
              Create a menu <span>→</span>
            </button>
            <div className="steps" aria-label="How it works">
              <span><b>1</b> Make</span>
              <span><b>2</b> Share</span>
              <span><b>3</b> Track</span>
            </div>
          </div>
        ) : null}

        {view === "create" ? (
          <form className="panel create-panel" onSubmit={createMenu}>
            <div className="panel-heading">
              <button type="button" className="back" onClick={goHome}>← Back</button>
              <p className="eyebrow">New menu</p>
              <h1>What’s on the table?</h1>
            </div>
            <label>
              Menu name
              <input required maxLength={80} value={menuTitle} onChange={(e) => setMenuTitle(e.target.value)} placeholder="Friday lunch" />
            </label>
            <label>
              A short note <span className="optional">optional</span>
              <textarea maxLength={240} value={menuNote} onChange={(e) => setMenuNote(e.target.value)} placeholder="Orders close at 11:30" />
            </label>
            <div className="item-builder">
              <div className="section-label"><span>Items</span><span>{draftItems.length}</span></div>
              {draftItems.map((item, index) => (
                <div className="draft-item" key={index}>
                  <input aria-label={`Item ${index + 1} name`} required maxLength={80} value={item.name} onChange={(e) => updateDraft(index, "name", e.target.value)} placeholder="Item name" />
                  <input aria-label={`Item ${index + 1} price`} required min="0.01" step="0.01" type="number" value={item.price} onChange={(e) => updateDraft(index, "price", e.target.value)} placeholder="Price" />
                  <input aria-label={`Item ${index + 1} description`} maxLength={140} value={item.description} onChange={(e) => updateDraft(index, "description", e.target.value)} placeholder="Description (optional)" />
                  {draftItems.length > 1 ? (
                    <button type="button" className="remove" aria-label={`Remove item ${index + 1}`} onClick={() => setDraftItems((items) => items.filter((_, i) => i !== index))}>×</button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="add-item" onClick={() => setDraftItems((items) => [...items, { name: "", description: "", price: "" }])}>+ Add another item</button>
            </div>
            <label>
              Payment instructions <span className="optional">optional</span>
              <textarea maxLength={500} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder="Bank name and transfer details" />
            </label>
            <button className="primary" disabled={loading}>{loading ? "Creating…" : "Create & share"}</button>
          </form>
        ) : null}

        {view === "menu" && menu ? (
          <form className="menu-layout" onSubmit={placeOrder}>
            <div className="menu-intro">
              <p className="eyebrow">Open order</p>
              <h1>{menu.title}</h1>
              {menu.note ? <p>{menu.note}</p> : null}
            </div>
            <div className="menu-card">
              {menu.items.map((item) => {
                const quantity = quantities[item.id] || 0;
                return (
                  <div className="menu-item" key={item.id}>
                    <div>
                      <h2>{item.name}</h2>
                      {item.description ? <p>{item.description}</p> : null}
                      <strong>{formatMoney(item.priceCents)}</strong>
                    </div>
                    <div className="quantity" aria-label={`${item.name} quantity`}>
                      <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => setQuantities((q) => ({ ...q, [item.id]: Math.max(0, quantity - 1) }))}>−</button>
                      <span>{quantity}</span>
                      <button type="button" aria-label={`Add one ${item.name}`} onClick={() => setQuantities((q) => ({ ...q, [item.id]: quantity + 1 }))}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="order-footer">
              <label>
                Your name
                <input required maxLength={80} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name for the order" />
              </label>
              <div className="total-row"><span>Total</span><strong>{formatMoney(totalCents)}</strong></div>
              <button className="primary" disabled={loading || totalCents === 0}>{loading ? "Saving…" : "Continue to checkout"}</button>
            </div>
          </form>
        ) : null}

        {view === "checkout" && menu ? (
          <div className="checkout panel">
            <div className="panel-heading">
              <p className="eyebrow">Checkout</p>
              <h1>Almost done.</h1>
              <p>Your order is in. Send the transfer, then attach a screenshot or photo below.</p>
            </div>
            {menu.paymentInstructions ? <div className="payment-note"><span>Payment details</span><p>{menu.paymentInstructions}</p></div> : null}
            {notice ? (
              <div className="done-state">
                <div className="check">✓</div>
                <h2>Proof received</h2>
                <p>You can close this page. Your status will update after the creator reviews it.</p>
              </div>
            ) : (
              <form onSubmit={uploadProof}>
                <label className={`upload ${proofPreview ? "has-preview" : ""}`}>
                  {proofPreview ? <img src={proofPreview} alt="Selected payment proof" /> : <span className="upload-icon">↑</span>}
                  <span>{proof ? proof.name : "Choose an image"}</span>
                  <small>PNG, JPG or WebP · max 5 MB</small>
                  <input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} />
                </label>
                <button className="primary" disabled={loading || !proof}>{loading ? "Uploading…" : "Submit payment proof"}</button>
              </form>
            )}
          </div>
        ) : null}

        {view === "manage" && menu ? (
          <div className="manage">
            <div className="manage-heading">
              <div>
                <p className="eyebrow">Creator view</p>
                <h1>{menu.title}</h1>
                <p>{menu.orders?.length || 0} order{menu.orders?.length === 1 ? "" : "s"}</p>
              </div>
              <div className="share-actions">
                <button className="secondary" onClick={copyShareLink}>Copy order link</button>
                <button className="text-button" onClick={copyCreatorLink}>Copy private creator link</button>
              </div>
            </div>
            <div className="order-list">
              {!menu.orders?.length ? (
                <div className="empty">
                  <span>○</span>
                  <h2>No orders yet</h2>
                  <p>Share the order link. New names will appear here.</p>
                </div>
              ) : menu.orders.map((order) => (
                <article className="order-row" key={order.id}>
                  <div className="order-main">
                    <div className="order-name">
                      <h2>{order.customerName}</h2>
                      <span>{new Date(order.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <div className="order-items">
                      {order.items.map((item, index) => <span key={`${item.name}-${index}`}>{item.quantity}× {item.name}</span>)}
                    </div>
                  </div>
                  <div className="order-side">
                    <strong>{formatMoney(order.totalCents)}</strong>
                    {order.proofKey ? (
                      <a className="proof-link" href={`/api/orders/${order.id}/proof?key=${encodeURIComponent(creatorKey)}`} target="_blank" rel="noreferrer">View proof</a>
                    ) : <span className="no-proof">No proof</span>}
                    <button className={`status ${order.status}`} onClick={() => void toggleStatus(order)}>
                      <i /> {order.status === "paid" ? "Paid" : "Unpaid"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {loading && !menu && view !== "create" ? <div className="loading">Loading menu…</div> : null}
      </section>
      <footer>Small orders, beautifully organized.</footer>
    </main>
  );
}
