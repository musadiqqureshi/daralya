import { ImageResponse } from "next/og";
import { getPublicProduct } from "@/lib/site/data";
import { BRAND, logoDataUri } from "@/lib/site/brand-art";
import { publicStorageUrl } from "@/lib/supabase/urls";

export const alt = "Dar Al-Aaliya Dates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/** Product link preview: photo on one side, logo and product name on the other. */
export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, logo] = await Promise.all([getPublicProduct(slug), logoDataUri()]);
  const photo = p ? publicStorageUrl("products", p.images[0]?.src) : null;
  // smaller crop for the preview (Unsplash URLs accept size params)
  const src = photo?.includes("images.unsplash.com") ? photo.replace(/w=\d+/, "w=700").replace(/q=\d+/, "q=70") : photo;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BRAND.palm, color: BRAND.cream }}>
        {src ? (
          <img src={src} width={560} height={630} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <div style={{ width: 560, height: 630, display: "flex", background: BRAND.palmDark }} />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 56px" }}>
          <img src={logo} width={180} height={110} alt="" />
          <div style={{ marginTop: 36, fontSize: 64, fontWeight: 700, lineHeight: 1.05, display: "flex" }}>{p?.name_en ?? "Dar Al-Aaliya Dates"}</div>
          {p && <div style={{ marginTop: 14, fontSize: 30, color: BRAND.gold, display: "flex" }}>{[p.variety, p.grade].filter(Boolean).join(" · ")}</div>}
          <div style={{ marginTop: 40, fontSize: 24, opacity: 0.75, display: "flex" }}>Dar Al-Aaliya Dates · dadmadinah.com</div>
        </div>
      </div>
    ),
    size,
  );
}
