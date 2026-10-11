import { ImageResponse } from "next/og";
import { BRAND, logoDataUri } from "@/lib/site/brand-art";

export const alt = "Dar Al-Aaliya Dates — Premium Saudi dates from Al-Awali, Madinah";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default link preview: logo, name and what we do. */
export default async function OpengraphImage() {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.palm} 0%, ${BRAND.palmDark} 100%)`, color: BRAND.cream, position: "relative" }}>
        <div style={{ position: "absolute", inset: 28, border: `2px solid ${BRAND.gold}55`, borderRadius: 28, display: "flex" }} />
        <img src={logo} width={330} height={201} alt="" />
        <div style={{ marginTop: 34, fontSize: 68, fontWeight: 700, letterSpacing: -1, display: "flex" }}>Dar Al-Aaliya Dates</div>
        <div style={{ marginTop: 14, fontSize: 30, color: BRAND.gold, display: "flex" }}>Premium Saudi dates · Wholesale &amp; retail</div>
        <div style={{ marginTop: 26, fontSize: 24, opacity: 0.75, display: "flex" }}>Al-Awali, Madinah · dadmadinah.com</div>
      </div>
    ),
    size,
  );
}
