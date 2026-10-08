import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  CalendarCheck,
  ClipboardList,
  Contact,
  Factory,
  Globe,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Snowflake,
  Truck,
  UserRound,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ErpDict } from "@/lib/i18n/dictionaries/erp-types";

export type NavKey = keyof Omit<ErpDict["nav"], "groups">;
export type NavItem = { key: NavKey; href: string; icon: LucideIcon; perms: string[] };
export type NavGroup = { key: keyof ErpDict["nav"]["groups"]; items: NavItem[] };

/** Sidebar structure. An item shows when the user holds any of its permissions. */
export const NAV: NavGroup[] = [
  { key: "overview", items: [{ key: "dashboard", href: "/erp", icon: LayoutDashboard, perms: ["dashboard.view"] }] },
  {
    key: "trade",
    items: [
      { key: "customers", href: "/erp/customers", icon: Contact, perms: ["customers.view"] },
      { key: "suppliers", href: "/erp/suppliers", icon: Factory, perms: ["suppliers.view"] },
      { key: "products", href: "/erp/products", icon: Package, perms: ["products.view"] },
      { key: "purchases", href: "/erp/purchases", icon: ShoppingCart, perms: ["purchases.view"] },
      { key: "sales", href: "/erp/sales", icon: Receipt, perms: ["sales.view"] },
    ],
  },
  {
    key: "stock",
    items: [
      { key: "inventory", href: "/erp/inventory", icon: Boxes, perms: ["inventory.view"] },
      { key: "storage", href: "/erp/storage", icon: Snowflake, perms: ["inventory.view", "storage.manage"] },
      { key: "batches", href: "/erp/batches", icon: ScanLine, perms: ["inventory.view"] },
    ],
  },
  {
    key: "logistics",
    items: [
      { key: "drivers", href: "/erp/drivers", icon: UserRound, perms: ["drivers.view", "commissions.own"] },
      { key: "deliveries", href: "/erp/deliveries", icon: Truck, perms: ["deliveries.view", "deliveries.own"] },
    ],
  },
  {
    key: "people",
    items: [
      { key: "staff", href: "/erp/staff", icon: Users, perms: ["employees.view"] },
      { key: "attendance", href: "/erp/attendance", icon: CalendarCheck, perms: ["attendance.view", "attendance.mark"] },
      { key: "payroll", href: "/erp/payroll", icon: WalletCards, perms: ["payroll.view"] },
    ],
  },
  {
    key: "finance",
    items: [
      { key: "expenses", href: "/erp/expenses", icon: BadgeDollarSign, perms: ["expenses.view"] },
      { key: "cash", href: "/erp/cash", icon: Wallet, perms: ["accounts.view", "payments.view"] },
      { key: "investors", href: "/erp/investors", icon: HandCoins, perms: ["investors.view"] },
      { key: "reports", href: "/erp/reports", icon: BarChart3, perms: ["reports.view", "reports.financial"] },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "website", href: "/erp/website", icon: Globe, perms: ["website.manage", "inquiries.view"] },
      { key: "users", href: "/erp/users", icon: ShieldCheck, perms: ["users.manage"] },
      { key: "settings", href: "/erp/settings", icon: Settings, perms: ["settings.manage"] },
      { key: "audit", href: "/erp/audit", icon: ScrollText, perms: ["audit.view"] },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV.flatMap((g) => g.items);

export function visibleNav(perms: Set<string> | string[]) {
  const has = (p: string) => (perms instanceof Set ? perms.has(p) : perms.includes(p));
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.perms.some(has)) })).filter((g) => g.items.length);
}

export const QUICK_ACTIONS: { href: string; perm: string; key: "salesNew" | "purchaseNew" | "attendance" | "payment" | "expense"; icon: LucideIcon }[] = [
  { href: "/erp/sales/new", perm: "sales.create", key: "salesNew", icon: Receipt },
  { href: "/erp/purchases/new", perm: "purchases.create", key: "purchaseNew", icon: ShoppingCart },
  { href: "/erp/attendance/mark", perm: "attendance.mark", key: "attendance", icon: CalendarCheck },
  { href: "/erp/cash?new=payment", perm: "payments.create", key: "payment", icon: ClipboardList },
  { href: "/erp/expenses?new=1", perm: "expenses.create", key: "expense", icon: BadgeDollarSign },
];
