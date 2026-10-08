import type { erpEn } from "./erp-en";

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type ErpDict = Widen<typeof erpEn>;
