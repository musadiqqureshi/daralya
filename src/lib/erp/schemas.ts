import { z } from "zod";

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const money = z.coerce.number().finite().min(0).max(1_000_000_000);
export const qty = z.coerce.number().finite().positive().max(10_000_000);

export const PURPOSES = [
  "customer_receipt",
  "customer_refund",
  "supplier_payment",
  "supplier_refund",
  "driver_commission",
  "salary",
  "salary_advance",
  "investor_capital_in",
  "investor_capital_return",
  "investor_profit",
] as const;
