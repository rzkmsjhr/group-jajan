"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
};

type Order = {
  id: string;
  customerName: string;
  sellerNote: string | null;
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
  paymentImageUrl: string | null;
  showPublicOrders: boolean;
  items: Item[];
  orders?: Order[];
};

type DraftItem = {
  id?: string;
  name: string;
  description: string;
  price: string;
  imageUrl?: string | null;
  imageFile?: File | null;
};
type View = "home" | "create" | "menu" | "checkout" | "manage";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function creatorKeyName(menuId: string) {
  return `tinytable:creator:${menuId}`;
}

type PreviewImage = { src: string; alt: string } | null;

function ImageLightbox({ image, onClose }: { image: PreviewImage; onClose: () => void }) {
  useEffect(() => {
    if (!image) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [image, onClose]);

  if (!image) return null;
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${image.alt} preview`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lightbox-card">
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close image preview">×</button>
        <img src={image.src} alt={image.alt} />
        <p>{image.alt}</p>
      </div>
    </div>
  );
}

function OrderList({
  orders,
  creator = false,
  creatorKey = "",
  onToggle,
  onPreview,
}: {
  orders: Order[];
  creator?: boolean;
  creatorKey?: string;
  onToggle?: (order: Order) => void;
  onPreview?: (image: Exclude<PreviewImage, null>) => void;
}) {
  return (
    <div className={`order-list ${creator ? "" : "public-orders"}`}>
      <div className="list-heading">
        <div>
          <p className="eyebrow">{creator ? "Order list" : "Who has ordered"}</p>
          <h2>{orders.length} order{orders.length === 1 ? "" : "s"}</h2>
        </div>
        {!creator ? <span>Visible to everyone</span> : null}
      </div>
      {!orders.length ? (
        <div className="empty">
          <span>○</span>
          <h2>No orders yet</h2>
          <p>The first order will appear here.</p>
        </div>
      ) : orders.map((order) => (
        <article className="order-row" key={order.id}>
          <div className="order-main">
            <div className="order-name">
              <h2>{order.customerName}</h2>
              {creator && order.sellerNote ? <p className="seller-note">“{order.sellerNote}”</p> : null}
              <span>{new Date(order.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <div className="order-items">
              {order.items.map((item, index) => <span key={`${item.name}-${index}`}>{item.quantity}× {item.name}</span>)}
            </div>
          </div>
          <div className={`order-side ${creator ? "" : "public-side"}`}>
            <strong>{formatMoney(order.totalCents)}</strong>
            {creator ? (
              order.proofKey ? (
                <button
                  type="button"
                  className="proof-link"
                  onClick={() => onPreview?.({
                    src: `/api/orders/${order.id}/proof?key=${encodeURIComponent(creatorKey)}`,
                    alt: `Payment proof from ${order.customerName}`,
                  })}
                >
                  View proof
                </button>
              ) : <span className="no-proof">No proof</span>
            ) : null}
            {creator ? (
              <button
                type="button"
                role="switch"
                aria-checked={order.status === "paid"}
                aria-label={`Mark ${order.customerName} as ${order.status === "paid" ? "unpaid" : "paid"}`}
                className={`payment-switch ${order.status}`}
                onClick={() => onToggle?.(order)}
              >
                <span className="switch-track" aria-hidden="true"><span /></span>
                <span>{order.status === "paid" ? "Paid" : "Unpaid"}</span>
              </button>
            ) : (
              <span className={`status ${order.status}`}><i /> {order.status === "paid" ? "Paid" : "Unpaid"}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
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
  const [paymentImageUrl, setPaymentImageUrl] = useState<string | null>(null);
  const [paymentImageFile, setPaymentImageFile] = useState<File | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { name: "", description: "", price: "" },
  ]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [creatorKey, setCreatorKey] = useState("");
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [shareFallback, setShareFallback] = useState("");
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);
  const [editImageVersion, setEditImageVersion] = useState(0);
  const [brokenEditImages, setBrokenEditImages] = useState<string[]>([]);

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
      // The URL is the source of truth for the initial shared-menu view.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMenu(menuId, params.get("manage") === "1").then(() => {
        if (checkoutId) {
          setOrderId(checkoutId);
          setView("checkout");
        }
      });
    }
  }, [loadMenu]);

  const proofPreview = useMemo(() => (proof ? URL.createObjectURL(proof) : ""), [proof]);

  useEffect(() => () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);

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

  function updateDraft(index: number, field: "name" | "description" | "price", value: string) {
    setDraftItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function updateDraftImage(index: number, file: File | null) {
    setDraftItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, imageFile: file } : item)),
    );
  }

  function buildMenuFormData() {
    const form = new FormData();
    form.append("payload", JSON.stringify({
      title: menuTitle,
      note: menuNote,
      paymentInstructions,
      paymentImageUrl,
      items: draftItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        priceCents: Math.round(Number(item.price) * 100),
        imageUrl: item.imageUrl ?? null,
      })),
    }));
    draftItems.forEach((item, index) => {
      if (item.imageFile) form.append(`itemImage-${index}`, item.imageFile);
    });
    if (paymentImageFile) form.append("paymentImage", paymentImageFile);
    return form;
  }

  async function createMenu(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/menus", {
        method: "POST",
        body: buildMenuFormData(),
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
        body: JSON.stringify({ menuId: menu.id, customerName, sellerNote, selections }),
      });
      const data = (await response.json()) as { orderId?: string; error?: string };
      if (!response.ok || !data.orderId) throw new Error(data.error || "Could not place your order.");
      setOrderId(data.orderId);
      setProofSubmitted(false);
      setNotice("");
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
      setProofSubmitted(true);
      setProof(null);
      const menuResponse = await fetch(`/api/menus/${menu.id}`);
      if (menuResponse.ok) setMenu(await menuResponse.json() as Menu);
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

  async function togglePublicOrderVisibility() {
    if (!menu) return;
    const nextVisibility = !menu.showPublicOrders;
    setError("");
    try {
      const response = await fetch(`/api/menus/${menu.id}/visibility`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-creator-key": creatorKey },
        body: JSON.stringify({ showPublicOrders: nextVisibility }),
      });
      const data = await response.json() as { showPublicOrders?: boolean; error?: string };
      if (!response.ok || typeof data.showPublicOrders !== "boolean") {
        throw new Error(data.error || "Could not update order-list visibility.");
      }
      setMenu({ ...menu, showPublicOrders: data.showPublicOrders });
      setNotice(data.showPublicOrders ? "Guest order list is now visible." : "Guest order list is now hidden.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  function beginMenuEdit() {
    if (!menu) return;
    setMenuTitle(menu.title);
    setMenuNote(menu.note || "");
    setPaymentInstructions(menu.paymentInstructions || "");
    setPaymentImageUrl(menu.paymentImageUrl || null);
    setPaymentImageFile(null);
    setDraftItems(menu.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: String(item.priceCents / 100),
      imageUrl: item.imageUrl,
      imageFile: null,
    })));
    setEditImageVersion(Date.now());
    setBrokenEditImages([]);
    setEditMode(true);
    setNotice("");
  }

  function editPreviewUrl(url: string, retry = false) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}editPreview=${editImageVersion + (retry ? 1 : 0)}`;
  }

  function handleEditImageError(event: React.SyntheticEvent<HTMLImageElement>, url: string) {
    const image = event.currentTarget;
    if (image.dataset.retried === "true") {
      setBrokenEditImages((current) => current.includes(url) ? current : [...current, url]);
      return;
    }
    image.dataset.retried = "true";
    image.src = editPreviewUrl(url, true);
  }

  async function updateMenu(event: FormEvent) {
    event.preventDefault();
    if (!menu) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/menus/${menu.id}`, {
        method: "PATCH",
        headers: { "x-creator-key": creatorKey },
        body: buildMenuFormData(),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not update the menu.");
      setEditMode(false);
      await loadMenu(menu.id, true);
      setNotice("Menu updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTextWithFallback(text: string, successMessage: string) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = text;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.appendChild(temporaryInput);
      temporaryInput.select();
      copied = document.execCommand("copy");
      temporaryInput.remove();
    }
    setShareFallback(copied ? "" : text);
    setNotice(copied ? successMessage : "Copy is blocked by this browser. Use the link shown below.");
  }

  async function copyShareLink() {
    if (!menu) return;
    await copyTextWithFallback(`${window.location.origin}/?menu=${menu.id}`, "Order link copied.");
  }

  async function copyCreatorLink() {
    if (!menu) return;
    const key = creatorKey || localStorage.getItem(creatorKeyName(menu.id));
    if (!key) return;
    const link = `${window.location.origin}/?menu=${menu.id}&manage=1#key=${encodeURIComponent(key)}`;
    await copyTextWithFallback(link, "Private creator link copied. Keep it safe.");
  }

  const goHome = () => {
    setView("home");
    setMenu(null);
    setError("");
    setNotice("");
    setCreatorKey("");
    setEditMode(false);
    setProofSubmitted(false);
    setPaymentImageUrl(null);
    setPaymentImageFile(null);
    setShareFallback("");
    setRoute("/");
  };

  async function returnToMenu() {
    if (!menu) return;
    const menuId = menu.id;
    setProofSubmitted(false);
    setProof(null);
    setOrderId("");
    setCustomerName("");
    setSellerNote("");
    setQuantities({});
    setNotice("");
    setRoute(`/?menu=${menuId}`);
    await loadMenu(menuId);
  }

  function menuFields() {
    return (
      <>
        <label>
          Menu name
          <input required maxLength={80} value={menuTitle} onChange={(event) => setMenuTitle(event.target.value)} placeholder="Friday lunch" />
        </label>
        <label>
          A short note <span className="optional">optional</span>
          <textarea maxLength={240} value={menuNote} onChange={(event) => setMenuNote(event.target.value)} placeholder="Orders close at 11:30" />
        </label>
        <div className="item-builder">
          <div className="section-label"><span>Items</span><span>{draftItems.length}</span></div>
          {draftItems.map((item, index) => (
            <div className="draft-item" key={item.id || index}>
              <input aria-label={`Item ${index + 1} name`} required maxLength={80} value={item.name} onChange={(event) => updateDraft(index, "name", event.target.value)} placeholder="Item name" />
              <div className="price-input">
                <span>Rp</span>
                <input aria-label={`Item ${index + 1} price in rupiah`} required min="1" step="1" type="number" value={item.price} onChange={(event) => updateDraft(index, "price", event.target.value)} placeholder="25000" />
              </div>
              <input className="item-description" aria-label={`Item ${index + 1} description`} maxLength={140} value={item.description} onChange={(event) => updateDraft(index, "description", event.target.value)} placeholder="Description (optional)" />
              <label className="item-image-field">
                {item.imageUrl && !item.imageFile && !brokenEditImages.includes(item.imageUrl) ? (
                  <img
                    src={editPreviewUrl(item.imageUrl)}
                    alt={`${item.name} current image`}
                    onError={(event) => handleEditImageError(event, item.imageUrl!)}
                  />
                ) : item.imageUrl && brokenEditImages.includes(item.imageUrl) ? (
                  <span className="image-placeholder broken-image-placeholder">!</span>
                ) : <span className="image-placeholder">＋</span>}
                <span>{item.imageFile?.name || (item.imageUrl ? "Change image" : "Add image")} <small>optional</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateDraftImage(index, event.target.files?.[0] || null)} />
              </label>
              {item.imageUrl ? (
                <button type="button" className="remove-image" onClick={() => setDraftItems((items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, imageUrl: null, imageFile: null } : entry))}>Remove image</button>
              ) : null}
              {draftItems.length > 1 ? (
                <button type="button" className="remove" aria-label={`Remove item ${index + 1}`} onClick={() => setDraftItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="add-item" onClick={() => setDraftItems((items) => [...items, { name: "", description: "", price: "", imageUrl: null, imageFile: null }])}>+ Add another item</button>
        </div>
        <label>
          Payment instructions <span className="optional">optional</span>
          <textarea maxLength={500} value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder="Bank name and transfer details" />
        </label>
        <label className="payment-image-field">
          <span>Payment instruction image <small>optional</small></span>
          {paymentImageUrl && !paymentImageFile && !brokenEditImages.includes(paymentImageUrl) ? (
            <img
              src={editPreviewUrl(paymentImageUrl)}
              alt="Current payment instruction"
              onError={(event) => handleEditImageError(event, paymentImageUrl)}
            />
          ) : paymentImageUrl && brokenEditImages.includes(paymentImageUrl) ? (
            <span className="payment-image-error">Image preview unavailable — choose a replacement</span>
          ) : null}
          <span className="payment-image-action">
            {paymentImageFile?.name || (paymentImageUrl ? "Change image" : "Choose an image")}
          </span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPaymentImageFile(event.target.files?.[0] || null)} />
        </label>
        {paymentImageUrl || paymentImageFile ? (
          <button
            type="button"
            className="remove-image payment-remove"
            onClick={() => {
              setPaymentImageUrl(null);
              setPaymentImageFile(null);
            }}
          >
            Remove payment image
          </button>
        ) : null}
      </>
    );
  }

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="MI Jajan home">
          <span className="brand-mark">m</span>
          <span>MI Jajan</span>
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
            {menuFields()}
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
                    {item.imageUrl ? (
                      <button
                        type="button"
                        className="previewable-image menu-image-button"
                        onClick={() => setPreviewImage({ src: item.imageUrl!, alt: item.name })}
                        aria-label={`Preview ${item.name} image`}
                      >
                        <img className="menu-item-image" src={item.imageUrl} alt="" />
                      </button>
                    ) : null}
                    <div className="menu-item-copy">
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
              <label>
                Note for seller <span className="optional">optional</span>
                <textarea
                  className="seller-note-input"
                  maxLength={300}
                  value={sellerNote}
                  onChange={(event) => setSellerNote(event.target.value)}
                  placeholder="No chili, pack separately, or anything else…"
                />
              </label>
              <div className="total-row"><span>Total</span><strong>{formatMoney(totalCents)}</strong></div>
              <button className="primary" disabled={loading || totalCents === 0}>{loading ? "Saving…" : "Continue to checkout"}</button>
            </div>
            {menu.showPublicOrders ? <OrderList orders={menu.orders || []} /> : null}
          </form>
        ) : null}

        {view === "checkout" && menu ? (
          <div className="checkout panel">
            <div className="panel-heading">
              <p className="eyebrow">Checkout</p>
              <h1>Almost done.</h1>
              <p>Your order is in. Send the transfer, then attach a screenshot or photo below.</p>
            </div>
            {menu.paymentInstructions || menu.paymentImageUrl ? (
              <div className="payment-note">
                <span>Payment details</span>
                {menu.paymentInstructions ? <p>{menu.paymentInstructions}</p> : null}
                {menu.paymentImageUrl ? (
                  <button
                    type="button"
                    className="previewable-image payment-preview-button"
                    onClick={() => setPreviewImage({ src: menu.paymentImageUrl!, alt: "Payment instructions" })}
                    aria-label="Preview payment instruction image"
                  >
                    <img src={menu.paymentImageUrl} alt="" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {proofSubmitted ? (
              <>
                <div className="done-state">
                  <div className="check">✓</div>
                  <h2>Proof received</h2>
                  <p>Your status will update after the creator reviews it.</p>
                  <button type="button" className="secondary back-to-menu" onClick={() => void returnToMenu()}>
                    ← Back to menu
                  </button>
                </div>
                {menu.showPublicOrders ? <OrderList orders={menu.orders || []} /> : null}
              </>
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
            {editMode ? (
              <form className="panel create-panel manage-editor" onSubmit={updateMenu}>
                <div className="panel-heading editor-heading">
                  <button type="button" className="back" onClick={() => setEditMode(false)}>← Cancel</button>
                  <p className="eyebrow">Edit menu</p>
                  <h1>Keep it fresh.</h1>
                </div>
                {menuFields()}
                <button className="primary" disabled={loading}>{loading ? "Saving…" : "Save menu changes"}</button>
              </form>
            ) : (
              <>
                <div className="manage-heading">
                  <div>
                    <p className="eyebrow">Creator view</p>
                    <h1>{menu.title}</h1>
                    <p>{menu.orders?.length || 0} order{menu.orders?.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="share-actions">
                    <button type="button" className="secondary" onClick={copyShareLink}>Copy order link</button>
                    <button type="button" className="outline-button" onClick={beginMenuEdit}>Edit menu</button>
                    <button type="button" className="text-button" onClick={copyCreatorLink}>Copy private creator link</button>
                  </div>
                </div>
                {shareFallback ? (
                  <div className="manual-share">
                    <label htmlFor="manual-share-link">Copy this link manually</label>
                    <input
                      id="manual-share-link"
                      readOnly
                      value={shareFallback}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>
                ) : null}
                <div className="public-visibility-setting">
                  <div>
                    <strong>Show who ordered</strong>
                    <span>Let guests see names, items, totals, and payment status.</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={menu.showPublicOrders}
                    className={`visibility-toggle-button ${menu.showPublicOrders ? "on" : "off"}`}
                    onClick={() => void togglePublicOrderVisibility()}
                  >
                    <span className="switch-track" aria-hidden="true"><span /></span>
                    <span>{menu.showPublicOrders ? "Shown" : "Hidden"}</span>
                  </button>
                </div>
                <OrderList
                  orders={menu.orders || []}
                  creator
                  creatorKey={creatorKey}
                  onToggle={(order) => void toggleStatus(order)}
                  onPreview={setPreviewImage}
                />
              </>
            )}
          </div>
        ) : null}

        {loading && !menu && view !== "create" ? <div className="loading">Loading menu…</div> : null}
      </section>
      <ImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
      <footer>Small orders, beautifully organized.</footer>
    </main>
  );
}
