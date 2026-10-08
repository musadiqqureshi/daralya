"use client";
import { Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { EmptyState } from "./empty-state";

export function NoAccess() {
  const { dict } = useI18n();
  return <EmptyState icon={Lock} title={dict.erp.shell.noAccessTitle} body={dict.erp.shell.noAccessBody} className="mt-10" />;
}
