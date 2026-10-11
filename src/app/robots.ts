import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site/seo";

const PRIVATE = ["/erp", "/print", "/api"];

/** Public website open to search and AI answer engines; the ERP, print views and APIs stay private. */
export default function robots(): MetadataRoute.Robots {
  const answerEngines = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: answerEngines, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
