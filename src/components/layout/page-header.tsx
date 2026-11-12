import type * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Cabeçalho de toda tela da equipe (spec 012, US3): voltar (opcional), título em serifa como `h1`,
 * etiquetas ao lado, descrição curta e ações à direita (embaixo do título no celular).
 */
export function PageHeader({
  title,
  description,
  actions,
  badges,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="grid gap-2">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-3xl">
              {title}
            </h1>
            {badges}
          </div>
          {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
