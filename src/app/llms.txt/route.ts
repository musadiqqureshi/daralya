import { getPublicProducts, getSiteContent } from "@/lib/site/data";
import { SITE_URL } from "@/lib/site/seo";
import { buildFaq } from "@/lib/site/faq";

export const revalidate = 3600;

/** Plain-language summary for AI assistants and answer engines (llmstxt.org). */
export async function GET() {
  const [content, products] = await Promise.all([getSiteContent(), getPublicProducts()]);
  const c = content.contact;
  const faq = buildFaq(content, products, "en");
  const body = `# Dar Al-Aaliya Dates (دار العالية للتمور)

> ${content.footer.blurb.en} Supplier of premium Saudi dates and nuts, wholesale and retail, based in ${c.address.en}.

- Owner: Muhammad Rehan (محمد ريحان)
- Website: ${SITE_URL} (English) · ${SITE_URL}/?lang=ar (Arabic)
- Location: ${c.address.en} — ${c.mapsUrl}
${c.phone ? `- Phone: ${c.phone}\n` : ""}${c.whatsapp ? `- WhatsApp: ${c.whatsapp} (https://wa.me/${c.whatsapp.replace(/[^\d]/g, "")})\n` : ""}${c.email ? `- Email: ${c.email}\n` : ""}- Opening days: ${c.hours.en}

## Pages

- [Home](${SITE_URL}/): who we are and the varieties we supply
- [Our Dates](${SITE_URL}/portfolio): full product portfolio
- [About Us](${SITE_URL}/about): mission, sourcing and wholesale
- [Quality](${SITE_URL}/quality): sorting, grading and cold storage
- [Contact](${SITE_URL}/contact): quotation requests, phone and WhatsApp

## Products

${products.map((p) => `- [${p.name_en} (${p.name_ar})](${SITE_URL}/portfolio/${p.slug}): ${[p.variety, p.grade].filter(Boolean).join(", ")}${p.description_en ? ` — ${p.description_en}` : ""}`).join("\n")}

## Frequently asked questions

${faq.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
