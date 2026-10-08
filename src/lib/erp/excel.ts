import "server-only";
import ExcelJS from "exceljs";

export type SheetCol = { header: string; key: string; width?: number; money?: boolean; number?: boolean };

/** Build a styled single-sheet workbook and return it as an .xlsx response. */
export async function excelResponse(filename: string, opts: { title: string; subtitle?: string; columns: SheetCol[]; rows: Record<string, unknown>[]; rtl?: boolean; totals?: Record<string, number> }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dar Al-Aaliya ERP";
  const ws = wb.addWorksheet("Report", { views: [{ rightToLeft: Boolean(opts.rtl), state: "frozen", ySplit: 4 }] });
  ws.mergeCells(1, 1, 1, Math.max(opts.columns.length, 1));
  ws.getCell(1, 1).value = opts.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF173D32" } };
  if (opts.subtitle) {
    ws.mergeCells(2, 1, 2, Math.max(opts.columns.length, 1));
    ws.getCell(2, 1).value = opts.subtitle;
    ws.getCell(2, 1).font = { color: { argb: "FF6B6A62" } };
  }
  const header = ws.getRow(4);
  opts.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173D32" } };
    cell.alignment = { vertical: "middle" };
    ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 4);
    if (c.money) ws.getColumn(i + 1).numFmt = "#,##0.00";
    else if (c.number) ws.getColumn(i + 1).numFmt = "#,##0.###";
  });
  opts.rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    opts.columns.forEach((c, i) => {
      const v = r[c.key];
      row.getCell(i + 1).value = c.money || c.number ? (v === null || v === undefined || v === "" ? null : Number(v)) : ((v as string | number | null) ?? "");
    });
  });
  if (opts.totals) {
    const row = ws.getRow(5 + opts.rows.length);
    opts.columns.forEach((c, i) => {
      if (c.key in opts.totals!) row.getCell(i + 1).value = opts.totals![c.key];
    });
    row.font = { bold: true };
    row.border = { top: { style: "thin", color: { argb: "FF173D32" } } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
