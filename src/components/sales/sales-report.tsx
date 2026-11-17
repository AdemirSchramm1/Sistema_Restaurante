import { Download, ShoppingBag } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@/domain/billing/payment";
import { d } from "@/domain/shared/decimal";
import { outcomeOf } from "@/domain/cash/session";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { brl } from "@/components/ordering/format";
import { outcomeText } from "@/components/cash/format";
import { SessionsList } from "@/components/cash/sessions-list";
import type { MethodAmountView, SessionRowView } from "@/components/cash/view";

/** Relatório de vendas como a tela recebe: dinheiro em texto com 2 casas, parte com 1 casa. */
export type SalesReportView = {
  from: string;
  to: string;
  timezone: string;
  byMethod: MethodAmountView[];
  removedFromOtherSessions: MethodAmountView[];
  received: string;
  serviceCharge: string;
  products: { recipeId: string; name: string; quantity: number; amount: string; share: string }[];
  productsTotal: string;
  addons: { addonId: string; name: string; times: number; amount: string }[];
  sessions: SessionRowView[];
  differenceTotal: string;
  pendingOrders: number;
};

const pendingText = (n: number) =>
  n === 1
    ? "1 pedido do período ainda não foi entregue. Ele já conta nas vendas."
    : `${n} pedidos do período ainda não foram entregues. Eles já contam nas vendas.`;

const share = (v: string) => `${v.replace(".", ",")}%`;

/**
 * Vendas (spec 014, US6): o recebido por forma (soma dos turnos), o que foi vendido por produto e
 * por adicional (pelo dia do pedido) e os turnos do período. Só o gerente vê.
 */
export function SalesReportPage({ report: r }: { report: SalesReportView }) {
  const difference = d(r.differenceTotal);
  return (
    <div className="grid gap-4">
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="de">De</Label>
          <Input id="de" type="date" name="de" defaultValue={r.from} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" type="date" name="ate" defaultValue={r.to} />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        <a
          href={`/vendas/planilha?de=${r.from}&ate=${r.to}`}
          className={buttonVariants({ variant: "ghost" })}
          download
        >
          <Download aria-hidden="true" />
          Baixar planilha
        </a>
      </form>

      {r.pendingOrders > 0 && <Alert tone="warning">{pendingText(r.pendingOrders)}</Alert>}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="grid gap-3">
          <CardTitle id="sales-methods">Recebido por forma de pagamento</CardTitle>
          <Table aria-labelledby="sales-methods">
            <thead>
              <tr>
                <Th scope="col">Forma</Th>
                <Th scope="col" numeric>
                  Valor
                </Th>
              </tr>
            </thead>
            <tbody>
              {r.byMethod.map((m) => (
                <tr key={m.method}>
                  <Td>{PAYMENT_METHOD_LABELS[m.method]}</Td>
                  <Td numeric>{brl(m.amount)}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>Total recebido</Td>
                <Td numeric>{brl(r.received)}</Td>
              </tr>
              <tr>
                <Td>Taxa de serviço das contas fechadas</Td>
                <Td numeric>{brl(r.serviceCharge)}</Td>
              </tr>
            </tbody>
          </Table>
          {r.removedFromOtherSessions.map((m) => (
            <p key={m.method} className="text-sm text-muted-foreground">
              {`${PAYMENT_METHOD_LABELS[m.method]} tirados de turnos anteriores: ${brl(m.amount)}`}
            </p>
          ))}
        </Card>

        <Card className="grid gap-3">
          <CardTitle id="sales-products">Vendas por produto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recebido conta o dinheiro que entrou nos turnos; vendas contam os pedidos feitos no período. Uma
            conta aberta à noite e paga depois da meia-noite aparece em dias diferentes.
          </p>
          {r.products.length ? (
            <Table aria-labelledby="sales-products">
              <thead>
                <tr>
                  <Th scope="col">Produto</Th>
                  <Th scope="col" numeric>
                    Quantidade
                  </Th>
                  <Th scope="col" numeric>
                    Valor
                  </Th>
                  <Th scope="col" numeric>
                    Parte
                  </Th>
                </tr>
              </thead>
              <tbody>
                {r.products.map((p) => (
                  <tr key={p.recipeId}>
                    <Td>{p.name}</Td>
                    <Td numeric>{p.quantity}</Td>
                    <Td numeric>{brl(p.amount)}</Td>
                    <Td numeric>{share(p.share)}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total dos produtos</Td>
                  <Td numeric />
                  <Td numeric>{brl(r.productsTotal)}</Td>
                  <Td numeric />
                </tr>
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={ShoppingBag} title="Nenhuma venda neste período">
              Os pedidos feitos nas mesas aparecem aqui pelo dia em que foram feitos.
            </EmptyState>
          )}
          {r.addons.length > 0 && (
            <>
              <h3 id="sales-addons" className="font-semibold">
                Adicionais vendidos
              </h3>
              <Table aria-labelledby="sales-addons">
                <thead>
                  <tr>
                    <Th scope="col">Adicional</Th>
                    <Th scope="col" numeric>
                      Vezes
                    </Th>
                    <Th scope="col" numeric>
                      Valor
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {r.addons.map((a) => (
                    <tr key={a.addonId}>
                      <Td>{a.name}</Td>
                      <Td numeric>{a.times}</Td>
                      <Td numeric>{brl(a.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Card>
      </div>

      <section className="grid gap-3" aria-labelledby="sales-sessions">
        <h2 id="sales-sessions" className="text-lg font-semibold">
          Turnos do período
        </h2>
        <SessionsList sessions={r.sessions} timezone={r.timezone} />
        {r.sessions.length > 0 && (
          <p className="font-medium">
            {`Soma das diferenças: ${outcomeText(outcomeOf(difference), r.differenceTotal)}`}
          </p>
        )}
      </section>
    </div>
  );
}
