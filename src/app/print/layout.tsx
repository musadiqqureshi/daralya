import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#ece7dc] py-6 print:bg-white print:py-0">{children}</div>;
}
