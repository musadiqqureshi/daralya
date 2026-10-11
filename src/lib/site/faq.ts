import type { Locale } from "@/lib/i18n/config";
import type { SiteContent } from "./content";
import type { PublicProduct } from "./types";

/**
 * Common buyer questions, answered from the live website content and catalogue.
 * Shown on the homepage and published as FAQPage structured data for answer engines.
 */
export function buildFaq(content: SiteContent, products: PublicProduct[], locale: Locale): { q: string; a: string }[] {
  const ar = locale === "ar";
  const c = content.contact;
  const names = products.map((p) => (ar ? p.name_ar : p.name_en));
  const list = names.length ? names.join(ar ? "، " : ", ") : ar ? "تشكيلة من التمور السعودية" : "a range of Saudi dates";
  const reach = [c.phone && (ar ? `الهاتف ${c.phone}` : `phone ${c.phone}`), c.whatsapp && (ar ? `واتساب ${c.whatsapp}` : `WhatsApp ${c.whatsapp}`)].filter(Boolean).join(ar ? " أو " : " or ");
  return ar
    ? [
        { q: "أين تقع دار العالية للتمور؟", a: `نحن في ${c.address.ar}. ساعات العمل: ${c.hours.ar}.` },
        { q: "ما أنواع التمور التي تبيعونها؟", a: `نوفر حالياً: ${list}.` },
        { q: "هل تبيعون بالجملة والتجزئة؟", a: "نعم، نبيع بالجملة والتجزئة للأفراد والمحلات والفنادق والمناسبات." },
        { q: "كيف أطلب أو أعرف الأسعار؟", a: `تواصل معنا عبر ${reach}، أو أرسل طلب عرض سعر من صفحة التواصل، وسيرد فريقنا بالتوفر والأسعار.` },
        { q: "ما خيارات التعبئة المتوفرة؟", a: "نبيع سائباً بالكيلو، وفي علب وكراتين حسب الكمية المطلوبة." },
        { q: "كيف تحافظون على جودة التمور؟", a: "تُفرز تمورنا وتُصنف باحترافية وتُحفظ في مستودعات مبردة حتى التسليم." },
      ]
    : [
        { q: "Where is Dar Al-Aaliya Dates located?", a: `We are in ${c.address.en}. Opening days: ${c.hours.en}.` },
        { q: "Which date varieties do you sell?", a: `We currently supply: ${list}.` },
        { q: "Do you sell wholesale and retail?", a: "Yes. We sell both wholesale and retail — to individuals, shops, hotels and events." },
        { q: "How do I order or get prices?", a: `Contact us by ${reach}, or send a quotation request from the contact page and our team will reply with availability and pricing.` },
        { q: "What packaging options are available?", a: "Loose by the kilo, and in boxes and cartons depending on the quantity you need." },
        { q: "How do you keep the dates fresh?", a: "Our dates are professionally sorted and graded, then kept in cold storage until delivery." },
      ];
}
