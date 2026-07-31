"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Language, getTranslation, translateError, translations } from "@/lib/i18n";

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
const maxImageSizeBytes = 4 * 1024 * 1024;
const maxImageDimension = 1600;
const imageCompressionQuality = 0.84;

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    if (file.size <= 750 * 1024 && bitmap.width <= maxImageDimension && bitmap.height <= maxImageDimension) {
      return file;
    }
    const scale = Math.min(1, maxImageDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, "image/webp", imageCompressionQuality);
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
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

function CancelOrderDialog({
  open,
  onClose,
  onConfirm,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lang: Language;
}) {
  const t = (key: keyof typeof translations.en) => getTranslation(lang, key);
  useEffect(() => {
    if (!open) return;
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
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div
      className="cancel-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cancel-dialog-card" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title" aria-describedby="cancel-order-description">
        <p className="eyebrow">{t("checkout")}</p>
        <h2 id="cancel-order-title">{t("cancelThisOrder")}</h2>
        <p id="cancel-order-description">{t("cancelOrderDescription")}</p>
        <div className="cancel-dialog-actions">
          <button type="button" className="outline-button" onClick={onClose} autoFocus>{t("keepOrder")}</button>
          <button type="button" className="soft-danger-button" onClick={onConfirm}>{t("cancelOrder")}</button>
        </div>
      </div>
    </div>
  );
}

function OrderList({
  orders,
  creator = false,
  creatorKey = "",
  lang,
  onToggle,
  onPreview,
}: {
  orders: Order[];
  creator?: boolean;
  creatorKey?: string;
  lang: Language;
  onToggle?: (order: Order) => void;
  onPreview?: (image: Exclude<PreviewImage, null>) => void;
}) {
  const t = (key: keyof typeof translations.en) => getTranslation(lang, key);
  const grandTotalCents = orders.reduce((total, order) => total + order.totalCents, 0);

  return (
    <div className={`order-list ${creator ? "" : "public-orders"}`}>
      <div className="list-heading">
        <div>
          <p className="eyebrow">{creator ? t("orderList") : t("whoHasOrdered")}</p>
          <h2>{translations[lang].orderCount(orders.length)}</h2>
        </div>
        {creator ? (
          <div className="order-summary">
            <span>{t("grandTotal")}</span>
            <strong> {formatMoney(grandTotalCents)}</strong>
          </div>
        ) : <span>{t("visibleToEveryone")}</span>}
      </div>
      {!orders.length ? (
        <div className="empty">
          <span>○</span>
          <h2>{t("noOrdersYet")}</h2>
          <p>{t("firstOrderAppearsHere")}</p>
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
              order.proofKey === "OFFLINE_CASH" ? (
                <span className="cash-proof" style={{ color: "var(--muted)", fontWeight: 600, fontSize: "13px" }}>{t("offlineCash")}</span>
              ) : order.proofKey ? (
                <button
                  type="button"
                  className="proof-link"
                  onClick={() => onPreview?.({
                    src: `/api/orders/${order.id}/proof?key=${encodeURIComponent(creatorKey)}`,
                    alt: `Payment proof from ${order.customerName}`,
                  })}
                >
                  {t("viewProof")}
                </button>
              ) : <span className="no-proof">{t("noProof")}</span>
            ) : null}
            {creator ? (
              <button
                type="button"
                role="switch"
                aria-checked={order.status === "paid"}
                aria-label={`Toggle payment status for ${order.customerName}`}
                className={`payment-switch ${order.status}`}
                onClick={() => onToggle?.(order)}
              >
                <span className="switch-track" aria-hidden="true"><span /></span>
                <span>{order.status === "paid" ? t("paid") : t("unpaid")}</span>
              </button>
            ) : (
              <span className={`status ${order.status === "paid" ? "paid" : order.proofKey ? "pending" : "unpaid"}`}><i /> {order.status === "paid" ? t("paid") : order.proofKey ? t("pending") : t("unpaid")}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Language>("id");
  const t = (key: keyof typeof translations.en) => getTranslation(lang, key);
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
  const [paidOffline, setPaidOffline] = useState(false);
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [shareFallback, setShareFallback] = useState("");
  const [previewImage, setPreviewImage] = useState<PreviewImage>(null);
  const [editImageVersion, setEditImageVersion] = useState(0);
  const [brokenEditImages, setBrokenEditImages] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, proofSubmitted, editMode]);

  useEffect(() => {
    if (!notice) return;
    const dismissTimer = window.setTimeout(() => setNotice(""), 15_000);
    return () => window.clearTimeout(dismissTimer);
  }, [notice]);

  useEffect(() => {
    const hasUnsavedWork =
      view === "create" ||
      (view === "manage" && editMode) ||
      (view === "menu" && Object.keys(quantities).some((k) => quantities[k] > 0)) ||
      (view === "checkout" && !proofSubmitted && !paidOffline);

    if (!hasUnsavedWork) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [view, quantities, proofSubmitted, editMode, paidOffline]);

  useEffect(() => {
    const handlePageHide = () => {
      if (view === "checkout" && orderId && !proofSubmitted && !paidOffline) {
        navigator.sendBeacon(`/api/orders/${orderId}`);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [view, orderId, proofSubmitted, paidOffline]);

  useEffect(() => {
    const saved = localStorage.getItem("mi-jajan-lang") as Language;
    if (saved === "en" || saved === "id") setLang(saved);
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("mi-jajan-lang", newLang);
  };

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
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : t("somethingWentWrong"));
      setMenu(data);
      setView(manage ? "manage" : "menu");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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

  const cancelOrder = useCallback(async () => {
    if (!menu || !orderId) return;
    const menuId = menu.id;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not cancel this order."));
      setOrderId("");
      setProof(null);
      setProofSubmitted(false);
      setCustomerName("");
      setSellerNote("");
      setQuantities({});
      setView("menu");
      window.history.replaceState(null, "", `/?menu=${menuId}`);
      await loadMenu(menuId);
      setNotice(t("orderCancelled"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translateError(lang, "Could not cancel this order."));
    } finally {
      setLoading(false);
    }
  }, [loadMenu, menu, orderId]);

  const openCancelPrompt = useCallback(() => setCancelPromptOpen(true), []);

  useEffect(() => {
    if (view !== "checkout" || proofSubmitted || !menu || !orderId) return;
    const checkoutUrl = `/?menu=${menu.id}&checkout=${orderId}`;
    const handleBack = () => {
      window.history.pushState(null, "", checkoutUrl);
      openCancelPrompt();
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [menu, openCancelPrompt, orderId, proofSubmitted, view]);

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

  async function prepareSelectedImage(file: File | null, input: HTMLInputElement) {
    if (!file) return null;
    setImageProcessing(true);
    setError("");
    try {
      const compressedFile = await compressImage(file);
      if (compressedFile.size > maxImageSizeBytes) {
        input.value = "";
        setError(t("imageSizeError"));
        return undefined;
      }
      return compressedFile;
    } finally {
      setImageProcessing(false);
    }
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
        throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not create the menu."));
      }
      localStorage.setItem(creatorKeyName(data.menu.id), data.creatorKey);
      setCreatorKey(data.creatorKey);
      setMenu(data.menu);
      setView("manage");
      setRoute(`/?menu=${data.menu.id}&manage=1`);
      setNotice(t("menuLive"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
      if (!response.ok || !data.orderId) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not place your order."));
      setOrderId(data.orderId);
      setProofSubmitted(false);
      setPaidOffline(false);
      setNotice("");
      setView("checkout");
      setRoute(`/?menu=${menu.id}&checkout=${data.orderId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not upload this image."));
      setNotice(t("proofSent"));
      setProofSubmitted(true);
      setPaidOffline(false);
      setProof(null);
      const menuResponse = await fetch(`/api/menus/${menu.id}`);
      if (menuResponse.ok) setMenu(await menuResponse.json() as Menu);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  async function payOffline() {
    if (!orderId || !menu || loading || imageProcessing) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/cash`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not update payment method."));
      setNotice(t("paidOfflineMsg"));
      setProofSubmitted(true);
      setPaidOffline(true);
      const menuResponse = await fetch(`/api/menus/${menu.id}`);
      if (menuResponse.ok) setMenu(await menuResponse.json() as Menu);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not update this order."));
      await loadMenu(menu.id, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
        throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not update order-list visibility."));
      }
      setMenu({ ...menu, showPublicOrders: data.showPublicOrders });
      setNotice(data.showPublicOrders ? t("guestOrderVisible") : t("guestOrderHidden"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
      if (!response.ok) throw new Error(data.error ? translateError(lang, data.error) : translateError(lang, "Could not update the menu."));
      setEditMode(false);
      await loadMenu(menu.id, true);
      setNotice(t("menuUpdated"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("somethingWentWrong"));
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
    setNotice(copied ? successMessage : t("copyBlocked"));
  }

  async function copyShareLink() {
    if (!menu) return;
    await copyTextWithFallback(`${window.location.origin}/?menu=${menu.id}`, t("orderLinkCopied"));
  }

  async function copyCreatorLink() {
    if (!menu) return;
    const key = creatorKey || localStorage.getItem(creatorKeyName(menu.id));
    if (!key) return;
    const link = `${window.location.origin}/?menu=${menu.id}&manage=1#key=${encodeURIComponent(key)}`;
    await copyTextWithFallback(link, t("creatorLinkCopied"));
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
          {t("menuName")}
          <input required maxLength={80} value={menuTitle} onChange={(event) => setMenuTitle(event.target.value)} placeholder={t("menuNamePlaceholder")} />
        </label>
        <label>
          {t("shortNote")} <span className="optional">{t("optional")}</span>
          <textarea maxLength={240} value={menuNote} onChange={(event) => setMenuNote(event.target.value)} placeholder={t("shortNotePlaceholder")} />
        </label>
        <div className="item-builder">
          <div className="section-label"><span>{t("items")}</span><span>{draftItems.length}</span></div>
          {draftItems.map((item, index) => (
            <div className="draft-item" key={item.id || index}>
              <input aria-label={`Item ${index + 1} name`} required maxLength={80} value={item.name} onChange={(event) => updateDraft(index, "name", event.target.value)} placeholder={t("itemNamePlaceholder")} />
              <div className="price-input">
                <span>Rp</span>
                <input aria-label={`Item ${index + 1} price in rupiah`} required min="1" step="1" type="number" value={item.price} onChange={(event) => updateDraft(index, "price", event.target.value)} placeholder="25000" />
              </div>
              <input className="item-description" aria-label={`Item ${index + 1} description`} maxLength={140} value={item.description} onChange={(event) => updateDraft(index, "description", event.target.value)} placeholder={t("descriptionPlaceholder")} />
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
                <span>{item.imageFile?.name || (item.imageUrl ? t("changeImage") : t("addImage"))} <small>{t("imageHint")}</small></span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void prepareSelectedImage(input.files?.[0] || null, input).then((file) => {
                      if (file !== undefined) updateDraftImage(index, file);
                    });
                  }}
                  disabled={imageProcessing}
                />
              </label>
              {item.imageUrl ? (
                <button type="button" className="remove-image" onClick={() => setDraftItems((items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, imageUrl: null, imageFile: null } : entry))}>{t("removeImage")}</button>
              ) : null}
              {draftItems.length > 1 ? (
                <button type="button" className="remove" aria-label={`Remove item ${index + 1}`} onClick={() => setDraftItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="add-item" onClick={() => setDraftItems((items) => [...items, { name: "", description: "", price: "", imageUrl: null, imageFile: null }])}>{t("addAnotherItem")}</button>
        </div>
        <label>
          {t("paymentInstructions")} <span className="optional">{t("optional")}</span>
          <textarea maxLength={500} value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder={t("paymentInstructionsPlaceholder")} />
        </label>
        <label className="payment-image-field">
          <span>{t("paymentInstructionImage")} <small>{t("imageHint")}</small></span>
          {paymentImageUrl && !paymentImageFile && !brokenEditImages.includes(paymentImageUrl) ? (
            <img
              src={editPreviewUrl(paymentImageUrl)}
              alt="Current payment instruction"
              onError={(event) => handleEditImageError(event, paymentImageUrl)}
            />
          ) : paymentImageUrl && brokenEditImages.includes(paymentImageUrl) ? (
            <span className="payment-image-error">{t("imagePreviewUnavailable")}</span>
          ) : null}
          <span className="payment-image-action">
            {paymentImageFile?.name || (paymentImageUrl ? t("changeImage") : t("chooseImage"))}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const input = event.currentTarget;
              void prepareSelectedImage(input.files?.[0] || null, input).then((file) => {
                if (file !== undefined) setPaymentImageFile(file);
              });
            }}
            disabled={imageProcessing}
          />
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
            {t("removePaymentImage")}
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
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", fontSize: "13px", alignItems: "center" }}>
            <button 
              type="button" 
              className="text-button" 
              style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: lang === "id" ? 800 : 400, color: lang === "id" ? "var(--ink)" : "var(--muted)" }}
              onClick={() => changeLang("id")}
            ><img src="/id.svg" width="16" alt="ID" style={{ display: "block", borderRadius: "2px" }} /> ID</button>
            <span style={{ color: "var(--line)", display: "flex", alignItems: "center" }}>|</span>
            <button 
              type="button" 
              className="text-button" 
              style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: lang === "en" ? 800 : 400, color: lang === "en" ? "var(--ink)" : "var(--muted)" }}
              onClick={() => changeLang("en")}
            ><img src="/gb.svg" width="16" alt="EN" style={{ display: "block", borderRadius: "2px" }} /> EN</button>
          </div>
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
        </div>
      </header>

      <section className="shell">
        {error ? <div className="message error" role="alert">{error}</div> : null}
        {notice ? (
          <div className="message success" role="status" aria-live="polite">
            <span>{notice}</span>
            <button type="button" className="message-close" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button>
          </div>
        ) : null}

        {view === "home" ? (
          <div className="hero">
            <p className="eyebrow">{t("heroEyebrow")}</p>
            <h1>{t("heroTitleLine1")}<br />{t("heroTitleLine2")}</h1>
            <p className="hero-copy">
              {t("heroCopy")}
            </p>
            <button className="primary large" onClick={() => setView("create")}>
              {t("createMenuBtn").replace(" →", "")} <span>→</span>
            </button>
            <div className="steps" aria-label="How it works">
              <span><b>1</b> {t("step1")}</span>
              <span><b>2</b> {t("step2")}</span>
              <span><b>3</b> {t("step3")}</span>
            </div>
          </div>
        ) : null}

        {view === "create" ? (
          <form className="panel create-panel" onSubmit={createMenu}>
            <div className="panel-heading">
              <button type="button" className="back" onClick={goHome}>{t("back")}</button>
              <p className="eyebrow">{t("newMenu")}</p>
              <h1>{t("whatsOnTheTable")}</h1>
            </div>
            {menuFields()}
            <button className="primary" disabled={loading || imageProcessing}>{imageProcessing ? t("optimizingImage") : loading ? t("creating") : t("createAndShare")}</button>
          </form>
        ) : null}

        {view === "menu" && menu ? (
          <form className="menu-layout" onSubmit={placeOrder}>
            <div className="menu-intro">
              <p className="eyebrow">{t("openOrder")}</p>
              <h1>{menu.title}</h1>
              {menu.note ? <p>{menu.note}</p> : null}
            </div>
            <div className="menu-card">
              {menu.items.length ? menu.items.map((item) => {
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
              }) : (
                <div className="empty menu-empty">
                  <h2>{t("noItemsAvailable")}</h2>
                  <p>{t("noItemsInStock")}</p>
                </div>
              )}
            </div>
            <div className="order-footer">
              <label>
                {t("yourName")}
                <input required maxLength={80} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t("nameForOrder")} />
              </label>
              <label>
                {t("noteForSeller")} <span className="optional">{t("optional")}</span>
                <textarea
                  className="seller-note-input"
                  maxLength={300}
                  value={sellerNote}
                  onChange={(event) => setSellerNote(event.target.value)}
                  placeholder={t("sellerNotePlaceholder")}
                />
              </label>
              <div className="total-row"><span>{t("total")}</span><strong>{formatMoney(totalCents)}</strong></div>
              <button className="primary" disabled={loading || totalCents === 0}>{loading ? t("saving") : t("continueToCheckout")}</button>
            </div>
            {menu.showPublicOrders ? <OrderList orders={menu.orders || []} lang={lang} /> : null}
          </form>
        ) : null}

        {view === "checkout" && menu ? (
          <div className="checkout panel">
            {proofSubmitted ? (
              <>
                <div className="done-state">
                  <div className="check">✓</div>
                  <h2>{paidOffline ? t("offlineCash") : t("proofReceived")}</h2>
                  <p>{paidOffline ? t("paidOfflineMsg") : t("proofStatusUpdate")}</p>
                  <button type="button" className="secondary back-to-menu" onClick={() => void returnToMenu()}>
                    {t("backToMenu")}
                  </button>
                </div>
                {menu.showPublicOrders ? <OrderList orders={menu.orders || []} lang={lang} /> : null}
              </>
            ) : (
              <>
                <div className="panel-heading">
                  <p className="eyebrow">{t("checkout")}</p>
                  <h1>{t("almostDone")}</h1>
                  <p>{t("checkoutInstructions")}</p>
                </div>
                {menu.paymentInstructions || menu.paymentImageUrl ? (
                  <div className="payment-note">
                    <span>{t("paymentDetails")}</span>
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
                <form onSubmit={uploadProof}>
                <div className="checkout-primary-action">
                  <label className={`upload ${proofPreview ? "has-preview" : ""}`}>
                    {proofPreview ? <img src={proofPreview} alt="Selected payment proof" /> : <span className="upload-icon">↑</span>}
                    <span>{proof ? proof.name : t("chooseAnImage")}</span>
                    <small>{t("imageFormatHint")}</small>
                    <input
                      required
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void prepareSelectedImage(input.files?.[0] || null, input).then((file) => {
                          if (file !== undefined) setProof(file);
                        });
                      }}
                      disabled={imageProcessing}
                    />
                  </label>
                  <button className="primary" disabled={loading || imageProcessing || !proof}>
                    {imageProcessing ? t("optimizingImage") : (loading && proof ? t("uploading") : t("submitPaymentProof"))}
                  </button>
                </div>
                
                <div className="alternative-actions-divider">
                  <span>{t("or")}</span>
                </div>

                <div className="checkout-alternative-actions">
                  <button type="button" className="secondary" disabled={loading || imageProcessing} onClick={payOffline}>{t("payOffline")}</button>
                  <button type="button" className="soft-danger-button cancel-order-button" disabled={loading} onClick={openCancelPrompt}>
                    {t("cancelOrder")}
                  </button>
                </div>
              </form>
              </>
            )}
          </div>
        ) : null}

        {view === "manage" && menu ? (
          <div className="manage">
            {editMode ? (
              <form className="panel create-panel manage-editor" onSubmit={updateMenu}>
                <div className="panel-heading editor-heading">
                  <button type="button" className="back" onClick={() => setEditMode(false)}>{t("cancel")}</button>
                  <p className="eyebrow">{t("editMenu")}</p>
                  <h1>{t("keepItFresh")}</h1>
                </div>
                {menuFields()}
                <button className="primary" disabled={loading || imageProcessing}>{imageProcessing ? t("optimizingImage") : loading ? t("saving") : t("saveMenuChanges")}</button>
              </form>
            ) : (
              <>
                <div className="manage-heading">
                  <div>
                    <p className="eyebrow">{t("creatorView")}</p>
                    <h1>{menu.title}</h1>
                    <p>{menu.orders?.length || 0} order{menu.orders?.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="share-actions">
                    <button type="button" className="secondary" onClick={copyShareLink}>{t("copyOrderLink")}</button>
                    <button type="button" className="outline-button" onClick={beginMenuEdit}>Edit menu</button>
                    <button type="button" className="text-button" onClick={copyCreatorLink}>{t("copyCreatorLink")}</button>
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
                    <strong>{t("showWhoOrdered")}</strong>
                    <span>{t("showWhoOrderedDescription")}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={menu.showPublicOrders}
                    className={`visibility-toggle-button ${menu.showPublicOrders ? "on" : "off"}`}
                    onClick={() => void togglePublicOrderVisibility()}
                  >
                    <span className="switch-track" aria-hidden="true"><span /></span>
                    <span>{menu.showPublicOrders ? t("shown") : t("hidden")}</span>
                  </button>
                </div>
                <OrderList
                  orders={menu.orders || []}
                  creator
                  creatorKey={creatorKey}
                  lang={lang}
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
      <CancelOrderDialog
        open={cancelPromptOpen}
        onClose={() => setCancelPromptOpen(false)}
        onConfirm={() => {
          setCancelPromptOpen(false);
          void cancelOrder();
        }}
        lang={lang}
      />
      <footer>{t("footer")}</footer>
    </main>
  );
}
