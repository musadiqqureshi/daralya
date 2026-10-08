import Link from "next/link";
import { Plus } from "lucide-react";
import { DateRangeFilter } from "@/components/erp/date-range-filter";
import { PurchasesTable } from "@/components/erp/doc-tables";
import { NoAccess } from "@/components/erp/no-access";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { loadPurchases } from "@/lib/erp/loaders";
import { readRange } from "@/lib/erp/range";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export default async function PurchasesPage(props: PageProps<"/erp/purchases">) {
  const session = await requireSession();
  if (!session.can("purchases.view")) return <NoAccess />;
  const { from, to } = readRange(await props.searchParams);
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const rows = await loadPurchases(await createClient(), locale, { from, to });
  return (
    <>
      <PageHeader
        title={dict.erp.purchases.title}
        description={dict.erp.purchases.subtitle}
        actions={
          session.can("purchases.create") && (
            <Button asChild>
              <Link href="/erp/purchases/new">
                <Plus />
                {dict.erp.purchases.new}
              </Link>
            </Button>
          )
        }
      />
      <PurchasesTable rows={rows} toolbar={<DateRangeFilter from={from} to={to} />} />
    </>
  );
}
