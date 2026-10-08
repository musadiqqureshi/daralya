"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n/client";
import { visibleNav, type NavKey } from "./nav";

export function AppSidebar({ perms, badges }: { perms: string[]; badges: Partial<Record<NavKey, number>> }) {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const { state, setOpenMobile } = useSidebar();
  const groups = visibleNav(perms);
  // a short menu (e.g. a salesman's) reads better without group headings
  const compact = groups.reduce((n, g) => n + g.items.length, 0) <= 6;
  const labelOf = (key: NavKey) => (key === "sales" && !perms.includes("sales.view_all") ? dict.erp.nav.mySales : dict.erp.nav[key]);
  const isActive = (href: string) => (href === "/erp" ? pathname === "/erp" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <Sidebar side={locale === "ar" ? "right" : "left"} collapsible="icon" className="border-none">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link href="/erp" className="flex items-center gap-2 overflow-hidden rounded-lg px-1.5 py-1" onClick={() => setOpenMobile(false)}>
          {state === "collapsed" ? (
            <LogoMark className="h-6 text-gold-500" />
          ) : (
            <Logo name={dict.common.brandShort} sub="ERP" tone="light" markClassName="h-8" />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-4">
        {groups.map((g) => (
          <SidebarGroup key={g.key} className="py-1.5">
            <SidebarGroupLabel hidden={compact} className="text-[0.68rem] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase rtl:tracking-normal rtl:text-xs">
              {dict.erp.nav.groups[g.key]}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = isActive(item.href);
                  const label = labelOf(item.key);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="h-10 text-[0.95rem] text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-cream data-[active=true]:shadow-[inset_3px_0_0_var(--color-gold-500)] rtl:data-[active=true]:shadow-[inset_-3px_0_0_var(--color-gold-500)]"
                      >
                        <Link href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}>
                          <item.icon className={active ? "text-gold-500" : "text-sidebar-foreground/60"} />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badges[item.key] ? (
                        <SidebarMenuBadge className="rounded-full bg-gold-500 px-1.5 text-[0.7rem] font-bold text-palm-950 tabular-nums">
                          {badges[item.key]}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={dict.erp.shell.viewSite} className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-cream">
              <Link href="/" target="_blank">
                <ExternalLink />
                <span>{dict.erp.shell.viewSite}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
