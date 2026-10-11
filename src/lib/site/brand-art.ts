import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const BRAND = { palm: "#173d32", palmDark: "#0f2a22", gold: "#c8a45d", cream: "#f7f2e8" };

/** The logo mark as a data URI in the given colour, for generated images. */
export async function logoDataUri(color = BRAND.gold) {
  const svg = (await readFile(join(process.cwd(), "public/brand/logo-mark.svg"), "utf8")).replace(/currentColor/g, color);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
