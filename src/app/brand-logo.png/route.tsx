import { ImageResponse } from "next/og";
import { BRAND, logoDataUri } from "@/lib/site/brand-art";

export const dynamic = "force-static";

/** 512×512 PNG logo for structured data (Google wants a raster logo) and the web manifest. */
export async function GET() {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.palm }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og */}
        <img src={logo} width={400} height={244} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
