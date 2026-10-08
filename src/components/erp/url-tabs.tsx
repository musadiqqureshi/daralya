"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Tabs whose selection lives in ?tab= so links and refreshes keep the view. */
export function UrlTabs({ tabs, defaultTab, param = "tab" }: { tabs: { value: string; label: React.ReactNode; content: React.ReactNode; count?: number }[]; defaultTab?: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? defaultTab ?? tabs[0]?.value;
  return (
    <Tabs
      value={current}
      onValueChange={(v) => {
        const next = new URLSearchParams(sp.toString());
        next.set(param, v);
        router.replace(`${pathname}?${next}`, { scroll: false });
      }}
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-1 print:hidden">
        <TabsList className="h-auto w-max gap-1 bg-muted/70 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3 py-1.5 data-[state=active]:shadow-sm">
              {t.label}
              {t.count ? <span className="ms-1.5 rounded-full bg-gold-500/25 px-1.5 text-[0.68rem] font-bold text-gold-700 tabular-nums">{t.count}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
