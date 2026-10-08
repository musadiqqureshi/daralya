/**
 * Website content model. Every section is editable in ERP → Website Management.
 * These defaults render until the owner publishes their own text; they describe
 * the business only in general terms and make no certification or award claims.
 */

export type Bi = { en: string; ar: string };
export type Step = { title: Bi; body: Bi; image?: string };

export type SiteContent = {
  hero: { eyebrow: Bi; title: Bi; subtitle: Bi; primary: Bi; secondary: Bi; image: string; imageAlt: Bi };
  home: { introTitle: Bi; introBody: Bi; highlights: Step[]; process: Step[]; featuredImage: string };
  about: { title: Bi; body: Bi; mission: Bi; vision: Bi; quality: Bi; wholesale: Bi; sourcing: Bi; image: string; imageAlt: Bi };
  quality: { title: Bi; intro: Bi; steps: Step[]; image: string };
  contact: { phone: string; whatsapp: string; email: string; address: Bi; mapsUrl: string; hours: Bi };
  footer: { blurb: Bi };
  social: { instagram: string; x: string; tiktok: string; snapchat: string; facebook: string; youtube: string };
  seo: { title: Bi; description: Bi; ogImage: string };
};

export type SiteContentKey = keyof SiteContent;

const u = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const STOCK = {
  heroPlate: u("photo-1777891258071-45b4cee69360"),
  darkPlate: u("photo-1777891258039-970dd7e6e14c"),
  trays: u("photo-1777891258039-54963151d2d0"),
  palmDates: u("photo-1785531093420-bda3d739a932"),
  cluster: u("photo-1642073537056-20608544f111"),
  clusterGreen: u("photo-1783926066477-fde525140691"),
  bowl: u("photo-1629738601425-494c3d6ba3e2"),
  mixedRows: u("photo-1770617476915-7269d29d27dc"),
  mixedPile: u("photo-1771231591559-d19c89ad118a"),
  goldenPile: u("photo-1774857247287-d68599847107"),
  wrinkled: u("photo-1776669234669-52d5c29a5b94"),
  amber: u("photo-1773038831316-a2f5e52a56e4"),
  sukkari: u("photo-1775453585199-7605c46d6da1"),
};

export const defaultContent: SiteContent = {
  hero: {
    eyebrow: { en: "Madinah · Wholesale & retail", ar: "المدينة المنورة · جملة ومفرق" },
    title: { en: "Premium Dates. Authentic Quality. Trusted Heritage.", ar: "تمور فاخرة. جودة أصيلة. إرث موثوق." },
    subtitle: {
      en: "Discover carefully selected dates, professionally stored and supplied with a commitment to freshness, quality, and customer satisfaction.",
      ar: "اكتشف تموراً منتقاة بعناية، محفوظة باحتراف، ونوردها بالتزام بالطزاجة والجودة ورضا العملاء.",
    },
    primary: { en: "Explore Our Dates", ar: "استكشف تمورنا" },
    secondary: { en: "Contact Our Team", ar: "تواصل مع فريقنا" },
    image: STOCK.heroPlate,
    imageAlt: { en: "A plate of glossy dates on linen", ar: "طبق من التمور اللامعة على قماش كتان" },
  },
  home: {
    introTitle: { en: "Every variety, chosen with care", ar: "كل صنف يُختار بعناية" },
    introBody: {
      en: "Dar Al-Aaliya Dates supplies premium dates and nuts from Al-Awali in Madinah, for shops, hospitality and families — by the carton or by the kilogram.",
      ar: "تورّد دار العالية للتمور التمور والمكسرات الفاخرة من العوالي في المدينة المنورة، للمتاجر والضيافة والعائلات — بالكرتون أو بالكيلو.",
    },
    highlights: [
      { title: { en: "Selected varieties", ar: "أصناف مختارة" }, body: { en: "Ajwa, Sukkari, Safawi, Mabroom, Sugai, Anbar and more.", ar: "عجوة، سكري، صفاوي، مبروم، صقعي، عنبر وغيرها." } },
      { title: { en: "Cold storage", ar: "تخزين مبرد" }, body: { en: "Stock is kept in temperature-controlled storage to protect freshness.", ar: "نحفظ المخزون في مستودعات مبردة للحفاظ على الطزاجة." } },
      { title: { en: "Wholesale & retail", ar: "جملة ومفرق" }, body: { en: "Supply for shops, hotels, events and households.", ar: "توريد للمتاجر والفنادق والمناسبات والمنازل." } },
    ],
    process: [
      { title: { en: "Selection", ar: "الانتقاء" }, body: { en: "Dates are chosen by variety and quality on arrival.", ar: "تُنتقى التمور حسب الصنف والجودة عند وصولها." } },
      { title: { en: "Grading", ar: "الفرز والتصنيف" }, body: { en: "Each lot is sorted by size, texture and grade.", ar: "تُفرز كل دفعة حسب الحجم والقوام والدرجة." } },
      { title: { en: "Cold storage", ar: "التخزين المبرد" }, body: { en: "Batches are stored cool and tracked from receipt to sale.", ar: "تُحفظ الدفعات مبردة وتُتتبع من الاستلام حتى البيع." } },
      { title: { en: "Delivery", ar: "التوصيل" }, body: { en: "Orders are packed and delivered by our own drivers.", ar: "تُجهز الطلبات وتُوصل بواسطة سائقينا." } },
    ],
    featuredImage: STOCK.trays,
  },
  about: {
    title: { en: "A dates house built on care", ar: "دار للتمور قائمة على العناية" },
    body: {
      en: "Dar Al-Aaliya Dates is a dates and nuts trading business in Al-Awali, Madinah. We buy, store and supply a wide range of Saudi date varieties to wholesale and retail customers. Replace this text with your own company story in Website Management.",
      ar: "دار العالية للتمور منشأة لتجارة التمور والمكسرات في العوالي بالمدينة المنورة. نشتري ونخزن ونورد مجموعة واسعة من أصناف التمور السعودية لعملاء الجملة والمفرق. استبدل هذا النص بقصة شركتك من إدارة الموقع.",
    },
    mission: {
      en: "To supply dates our customers can trust — well chosen, well stored and fairly priced.",
      ar: "أن نورد تموراً يثق بها عملاؤنا — منتقاة جيداً ومحفوظة جيداً وبأسعار عادلة.",
    },
    vision: {
      en: "To be a dependable name for dates in Madinah and beyond.",
      ar: "أن نكون اسماً يُعتمد عليه في التمور بالمدينة المنورة وخارجها.",
    },
    quality: {
      en: "We check every lot on arrival, keep batches separate and record where each one goes.",
      ar: "نفحص كل دفعة عند وصولها، ونحفظ الدفعات منفصلة، ونسجل وجهة كل منها.",
    },
    wholesale: {
      en: "We serve shops, restaurants, hotels and event organisers with cartons and bulk weights, delivered by our own team.",
      ar: "نخدم المتاجر والمطاعم والفنادق ومنظمي المناسبات بالكراتين والأوزان الكبيرة، مع التوصيل بفريقنا.",
    },
    sourcing: {
      en: "Dates are sourced from growers and suppliers across the Kingdom and held in cold storage until dispatch.",
      ar: "نوفّر التمور من مزارعين وموردين في أنحاء المملكة ونحفظها في مستودعات مبردة حتى الشحن.",
    },
    image: STOCK.palmDates,
    imageAlt: { en: "Date palm laden with ripening dates", ar: "نخلة محملة بالتمور" },
  },
  quality: {
    title: { en: "Handled with care at every step", ar: "عناية في كل مرحلة" },
    intro: {
      en: "Freshness is protected from the moment dates arrive until they reach the customer.",
      ar: "نحافظ على طزاجة التمور منذ لحظة وصولها حتى تصل إلى العميل.",
    },
    steps: [
      { title: { en: "Handling", ar: "المناولة" }, body: { en: "Dates are received, inspected and moved with clean equipment.", ar: "تُستلم التمور وتُفحص وتُنقل بأدوات نظيفة." }, image: STOCK.cluster },
      { title: { en: "Grading", ar: "التصنيف" }, body: { en: "Lots are graded by variety, size and texture.", ar: "تُصنف الدفعات حسب الصنف والحجم والقوام." }, image: STOCK.mixedRows },
      { title: { en: "Packaging", ar: "التغليف" }, body: { en: "Packed in cartons and boxes suited to each customer.", ar: "تُعبأ في كراتين وعلب تناسب كل عميل." }, image: STOCK.trays },
      { title: { en: "Cold storage", ar: "التخزين المبرد" }, body: { en: "Kept in cold rooms; temperatures are logged.", ar: "تُحفظ في غرف تبريد وتُسجل درجات الحرارة." }, image: STOCK.goldenPile },
      { title: { en: "Inventory care", ar: "العناية بالمخزون" }, body: { en: "Every batch is tracked so older stock moves first.", ar: "تُتتبع كل دفعة ليخرج المخزون الأقدم أولاً." }, image: STOCK.amber },
      { title: { en: "Distribution", ar: "التوزيع" }, body: { en: "Orders are delivered by our drivers with proof of delivery.", ar: "تُوصل الطلبات بسائقينا مع إثبات التسليم." }, image: STOCK.clusterGreen },
    ],
    image: STOCK.darkPlate,
  },
  contact: {
    phone: "0550845703",
    whatsapp: "+966578004821",
    email: "",
    address: { en: "Al-Awali, Madinah, Saudi Arabia", ar: "العوالي، المدينة المنورة، المملكة العربية السعودية" },
    mapsUrl: "https://maps.google.com/?q=Al+Awali+Madinah",
    hours: { en: "Saturday – Thursday", ar: "السبت – الخميس" },
  },
  footer: {
    blurb: {
      en: "Premium dates and nuts — wholesale and retail — from Al-Awali, Madinah.",
      ar: "تمور ومكسرات فاخرة — جملة ومفرق — من العوالي بالمدينة المنورة.",
    },
  },
  social: { instagram: "", x: "", tiktok: "", snapchat: "", facebook: "", youtube: "" },
  seo: {
    title: { en: "Dar Al-Aaliya Dates — Premium Saudi Dates", ar: "دار العالية للتمور — تمور سعودية فاخرة" },
    description: {
      en: "Premium Saudi dates and nuts, wholesale and retail, from Al-Awali in Madinah.",
      ar: "تمور ومكسرات سعودية فاخرة بالجملة والمفرق من العوالي في المدينة المنورة.",
    },
    ogImage: STOCK.heroPlate,
  },
};

export const contentKeys = Object.keys(defaultContent) as SiteContentKey[];

/** Deep-merge published JSON over defaults so partial content never breaks a page. */
export function mergeContent<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base)) return (Array.isArray(patch) ? patch : base) as T;
  if (typeof base === "object" && base !== null && typeof patch === "object") {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      out[k] = k in out ? mergeContent(out[k], v) : v;
    }
    return out as T;
  }
  return (typeof patch === typeof base ? patch : base) as T;
}
