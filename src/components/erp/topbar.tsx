"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, LogOut, Search, UserRound } from "lucide-react";
import { signOut } from "@/app/erp/login/actions";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n/client";
import { ALL_NAV, QUICK_ACTIONS, visibleNav } from "./nav";

import type { Notice } from "./notices";

export function Topbar({ perms, user, notices }: { perms: string[]; user: { name: string; role: string }; notices: Notice[] }) {
  const { dict } = useI18n();
  const t = dict.erp;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // breadcrumbs: module + sub page
  const segs = pathname.split("/").filter(Boolean); // ["erp", "sales", "new"]
  const mod = ALL_NAV.find((n) => n.href !== "/erp" && pathname.startsWith(n.href));
  const sub = segs[2];
  const modLabel = (k: (typeof ALL_NAV)[number]["key"]) => (k === "sales" && !perms.includes("sales.view_all") ? t.nav.mySales : t.nav[k]);
  const subLabel = !sub ? null : sub === "new" ? dict.common.new : sub === "mark" ? t.attendance.mark : dict.common.details;

  const quickLabels: Record<(typeof QUICK_ACTIONS)[number]["key"], string> = {
    salesNew: t.sales.new,
    purchaseNew: t.purchases.new,
    attendance: t.attendance.mark,
    payment: t.cash.recordPayment,
    expense: t.expenses.new,
  };
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const totalNotices = notices.reduce((s, n) => s + n.count, 0);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md sm:px-5 print:hidden">
      <SidebarTrigger className="-ms-1 text-muted-foreground" />
      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/erp">{t.nav.dashboard}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {mod && (
            <>
              <BreadcrumbSeparator className="rtl:rotate-180" />
              <BreadcrumbItem>
                {subLabel ? (
                  <BreadcrumbLink asChild>
                    <Link href={mod.href}>{modLabel(mod.key)}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{modLabel(mod.key)}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </>
          )}
          {mod && subLabel && (
            <>
              <BreadcrumbSeparator className="rtl:rotate-180" />
              <BreadcrumbItem>
                <BreadcrumbPage>{subLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ms-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-gold-500/50 sm:w-64"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t.shell.searchPlaceholder}</span>
          <kbd className="ms-auto hidden rounded border bg-muted px-1.5 font-mono text-[0.68rem] sm:inline">⌘K</kbd>
        </button>

        <Popover>
          <PopoverTrigger className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t.shell.notifications}>
            <Bell className="size-[1.1rem]" />
            {totalNotices > 0 && (
              <span className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.62rem] font-bold text-white tabular-nums">
                {totalNotices > 99 ? "99+" : totalNotices}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <p className="border-b px-4 py-3 text-sm font-semibold">{t.shell.notifications}</p>
            {notices.length ? (
              <ul className="max-h-80 overflow-y-auto py-1">
                {notices.map((n) => (
                  <li key={n.key}>
                    <Link href={n.href} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" aria-hidden />
                      {n.text}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.shell.noNotifications}</p>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-muted sm:px-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-palm-800 text-xs font-bold text-gold-300">
              {user.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <span className="hidden text-start leading-tight md:block">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{dict.roles[user.role as keyof typeof dict.roles]}</span>
            </span>
            <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block font-semibold">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{dict.roles[user.role as keyof typeof dict.roles]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/erp/profile">
                <UserRound />
                {t.shell.profile}
              </Link>
            </DropdownMenuItem>
            <div className="px-1 py-0.5">
              <LanguageToggle className="w-full justify-start rounded-md px-2 py-1.5 hover:bg-muted" />
            </div>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut />
                  {dict.auth.signOut}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen} title={t.shell.searchPlaceholder} description={t.shell.searchHint}>
        <CommandInput placeholder={t.shell.searchPlaceholder} />
        <CommandList>
          <CommandEmpty>{dict.common.noResults}</CommandEmpty>
          {QUICK_ACTIONS.some((a) => perms.includes(a.perm)) && (
            <CommandGroup heading={t.shell.quickActions}>
              {QUICK_ACTIONS.filter((a) => perms.includes(a.perm)).map((a) => (
                <CommandItem key={a.key} onSelect={() => go(a.href)}>
                  <a.icon />
                  {quickLabels[a.key]}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {visibleNav(perms).map((g) => (
            <CommandGroup key={g.key} heading={t.nav.groups[g.key]}>
              {g.items.map((i) => (
                <CommandItem key={i.key} onSelect={() => go(i.href)}>
                  <i.icon />
                  {t.nav[i.key]}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </header>
  );
}
