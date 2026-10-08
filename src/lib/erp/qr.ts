import "server-only";
import QRCode from "qrcode";

export async function qrSvg(text: string, size = 96) {
  return QRCode.toString(text, { type: "svg", margin: 0, width: size, errorCorrectionLevel: "M", color: { dark: "#1f2420", light: "#ffffff00" } });
}
