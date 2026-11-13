import type * as React from "react";
import { cn } from "@/lib/utils";

/** Tabela do padrão (spec 012): cabeçalho em `muted`, realce da linha ao passar o mouse. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table
        className={cn(
          "w-full text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

type Cell = { numeric?: boolean };

export function Th({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & Cell) {
  return (
    <th
      className={cn(
        "bg-muted px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/** `numeric`: valores e quantidades, alinhados à direita com números tabulares. */
export function Td({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & Cell) {
  return (
    <td
      className={cn(
        "border-t border-border px-3 py-2.5 align-top",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
