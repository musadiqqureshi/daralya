"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/** Responsive repeating rows: a table on wide screens, stacked cards on phones. */
export function LineEditor<T>({
  lines,
  onAdd,
  onRemove,
  headers,
  renderCells,
  addLabel,
  footer,
}: {
  lines: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  headers: { label: string; className?: string }[];
  renderCells: (line: T, i: number) => React.ReactNode[];
  addLabel: string;
  footer?: React.ReactNode;
}) {
  const { dict } = useI18n();
  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2 text-center">#</th>
              {headers.map((h) => (
                <th key={h.label} className={`px-2 py-2 text-start font-semibold ${h.className ?? ""}`}>
                  {h.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="px-2 py-2.5 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                {renderCells(l, i).map((c, j) => (
                  <td key={j} className={`px-2 py-1.5 ${headers[j]?.className ?? ""}`}>
                    {c}
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(i)} disabled={lines.length === 1} aria-label={dict.erp.forms.removeLine}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t bg-muted/30">{footer}</tfoot>}
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {lines.map((l, i) => (
          <li key={i} className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(i)} disabled={lines.length === 1} aria-label={dict.erp.forms.removeLine}>
                <Trash2 />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {renderCells(l, i).map((c, j) => (
                <div key={j} className={j === 0 ? "col-span-2" : ""}>
                  <p className="mb-1 text-[0.7rem] font-medium text-muted-foreground">{headers[j]?.label}</p>
                  {c}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={onAdd}>
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}
