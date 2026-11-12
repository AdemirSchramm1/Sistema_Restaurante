"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/domain/billing/payment";
import { REOPEN_REASON_MAX } from "@/domain/billing/tab";
import { d } from "@/domain/shared/decimal";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { brl } from "@/components/ordering/format";
import { timeIn } from "./format";
import { TextLink } from "@/components/ui/text-link";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type ClosedTabView = {
  id: string;
  tableName: string;
  openedAt: string;
  closedAt: string;
  closedByName: string | null;
  subtotal: string;
  serviceCharge: string;
  total: string;
};

const money = (v: string) => brl(d(v));

/** Contas fechadas no período (spec 011, US6): resumo por forma de pagamento e a lista. */
export function TabsReport({
  tabs,
  summary,
  timezone,
}: {
  tabs: ClosedTabView[];
  summary: { byMethod: { method: PaymentMethod; amount: string }[]; serviceCharge: string; total: string };
  timezone: string;
}) {
  if (!tabs.length) return <p className="text-sm text-muted-foreground">Nenhuma conta fechada no período.</p>;
  const day = (at: string) => new Date(at).toLocaleDateString("pt-BR", { timeZone: timezone });
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_2fr]">
      <Card className="grid content-start gap-2">
        <section aria-label="Resumo do período">
          <CardTitle>Resumo do período</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tabs.length === 1 ? "1 conta fechada" : `${tabs.length} contas fechadas`}
          </p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {summary.byMethod.map((m) => (
                <tr key={m.method}>
                  <th scope="row" className="py-1 text-left font-normal">
                    {PAYMENT_METHOD_LABELS[m.method]}
                  </th>
                  <td className="py-1 text-right tabular-nums">{money(m.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">
                  Taxa de serviço
                </th>
                <td className="py-1 text-right tabular-nums">{money(summary.serviceCharge)}</td>
              </tr>
              <tr className="font-semibold">
                <th scope="row" className="py-1 text-left">
                  Total das contas
                </th>
                <td className="py-1 text-right tabular-nums">{money(summary.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </Card>
      <Table aria-label="Contas fechadas">
        <thead>
          <tr>
            <Th>Dia</Th>
            <Th>Mesa</Th>
            <Th>Abriu</Th>
            <Th>Fechou</Th>
            <Th>Quem fechou</Th>
            <Th className="text-right">Taxa</Th>
            <Th className="text-right">Total</Th>
          </tr>
        </thead>
        <tbody>
          {tabs.map((t) => (
            <tr key={t.id}>
              <Td>{day(t.closedAt)}</Td>
              <Td>
                <TextLink href={`/caixa/${t.id}`}>{`Mesa ${t.tableName}`}</TextLink>
              </Td>
              <Td>{timeIn(t.openedAt, timezone)}</Td>
              <Td>{timeIn(t.closedAt, timezone)}</Td>
              <Td>{t.closedByName ?? ""}</Td>
              <Td className="text-right tabular-nums">{money(t.serviceCharge)}</Td>
              <Td className="text-right tabular-nums">{money(t.total)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** "Reabrir conta" (só gerente): pede o motivo, que fica no histórico da conta. */
export function ReopenTabForm({ tab, action }: { tab: { id: string; version: number }; action: Action }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Reabrir conta
      </Button>
    );
  return (
    <ActionForm
      action={action}
      hidden={{ tabId: tab.id, version: tab.version }}
      submitLabel="Confirmar reabertura"
      className="grid gap-2"
      aria-label="Reabrir conta"
    >
      <label className="grid gap-1 text-sm font-medium">
        Motivo da reabertura
        <textarea
          name="reason"
          required
          maxLength={REOPEN_REASON_MAX}
          rows={2}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Voltar
      </Button>
    </ActionForm>
  );
}
