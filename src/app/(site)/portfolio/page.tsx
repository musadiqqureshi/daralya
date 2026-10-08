import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/site/page-header";
import { PortfolioBrowser } from "@/components/site/portfolio-browser";
import { getDictionary } from "@/lib/i18n/server";
import { getPublicProducts } from "@/lib/site/data";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.site.portfolio.title, description: dict.site.portfolio.intro };
}

export default async function PortfolioPage() {
  const [dict, products] = await Promise.all([getDictionary(), getPublicProducts()]);
  return (
    <>
      <PageHeader eyebrow={dict.site.portfolio.eyebrow} title={dict.site.portfolio.title} intro={dict.site.portfolio.intro} />
      <section className="container-site pb-24">
        <Suspense>
          <PortfolioBrowser products={products} />
        </Suspense>
      </section>
    </>
  );
}
