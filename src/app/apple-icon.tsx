import { ImageResponse } from "next/og";
import { BRAND, logoDataUri } from "@/lib/site/brand-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.palm }}>
        <img src={logo} width={140} height={85} alt="" />
      </div>
    ),
    size,
  );
}
