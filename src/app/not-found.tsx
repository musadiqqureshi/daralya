import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const dict = await getDictionary();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream px-6 text-center">
      <LogoMark className="h-14 text-palm-800" />
      <p className="font-display text-7xl font-semibold text-palm-900">404</p>
      <p className="text-lg text-muted-foreground">{dict.common.notFound}</p>
      <Link href="/" className="rounded-full bg-palm-800 px-6 py-3 font-semibold text-cream hover:bg-palm-700">
        {dict.site.nav.home}
      </Link>
    </main>
  );
}
