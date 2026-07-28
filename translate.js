const fs = require("fs");

let content = fs.readFileSync("app/page.tsx", "utf-8");

const replacements = [
  // Home
  ['Group ordering, minus the group chat chaos.', '{t("heroEyebrow")}'],
  ['A tiny menu.<br />A tidy order list.', '{t("heroTitleLine1")}<br />{t("heroTitleLine2")}'],
  ['Create a menu, share one link, collect payment proof, and mark orders paid.', '{t("heroCopy")}'],
  ['Create a menu →', '{t("createMenuBtn")}'],
  ['<h3>1 Make</h3>', '<h3>1 {t("step1")}</h3>'],
  ['<p>Create a menu.</p>', '<p>{t("heroCopy").split(", ")[0]}.</p>'],
  ['<h3>2 Share</h3>', '<h3>2 {t("step2")}</h3>'],
  ['<p>Share one link.</p>', '<p>{t("heroCopy").split(", ")[1]}.</p>'],
  ['<h3>3 Track</h3>', '<h3>3 {t("step3")}</h3>'],
  ['<p>Collect payment proof.</p>', '<p>{t("heroCopy").split(", ")[2]}.</p>'],

  // Create
  ['{editMode ? "Edit menu" : "New menu"}', '{editMode ? t("editMenu") : t("newMenu")}'],
  ['{editMode ? "Keep it fresh." : "What’s on the table?"}', '{editMode ? t("keepItFresh") : t("whatsOnTheTable")}'],
  ['{editMode ? "← Cancel" : "← Back"}', '{editMode ? t("cancel") : t("back")}'],
  ['{loading ? (editMode ? "Saving…" : "Creating…") : (editMode ? "Save menu changes" : "Create & share")}', '{loading ? (editMode ? t("saving") : t("creating")) : (editMode ? t("saveMenuChanges") : t("createAndShare"))}'],

  // Menu View
  ['<h2>No items available</h2>', '<h2>{t("noItemsAvailable")}</h2>'],
  ['<p>There are no items in stock right now.</p>', '<p>{t("noItemsInStock")}</p>'],
  ['Your name\n                <input', '{t("yourName")}\n                <input'],
  ['placeholder="Name for the order"', 'placeholder={t("nameForOrder")}'],
  ['Note for seller <span className="optional">optional</span>', '{t("noteForSeller")} <span className="optional">{t("optional")}</span>'],
  ['placeholder="No chili, pack separately, or anything else…"', 'placeholder={t("sellerNotePlaceholder")}'],
  ['<span>Total</span>', '<span>{t("total")}</span>'],
  ['{loading ? "Loading…" : "Continue to checkout"}', '{loading ? t("loadingMenu") : t("continueToCheckout")}'],
  
  // Checkout
  ['<p className="eyebrow">Checkout</p>', '<p className="eyebrow">{t("checkout")}</p>'],
  ['<h1>Almost done.</h1>', '<h1>{t("almostDone")}</h1>'],
  ['<p>Your order is in. Send the transfer, then attach a screenshot or photo below.</p>', '<p>{t("checkoutInstructions")}</p>'],
  ['<h2>Payment details</h2>', '<h2>{t("paymentDetails")}</h2>'],
  ['<h3>Proof received</h3>', '<h3>{t("proofReceived")}</h3>'],
  ['<p>Your status will update after the creator reviews it.</p>', '<p>{t("proofStatusUpdate")}</p>'],
  ['← Back to menu', '{t("backToMenu")}'],
  ['{loading ? "Uploading…" : "Submit payment proof"}', '{loading ? t("uploading") : t("submitPaymentProof")}'],
  ['Cancel order', '{t("cancelOrder")}'],

  // Manage View
  ['<p className="eyebrow">Creator view</p>', '<p className="eyebrow">{t("creatorView")}</p>'],
  ['Copy order link', '{t("copyOrderLink")}'],
  ['Edit menu', '{t("editMenu")}'],
  ['Copy private creator link', '{t("copyCreatorLink")}'],
  ['<p>Copy this link manually</p>', '<p>{t("copyLinkManually")}</p>'],
  ['<strong>Show who ordered</strong>', '<strong>{t("showWhoOrdered")}</strong>'],
  ['<span>Let guests see names, items, totals, and payment status.</span>', '<span>{t("showWhoOrderedDescription")}</span>'],
  ['{menu.showPublicOrders ? "Shown" : "Hidden"}', '{menu.showPublicOrders ? t("shown") : t("hidden")}'],
  ['<OrderList orders={orders} creator creatorKey={creatorKey} lang={lang} onToggle={toggleStatus} onPreview={setPreviewImage} />', '<OrderList orders={orders} creator creatorKey={creatorKey} lang={lang} onToggle={toggleStatus} onPreview={setPreviewImage} />'],
  ['<OrderList orders={orders} lang={lang} onPreview={setPreviewImage} />', '<OrderList orders={orders} lang={lang} onPreview={setPreviewImage} />']
];

for (const [from, to] of replacements) {
  content = content.replace(from, to);
}

fs.writeFileSync("app/page.tsx", content);
console.log("Done");
