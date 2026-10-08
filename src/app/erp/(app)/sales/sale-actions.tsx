"use client";
import Link from "next/link";
import { Ban, HandCoins, MessageCircle, Printer, Receipt } from "lucide-react";
import { PaymentDialog, type PayDoc } from "@/components/erp/payment-dialog";
import { ReasonDialog } from "@/components/erp/reason-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { ReturnDialog, type ReturnLine } from "../purchases/return-dialog";
import { cancelSale, returnSale } from "./actions";

export function SaleActions({
  id,
  customer,
  doc,
  lines,
  whatsapp,
  canCollect,
  canRefund,
  canReturn,
  canCancel,
  shareText,
}: {
  id: string;
  customer: { id: string; label: string };
  doc: PayDoc | null;
  lines: ReturnLine[];
  whatsapp: string | null;
  canCollect: boolean;
  canRefund: boolean;
  canReturn: boolean;
  canCancel: boolean;
  shareText: string;
}) {
  const { dict } = useI18n();
  const t = dict.erp;
  const wa = whatsapp?.replace(/\D/g, "");
  return (
    <>
      <Button asChild variant="outline">
        <Link href={`/print/invoice/${id}`} target="_blank">
          <Printer />
          {dict.common.printA4}
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/print/invoice/${id}?format=receipt`} target="_blank">
          <Receipt />
          {dict.common.printReceipt}
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon" aria-label="WhatsApp">
        <a href={`https://wa.me/${wa ?? ""}?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
        </a>
      </Button>
      {(canCollect || canRefund) && (doc || canRefund) && (
        <PaymentDialog
          purposes={[...(canCollect && doc ? (["customer_receipt"] as const) : []), ...(canRefund ? (["customer_refund"] as const) : [])]}
          party={customer}
          docs={doc ? [doc] : undefined}
          defaultAmount={doc?.outstanding}
          title={t.customers.receivePayment}
          trigger={
            <Button>
              <HandCoins />
              {t.customers.receivePayment}
            </Button>
          }
        />
      )}
      {canReturn && (
        <ReturnDialog
          title={t.sales.returnTitle}
          lines={lines}
          onSubmit={(v) => returnSale({ sale_id: id, date: v.date, reason: v.reason, lines: v.lines.map((l) => ({ sale_item_id: l.id, qty: l.qty })) })}
        />
      )}
      {canCancel && (
        <ReasonDialog
          title={t.sales.cancelTitle}
          description={t.sales.cancelHint}
          onConfirm={(reason) => cancelSale(id, reason)}
          trigger={
            <Button variant="destructive">
              <Ban />
              {dict.common.cancel}
            </Button>
          }
        />
      )}
    </>
  );
}
