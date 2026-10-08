import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { UrlTabs } from "@/components/erp/url-tabs";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { contentKeys, defaultContent, mergeContent, type SiteContentKey } from "@/lib/site/content";
import { createClient } from "@/lib/supabase/server";
import { InquiriesInbox, PortfolioManager, SectionEditor, type InquiryRow, type PortfolioRow } from "./website-ui";

export default async function WebsitePage(props: PageProps<"/erp/website">) {
  const session = await requireSession();
  if (!session.canAny("website.manage", "inquiries.view")) return <NoAccess />;
  const sp = await props.searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.erp.website;
  const supabase = await createClient();
  const canWeb = session.can("website.manage");
  const [{ data: content }, { data: products }, { data: images }, { data: inquiries }] = await Promise.all([
    canWeb ? supabase.from("site_content").select("key, draft, published, updated_at, published_at") : Promise.resolve({ data: [] }),
    canWeb ? supabase.from("products").select("id, slug, name_en, name_ar, variety, is_published, is_featured, is_active").eq("is_active", true).order("sort_order") : Promise.resolve({ data: [] }),
    canWeb ? supabase.from("product_images").select("product_id, src, sort_order").order("sort_order") : Promise.resolve({ data: [] }),
    session.can("inquiries.view") ? supabase.from("contact_inquiries").select("id, created_at, name, company, phone, email, category, message, status, internal_notes, locale, products(name_en, name_ar)").order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
  ]);
  const rows = new Map(((content ?? []) as { key: string; draft: unknown; published: unknown; updated_at: string; published_at: string | null }[]).map((r) => [r.key, r]));
  const img = new Map<string, string>();
  for (const i of images ?? []) if (!img.has(i.product_id)) img.set(i.product_id, i.src);
  const portfolio: PortfolioRow[] = (products ?? []).map((p) => ({ id: p.id, slug: p.slug, name: locale === "ar" ? p.name_ar : p.name_en, variety: p.variety, is_published: p.is_published, is_featured: p.is_featured, image: img.get(p.id) ?? null }));
  const inbox: InquiryRow[] = ((inquiries ?? []) as unknown as (InquiryRow & { products: { name_en: string; name_ar: string } | null })[]).map((q) => ({ ...q, product: q.products ? (locale === "ar" ? q.products.name_ar : q.products.name_en) : null }));
  const newCount = inbox.filter((q) => q.status === "new").length;

  const sectionTabs = canWeb
    ? contentKeys.map((key: SiteContentKey) => {
        const row = rows.get(key);
        const draft = row && row.draft && Object.keys(row.draft as object).length ? row.draft : row?.published;
        const value = mergeContent(defaultContent[key], draft);
        return {
          value: key,
          label: t.sections[key],
          content: (
            <SectionEditor
              key={`${key}-${row?.updated_at ?? "default"}`}
              sectionKey={key}
              initial={JSON.parse(JSON.stringify(value))}
              publishedAt={row?.published_at ?? null}
              updatedAt={row?.updated_at ?? null}
              dirtyVsPublished={Boolean(row && JSON.stringify(row.draft) !== JSON.stringify(row.published) && Object.keys((row.draft as object) ?? {}).length > 0)}
            />
          ),
        };
      })
    : [];

  return (
    <>
      <PageHeader title={t.title} description={t.subtitle} />
      <UrlTabs
        defaultTab={sp.tab === "inquiries" ? "inquiries" : canWeb ? "hero" : "inquiries"}
        tabs={[
          ...sectionTabs,
          ...(canWeb ? [{ value: "portfolio", label: t.portfolio, content: <PortfolioManager rows={portfolio} canEdit={canWeb} /> }] : []),
          ...(session.can("inquiries.view") ? [{ value: "inquiries", label: t.inquiries, count: newCount, content: <InquiriesInbox rows={inbox} /> }] : []),
        ]}
      />
    </>
  );
}
