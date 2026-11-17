import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { brl } from "@/components/ordering/format";
import { timeIn } from "@/components/billing/format";
import { OUTCOME_TONES, dayText, outcomeText } from "./format";
import type { SessionRowView } from "./view";

const who = (time: string, name: string | null) => (name ? `${time} · ${name}` : time);

/** Turnos do período (spec 014, US5): o dia leva ao relatório; o selo diz se o dinheiro bateu. */
export function SessionsList({ sessions, timezone }: { sessions: SessionRowView[]; timezone: string }) {
  if (!sessions.length)
    return (
      <EmptyState icon={CalendarClock} title="Nenhum turno neste período">
        Escolha outras datas ou abra o caixa na tela Caixa: cada abertura vira um turno aqui.
      </EmptyState>
    );
  return (
    <Table>
      <thead>
        <tr>
          <Th scope="col">Dia</Th>
          <Th scope="col">Abertura</Th>
          <Th scope="col">Fechamento</Th>
          <Th scope="col" numeric>
            Recebido
          </Th>
          <Th scope="col">Conferência</Th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id}>
            <Td>
              <TextLink href={`/caixa/turnos/${s.id}`} className="inline-flex min-h-11 items-center">
                {dayText(s.businessDay)}
              </TextLink>
            </Td>
            <Td>{who(timeIn(s.openedAt, timezone), s.openedByName)}</Td>
            <Td>{s.closedAt ? who(timeIn(s.closedAt, timezone), s.closedByName) : "Caixa aberto"}</Td>
            <Td numeric>{brl(s.received)}</Td>
            <Td>
              {s.result && s.difference ? (
                <Badge tone={OUTCOME_TONES[s.result]}>{outcomeText(s.result, s.difference)}</Badge>
              ) : (
                <Badge tone="warning">Aberto</Badge>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
