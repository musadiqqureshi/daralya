"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; sub?: string; keywords?: string[]; disabled?: boolean };

/** Searchable select for long lists (customers, products, employees …). */
export function EntitySelect({
  options,
  value,
  onChange,
  placeholder,
  id,
  clearable = false,
  disabled,
  className,
  invalid,
}: {
  options: Option[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  id?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
}) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-start text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected ? (
            <>
              {selected.label}
              {selected.sub && <span className="ms-1.5 text-xs text-muted-foreground">{selected.sub}</span>}
            </>
          ) : (
            placeholder ?? dict.erp.forms.select
          )}
        </span>
        {clearable && selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={dict.common.remove}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onChange(null);
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </span>
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command filter={(v, search, keywords) => ((v + " " + (keywords ?? []).join(" ")).toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={dict.erp.forms.searchSelect} />
          <CommandList>
            <CommandEmpty>{dict.erp.forms.noOptions}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.sub ?? ""} ${o.value}`}
                  keywords={o.keywords}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.sub && <span className="text-xs text-muted-foreground">{o.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
