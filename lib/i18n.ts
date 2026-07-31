export type Language = "en" | "id";

export const translations = {
  en: {
    // Navigation & Common
    back: "← Back",
    cancel: "← Cancel",
    optional: "optional",
    save: "Save",
    loadingMenu: "Loading menu…",
    somethingWentWrong: "Something went wrong.",
    
    // Home
    heroEyebrow: "Group ordering, minus the group chat chaos.",
    heroTitleLine1: "A tiny menu.",
    heroTitleLine2: "A tidy order list.",
    heroCopy: "Create a menu, share one link, collect payment proof, and mark orders paid.",
    createMenuBtn: "Create a menu →",
    step1: "Make",
    step2: "Share",
    step3: "Track",

    // Create / Edit Menu
    newMenu: "New menu",
    editMenu: "Edit menu",
    whatsOnTheTable: "What’s on the table?",
    keepItFresh: "Keep it fresh.",
    menuName: "Menu name",
    menuNamePlaceholder: "Friday lunch",
    shortNote: "A short note",
    shortNotePlaceholder: "Orders close at 11:30",
    items: "Items",
    stockHint: "Leave stock blank for unlimited, or set it to 0 to hide the item.",
    itemNamePlaceholder: "Item name",
    stock: "Stock",
    unlimited: "Unlimited",
    descriptionPlaceholder: "Description (optional)",
    changeImage: "Change image",
    addImage: "Add image",
    imageHint: "optional · max 4 MB",
    removeImage: "Remove image",
    addAnotherItem: "+ Add another item",
    paymentInstructions: "Payment instructions",
    paymentInstructionsPlaceholder: "Bank name and transfer details",
    paymentInstructionImage: "Payment instruction image",
    imagePreviewUnavailable: "Image preview unavailable — choose a replacement",
    chooseImage: "Choose an image",
    removePaymentImage: "Remove payment image",
    optimizingImage: "Optimizing image…",
    creating: "Creating…",
    createAndShare: "Create & share",
    saving: "Saving…",
    saveMenuChanges: "Save menu changes",

    // Menu View (Buyer)
    openOrder: "Open order",
    noItemsAvailable: "No items available",
    noItemsInStock: "There are no items in stock right now.",
    yourName: "Your name",
    nameForOrder: "Name for the order",
    noteForSeller: "Note for seller",
    sellerNotePlaceholder: "No chili, pack separately, or anything else…",
    total: "Total",
    continueToCheckout: "Continue to checkout",

    // Checkout View
    checkout: "Checkout",
    almostDone: "Almost done.",
    checkoutInstructions: "Your order is in. Send the transfer, then attach a screenshot or photo below.",
    paymentDetails: "Payment details",
    proofReceived: "Proof received",
    proofStatusUpdate: "Your status will update after the creator reviews it.",
    backToMenu: "← Back to menu",
    uploading: "Uploading…",
    chooseAnImage: "Choose an image",
    imageFormatHint: "PNG, JPG or WebP · max 4 MB",
    submitPaymentProof: "Submit payment proof",
    payOffline: "Pay in cash",
    offlineCash: "Cash",
    paidOfflineMsg: "We've notified the creator you'll pay in cash.",
    cancelOrder: "Cancel order",

    // Cancel Dialog
    cancelThisOrder: "Cancel this order?",
    cancelOrderDescription: "Your order will be removed from the list. You can place a new order later.",
    keepOrder: "Keep order",

    // Manage View
    creatorView: "Creator view",
    copyOrderLink: "Copy order link",
    copyCreatorLink: "Copy private creator link",
    copyLinkManually: "Copy this link manually",
    showWhoOrdered: "Show who ordered",
    showWhoOrderedDescription: "Let guests see names, items, totals, and payment status.",
    shown: "Shown",
    hidden: "Hidden",

    // Order List
    orderList: "Order list",
    whoHasOrdered: "Who has ordered",
    orderCount: (count: number) => `${count} order${count === 1 ? "" : "s"}`,
    grandTotal: "Grand total",
    visibleToEveryone: "Visible to everyone",
    noOrdersYet: "No orders yet",
    firstOrderAppearsHere: "The first order will appear here.",
    viewProof: "View proof",
    noProof: "No proof",
    paid: "Paid",
    unpaid: "Unpaid",

    // Notices & Errors
    orderCancelled: "Order cancelled.",
    menuLive: "Your menu is live. Copy the order link and share it.",
    proofSent: "Payment proof sent. The menu creator will review it.",
    guestOrderVisible: "Guest order list is now visible.",
    guestOrderHidden: "Guest order list is now hidden.",
    menuUpdated: "Menu updated.",
    orderLinkCopied: "Order link copied.",
    creatorLinkCopied: "Private creator link copied. Keep it safe.",
    copyBlocked: "Copy is blocked by this browser. Use the link shown below.",
    imageSizeError: "Each image must be 4 MB or smaller, even after compression.",
    footer: "Small orders, beautifully organized.",
  },
  id: {
    // Navigation & Common
    back: "← Kembali",
    cancel: "← Batal",
    optional: "opsional",
    save: "Simpan",
    loadingMenu: "Memuat menu…",
    somethingWentWrong: "Terjadi kesalahan.",
    
    // Home
    heroEyebrow: "Pesan barengan, tanpa ribet di grup chat.",
    heroTitleLine1: "Menu simpel.",
    heroTitleLine2: "Daftar pesanan rapi.",
    heroCopy: "Buat menu, bagikan satu tautan, kumpulkan bukti transfer, dan tandai pesanan lunas.",
    createMenuBtn: "Buat menu →",
    step1: "Buat",
    step2: "Bagikan",
    step3: "Pantau",

    // Create / Edit Menu
    newMenu: "Menu baru",
    editMenu: "Edit menu",
    whatsOnTheTable: "Ada menu apa hari ini?",
    keepItFresh: "Perbarui menu.",
    menuName: "Nama menu",
    menuNamePlaceholder: "Makan siang bareng",
    shortNote: "Catatan singkat",
    shortNotePlaceholder: "Pesanan ditutup jam 11:30",
    items: "Item",
    stockHint: "Biarkan field stok kosong untuk unlimited, atau isi 0 untuk menyembunyikan item.",
    itemNamePlaceholder: "Nama item",
    stock: "Stok",
    unlimited: "Bebas",
    descriptionPlaceholder: "Deskripsi (opsional)",
    changeImage: "Ubah gambar",
    addImage: "Tambah gambar",
    imageHint: "opsional · maks 4 MB",
    removeImage: "Hapus gambar",
    addAnotherItem: "+ Tambah item lain",
    paymentInstructions: "Instruksi pembayaran",
    paymentInstructionsPlaceholder: "Nama bank dan detail transfer",
    paymentInstructionImage: "Gambar instruksi pembayaran",
    imagePreviewUnavailable: "Pratinjau tidak tersedia — pilih gambar lain",
    chooseImage: "Pilih gambar",
    removePaymentImage: "Hapus gambar pembayaran",
    optimizingImage: "Mengoptimalkan gambar…",
    creating: "Membuat…",
    createAndShare: "Buat & bagikan",
    saving: "Menyimpan…",
    saveMenuChanges: "Simpan perubahan",

    // Menu View (Buyer)
    openOrder: "Pesanan dibuka",
    noItemsAvailable: "Belum ada item",
    noItemsInStock: "Tidak ada item yang tersedia saat ini.",
    yourName: "Nama kamu",
    nameForOrder: "Nama untuk pesanan",
    noteForSeller: "Catatan untuk penjual",
    sellerNotePlaceholder: "Tanpa sambal, bungkus pisah, dll…",
    total: "Total",
    continueToCheckout: "Lanjut ke pembayaran",

    // Checkout View
    checkout: "Pembayaran",
    almostDone: "Hampir selesai.",
    checkoutInstructions: "Pesananmu sudah masuk. Silakan transfer, lalu lampirkan bukti pembayaran di bawah ini.",
    paymentDetails: "Detail pembayaran",
    proofReceived: "Bukti diterima",
    proofStatusUpdate: "Statusmu akan diperbarui setelah dicek oleh pembuat menu.",
    backToMenu: "← Kembali ke menu",
    uploading: "Mengunggah…",
    chooseAnImage: "Pilih gambar",
    imageFormatHint: "PNG, JPG atau WebP · maks 4 MB",
    submitPaymentProof: "Kirim bukti pembayaran",
    payOffline: "Bayar Tunai",
    offlineCash: "Tunai / Cash",
    paidOfflineMsg: "Pesanan dicatat untuk bayar tunai.",
    cancelOrder: "Batalkan pesanan",

    // Cancel Dialog
    cancelThisOrder: "Batalkan pesanan ini?",
    cancelOrderDescription: "Pesananmu akan dihapus dari daftar. Kamu bisa membuat pesanan baru nanti.",
    keepOrder: "Tetap pesan",

    // Manage View
    creatorView: "Tampilan pembuat",
    copyOrderLink: "Salin tautan pesanan",
    copyCreatorLink: "Salin tautan akses admin",
    copyLinkManually: "Salin tautan ini secara manual",
    showWhoOrdered: "Tampilkan pemesan",
    showWhoOrderedDescription: "Biarkan pembeli melihat nama, pesanan, total, dan status bayar.",
    shown: "Tampil",
    hidden: "Sembunyi",

    // Order List
    orderList: "Daftar pesanan",
    whoHasOrdered: "Siapa saja yang pesan",
    orderCount: (count: number) => `${count} pesanan`,
    grandTotal: "Total keseluruhan",
    visibleToEveryone: "Terlihat oleh semua orang",
    noOrdersYet: "Belum ada pesanan",
    firstOrderAppearsHere: "Pesanan pertama akan muncul di sini.",
    viewProof: "Lihat bukti",
    noProof: "Tidak ada bukti",
    paid: "Lunas",
    unpaid: "Belum lunas",

    // Notices & Errors
    orderCancelled: "Pesanan dibatalkan.",
    menuLive: "Menumu sudah aktif. Salin tautan pesanan dan bagikan.",
    proofSent: "Bukti pembayaran terkirim. Pembuat menu akan mengeceknya.",
    guestOrderVisible: "Daftar pesanan kini dapat dilihat tamu.",
    guestOrderHidden: "Daftar pesanan kini disembunyikan dari tamu.",
    menuUpdated: "Menu diperbarui.",
    orderLinkCopied: "Tautan pesanan disalin.",
    creatorLinkCopied: "Tautan akses admin disalin. Simpan baik-baik.",
    copyBlocked: "Browser ini memblokir penyalinan otomatis. Gunakan tautan di bawah.",
    imageSizeError: "Setiap gambar harus 4 MB atau kurang, bahkan setelah kompresi.",
    footer: "Pesanan kecil, tertata rapi.",
  }
};

export function getTranslation(lang: Language, key: keyof typeof translations.en): any {
  return translations[lang][key] || translations.en[key];
}

export function translateError(lang: Language, errorMessage: string) {
  if (lang === "en") return errorMessage;
  if (errorMessage.includes("Too many requests")) return "Terlalu banyak permintaan. Silakan coba sebentar lagi.";
  if (errorMessage.includes("Menu not found")) return "Menu tidak ditemukan.";
  if (errorMessage.includes("Order not found")) return "Pesanan tidak ditemukan.";
  if (errorMessage.includes("no longer available") || errorMessage.includes("unavailable")) return "Item yang dipilih tidak tersedia atau stok habis.";
  if (errorMessage.includes("Choose at least one")) return "Pilih minimal satu item.";
  if (errorMessage.includes("invalid price")) return "Setiap item harus memiliki harga yang valid.";
  if (errorMessage.includes("Could not place your order")) return "Tidak dapat membuat pesanan.";
  if (errorMessage.includes("Could not cancel this order")) return "Tidak dapat membatalkan pesanan ini.";
  if (errorMessage.includes("Could not update the menu")) return "Tidak dapat memperbarui menu.";
  if (errorMessage.includes("Could not upload this image")) return "Tidak dapat mengunggah gambar ini.";
  if (errorMessage.includes("Could not update order-list visibility")) return "Tidak dapat memperbarui visibilitas daftar pesanan.";
  if (errorMessage.includes("Could not load this menu")) return "Tidak dapat memuat menu ini.";
  return errorMessage; // Fallback
}
