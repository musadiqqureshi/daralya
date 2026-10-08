"use client";
import { Ban, HandCoins } from "lucide-react";
import type { PayDoc } from "@/components/erp/payment-dialog";
import { PaymentDialog } from "@/components/erp/payment-dialog";
import { ReasonDialog } from "@/components/erp/reason-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cancelPurchase, returnPurchase } from "./actions";
import { ReturnDialog, type ReturnLine } from "./return-dialog";

export function PurchaseActions({
  id,
  supplier,
  doc,
  lines,
  canPay,
  canReturn,
  canCancel,
}: {
  id: string;
  supplier: { id: string; label: string };
  doc: PayDoc | null;
  lines: ReturnLine[];
  canPay: boolean;
  canReturn: boolean;
  canCancel: boolean;
}) {
  const { dict } = useI18n();
  const t = dict.erp;
  return (
    <>
      {canPay && doc && (
        <PaymentDialog
          purposes={["supplier_payment"]}
          party={supplier}
          docs={[doc]}
          defaultAmount={doc.outstanding}
          title={t.suppliers.pay}
          trigger={
            <Button>
              <HandCoins />
              {t.suppliers.pay}
            </Button>
          }
        />
      )}
      {canReturn && (
        <ReturnDialog
          title={t.purchases.returnTitle}
          lines={lines}
          onSubmit={(v) => returnPurchase({ purchase_id: id, date: v.date, reason: v.reason, lines: v.lines.map((l) => ({ purchase_item_id: l.id, qty: l.qty })) })}
        />
      )}
      {canCancel && (
        <ReasonDialog
          title={t.purchases.cancelTitle}
          description={t.purchases.cancelHint}
          onConfirm={(reason) => cancelPurchase(id, reason)}
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
