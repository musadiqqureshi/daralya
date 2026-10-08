import "server-only";
import { getLocale } from "@/lib/i18n/server";

/**
 * Database functions raise English messages written for people. In the Arabic
 * interface we translate the known ones (values captured in groups are kept).
 */
const AR: [RegExp, string][] = [
  [/^You do not have permission to do this\.?$/, "ليست لديك صلاحية لتنفيذ هذا الإجراء."],
  [/^Insufficient stock for (.+) in the selected storage \(short by (.+)\)\.$/, "المخزون غير كافٍ من $1 في المستودع المختار (ينقص $2)."],
  [/^Storage (.+) would exceed its capacity \((.+) kg of (.+) kg\)\.$/, "المستودع $1 سيتجاوز سعته ($2 كجم من $3 كجم)."],
  [/^A reason of at least 3 characters is required\.$/, "السبب مطلوب (٣ أحرف على الأقل)."],
  [/^Add at least one (product|product line|line|product to transfer)\.$/, "أضف بنداً واحداً على الأقل."],
  [/^Customer not found or inactive\.$/, "العميل غير موجود أو غير نشط."],
  [/^Supplier not found or inactive\.$/, "المورد غير موجود أو غير نشط."],
  [/^Storage not found or inactive\.$/, "المستودع غير موجود أو غير نشط."],
  [/^Choose two different (storages|active accounts)\.$/, "اختر عنصرين مختلفين."],
  [/^Enter (a payment amount|an amount) above zero\.$/, "أدخل مبلغاً أكبر من صفر."],
  [/^Choose a payment method\.$/, "اختر طريقة الدفع."],
  [/^Choose a cash or bank account\.$/, "اختر حساب النقدية أو البنك."],
  [/^Not enough cash in (.+) for this (payment|expense)\.$/, "النقدية في $1 غير كافية."],
  [/^Not enough balance in (.+) for this transfer\.$/, "الرصيد في $1 غير كافٍ لهذا التحويل."],
  [/^Allocation exceeds the outstanding amount \((.+)\)\.$/, "التوزيع يتجاوز المبلغ المتبقي ($1)."],
  [/^Payment cannot exceed the invoice total\.$/, "لا يمكن أن تتجاوز الدفعة إجمالي الفاتورة."],
  [/^Price for (.+) is below the list price; you need price-override permission\.$/, "سعر $1 أقل من سعر القائمة؛ تحتاج صلاحية تجاوز السعر."],
  [/^This sale takes (.+) over their credit limit of (.+)\.$/, "هذه الفاتورة تتجاوز حد الائتمان للعميل $1 ($2)."],
  [/^Cannot return more than was (sold|received) \((.+) left\)\.$/, "لا يمكن إرجاع أكثر من الكمية ($2 متبقية)."],
  [/^Enter a quantity to return\.$/, "أدخل كمية للإرجاع."],
  [/^This (invoice|purchase) has returns and cannot be cancelled\.$/, "يوجد مرتجعات على هذا المستند ولا يمكن إلغاؤه."],
  [/^Cancel the payments linked to this (invoice|purchase) first\.$/, "ألغِ الدفعات المرتبطة بهذا المستند أولاً."],
  [/^(.+) already checked in today at (.+)\.$/, "$1 سجّل حضوره اليوم الساعة $2."],
  [/^(.+) already checked out at (.+)\.$/, "$1 سجّل انصرافه الساعة $2."],
  [/^(.+) has not checked in today\.$/, "$1 لم يسجل حضوره اليوم."],
  [/^The attendance photo was not received\. Capture it again\.$/, "لم تُستلم صورة الحضور. التقطها مرة أخرى."],
  [/^Manual attendance needs a reason.*$/, "التسجيل اليدوي يحتاج إلى سبب (مثل: الكاميرا غير متاحة)."],
  [/^Employee not found or not active\.$/, "الموظف غير موجود أو غير نشط."],
  [/^A payroll run already covers part of this period\.$/, "يوجد مسير رواتب يغطي جزءاً من هذه الفترة."],
  [/^Only draft (payroll lines|payroll runs|allocations) can be (edited|approved|cancelled).*$/, "يمكن تعديل المسودات فقط."],
  [/^Advance recovery cannot exceed the outstanding advance \((.+)\)\.$/, "لا يمكن أن يتجاوز استرداد السلفة الرصيد المتبقي ($1)."],
  [/^Add a delivery photo or the customer signature before marking delivered\.$/, "أضف صورة التسليم أو توقيع العميل قبل تأكيد التسليم."],
  [/^This record already exists\.$/, "هذا السجل موجود مسبقاً."],
  [/^Something went wrong\. Please try again\.$/, "حدث خطأ ما. حاول مرة أخرى."],
];

export async function translateDbError(message: string) {
  if ((await getLocale()) !== "ar") return message;
  for (const [re, ar] of AR) if (re.test(message)) return message.replace(re, ar);
  return message;
}
