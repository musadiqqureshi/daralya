import Link from "next/link";
import { Plus } from "lucide-react";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { SalesTable } from "@/components/erp/doc-tables";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { loadSales } from "@/lib/erp/loaders";
import { readRange } from "@/lib/erp/range";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function SalesPage(props: PageProps<"/erp/sales">) {
  const session = await requireSession();
  if (!session.can("sales.view") && !session.profile.driver_id) return <NoAccess />;
  const { from, to } = readRange(await props.searchParams);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const rows = await loadSales(await createClient(), locale, { from, to });
  return (
    <>
      <PageHeader
        title={session.can("sales.view_all") ? dict.erp.sales.title : dict.erp.nav.mySales}
        description={dict.erp.sales.subtitle}
        actions={
          session.can("sales.create") && (
            <Button asChild>
              <Link href={session.can("sales.view_all") ? "/erp/sales/new" : "/erp/pos"}>
                <Plus />
                {dict.erp.sales.new}
              </Link>
            </Button>
          )
        }
      />
      <SalesTable rows={rows} toolbar={<DateRangeFilter from={from} to={to} />} />
    </>
  );
}
