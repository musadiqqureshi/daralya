"use client";
import { useEffect } from "react";
import { syncSessionTimeout } from "@/app/erp/session-actions";

export function SessionTimeoutSync({ minutes, current }: { minutes: number; current: number | null }) {
  useEffect(() => {
    if (current !== minutes) void syncSessionTimeout(minutes);
  }, [minutes, current]);
  return null;
}
