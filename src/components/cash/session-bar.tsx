"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Lock, LockOpen } from "lucide-react";
import type { ActionState } from "@/actions/_session";
import type { EntryKind } from "@/domain/cash/entries";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { brl } from "@/components/ordering/format";
import { EntryForm } from "./entry-form";
import { sinceWhen } from "./format";
import { OpenForm } from "./open-form";
import type { CashBarView } from "./view";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Situação do caixa no topo da tela Caixa (spec 014, US1): fechado com **Abrir caixa**, ou aberto
 * com **Sangria**, **Reforço** e **Fechar caixa**. Quem só vê as contas (garçom) vê a situação sem
 * botões. O esperado só aparece para quem o servidor mandou (gerente): o caixa conta sem ver.
 */
export function SessionBar({
  cash,
  openAction,
  entryAction,
}: {
  cash: CashBarView;
  openAction: Action;
  entryAction: Action;
}) {
  const [form, setForm] = useState<"OPEN" | EntryKind | null>(null);
  const back = (
    <Button type="button" size="xl" variant="ghost" onClick={() => setForm(null)}>
      Voltar
    </Button>
  );
  const { session } = cash;

  if (!session)
    return (
      <Card className="grid gap-3" role="region" aria-label="Situação do caixa">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Lock aria-hidden="true" className="size-5 text-muted-foreground" />
            Caixa fechado
          </p>
          {cash.canOperate && form !== "OPEN" && (
            <Button type="button" size="xl" onClick={() => setForm("OPEN")}>
              Abrir caixa
            </Button>
          )}
        </div>
        {cash.canOperate && form === "OPEN" && (
          <OpenForm previousKept={cash.previousKept} action={openAction}>
            {back}
          </OpenForm>
        )}
      </Card>
    );

  const since = sinceWhen(session.openedAt, cash.serverNow, cash.timezone);
  const kind = form === "WITHDRAWAL" || form === "SUPPLY" ? form : null;
  return (
    <Card className="grid gap-3" role="region" aria-label="Situação do caixa">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <LockOpen aria-hidden="true" className="size-5 text-success" />
            <span>
              {session.openedByName
                ? `Caixa aberto desde ${since} · ${session.openedByName}`
                : `Caixa aberto desde ${since}`}
            </span>
          </p>
          {session.expected !== null && (
            <p className={session.expected.startsWith("-") ? "font-semibold text-destructive" : "text-sm"}>
              {`Dinheiro esperado na gaveta: ${brl(session.expected)}`}
            </p>
          )}
          {cash.canOperate && !cash.canClose && (
            <p className="text-sm text-muted-foreground">
              {`Só ${session.openedByName ?? "quem abriu"} ou o gerente fecha este caixa.`}
            </p>
          )}
        </div>
        {cash.canOperate && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="xl"
              variant="outline"
              aria-expanded={kind === "WITHDRAWAL"}
              onClick={() => setForm("WITHDRAWAL")}
            >
              <ArrowUpFromLine aria-hidden="true" />
              Sangria
            </Button>
            <Button
              type="button"
              size="xl"
              variant="outline"
              aria-expanded={kind === "SUPPLY"}
              onClick={() => setForm("SUPPLY")}
            >
              <ArrowDownToLine aria-hidden="true" />
              Reforço
            </Button>
            {cash.canClose && (
              <Link href="/caixa/fechar" className={buttonVariants({ size: "xl" })}>
                Fechar caixa
              </Link>
            )}
            <TextLink href={`/caixa/turnos/${session.id}`} className="px-2 py-3">
              Ver o turno
            </TextLink>
          </div>
        )}
      </div>
      {session.ageHours > 24 && (
        <Alert tone="warning">
          {`O caixa está aberto desde ${since}. Feche o caixa para conferir o turno.`}
        </Alert>
      )}
      {cash.canOperate && kind && (
        // A chave troca o formulário inteiro ao mudar de sangria para reforço: nada digitado vaza.
        <EntryForm key={kind} kind={kind} action={entryAction}>
          {back}
        </EntryForm>
      )}
    </Card>
  );
}
