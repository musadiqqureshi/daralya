import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { requireSession } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { saleEditorProps } from "../editor-data";
import { SaleEditor } from "../sale-editor";

export default async function NewSalePage(props: PageProps<"/erp/sales/new">) {
  const session = await requireSession();
  if (!session.can("sales.create")) return <NoAccess />;
  const sp = await props.searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const editor = await saleEditorProps(session, locale, dict, typeof sp.customer === "string" ? sp.customer : undefined);
  return (
    <>
      <PageHeader back={{ href: "/erp/sales", label: dict.erp.sales.title }} title={dict.erp.sales.new} />
      <SaleEditor {...editor} />
    </>
  );
}
