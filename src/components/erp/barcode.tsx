"use client";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 48, className }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height, displayValue: true, fontSize: 12, margin: 4, background: "transparent", lineColor: "#1f2420" });
    } catch {
      /* invalid content for the symbology — render nothing */
    }
  }, [value, height]);
  return <svg ref={ref} className={className} role="img" aria-label={value} />;
}
