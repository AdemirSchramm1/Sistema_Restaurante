import { Download, ScrollText } from "lucide-react";
import type { AuditRow } from "@/application/ports";
import { OPERATION_TYPES, OPERATION_TYPE_LABELS } from "@/domain/audit/operation-types";
import { AUDIT_PAGE_SIZE } from "@/domain/audit/audit-filter";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Input, Label, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { changeLines, entryLabel, operationLabel, recordHref, recordName, whoDid } from "./entry-labels";

export type AuditQuery = { de: string; ate: string; pessoa: string; tipo: string; negadas: boolean };

export type AuditReportProps = {
  /** Os filtros como vieram do endereço (mesmo inválidos, para a pessoa corrigir). */
  query: AuditQuery;
  /** Todos os membros, ativos ou não. */
  people: { userId: string; name: string }[];
  timezone: string;
  page: number;
  total: number;
  rows: AuditRow[];
  error: "INVALID_PERIOD" | null;
};

/** Link dentro da tabela com área de toque de 44 px (spec 012, US6.5). */
const TAP = "inline-flex min-h-11 min-w-11 items-center";

const PERIOD_ERROR = "Escolha um período de até 31 dias, com o início antes do fim.";

/** O filtro no endereço, sem os campos vazios. */
export function auditSearch(q: AuditQuery, page?: number): string {
  const p = new URLSearchParams();
  for (const key of ["de", "ate", "pessoa", "tipo"] as const) if (q[key]) p.set(key, q[key]);
  if (q.negadas) p.set("negadas", "1");
  if (page) p.set("pagina", String(page));
  return p.toString();
}

function What({ row }: { row: AuditRow }) {
  const name = recordName(row.changes);
  const href = recordHref(row.entity, row.entityId);
  return (
    <>
      <span className="block text-muted-foreground">{operationLabel(row.entity)}</span>
      {href ? (
        <TextLink className={TAP} href={href}>
          {name ?? "Abrir"}
        </TextLink>
      ) : (
        name
      )}
    </>
  );
}

/**
 * Auditoria (spec 019, US1): tudo o que a equipe fez no período, mais novo primeiro, com filtro
 * por pessoa, tipo de operação e só tentativas sem permissão. Só o gerente vê.
 */
export function AuditReportPage({ query, people, timezone, page, total, rows, error }: AuditReportProps) {
  const pages = Math.ceil(total / AUDIT_PAGE_SIZE);
  return (
    <div className="grid gap-4">
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="de">De</Label>
          <Input
            id="de"
            type="date"
            name="de"
            size="lg"
            defaultValue={query.de}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "de-erro" : undefined}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" type="date" name="ate" size="lg" defaultValue={query.ate} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pessoa">Pessoa</Label>
          <Select id="pessoa" name="pessoa" size="lg" defaultValue={query.pessoa}>
            <option value="">Todas</option>
            {people.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="tipo">Tipo de operação</Label>
          <Select id="tipo" name="tipo" size="lg" defaultValue={query.tipo}>
            <option value="">Todos</option>
            {OPERATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {OPERATION_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm" htmlFor="negadas">
          <Checkbox id="negadas" name="negadas" value="1" defaultChecked={query.negadas} />
          Só tentativas sem permissão
        </label>
        <Button type="submit" variant="outline" size="lg">
          Filtrar
        </Button>
        {!error && (
          <a
            href={`/equipe/auditoria/planilha?${auditSearch(query)}`}
            className={buttonVariants({ variant: "ghost", size: "lg" })}
            download
          >
            <Download aria-hidden="true" />
            Baixar planilha
          </a>
        )}
        {error && (
          <p id="de-erro" className="basis-full text-sm text-destructive">
            {PERIOD_ERROR}
          </p>
        )}
      </form>

      {!error && rows.length === 0 && (
        <EmptyState icon={ScrollText} title="Nenhum registro com esse filtro.">
          Mude o período, a pessoa ou o tipo de operação.
        </EmptyState>
      )}

      {rows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </p>
          <Table aria-label="Registros da auditoria">
            <thead>
              <tr>
                <Th scope="col">Quando</Th>
                <Th scope="col">Quem</Th>
                <Th scope="col">O que</Th>
                <Th scope="col">Ação</Th>
                <Th scope="col">O que mudou</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <Td className="whitespace-nowrap">
                    {r.occurredAt.toLocaleString("pt-BR", { timeZone: timezone })}
                  </Td>
                  <Td>{whoDid(r)}</Td>
                  <Td>
                    <What row={r} />
                  </Td>
                  <Td>{entryLabel(r)}</Td>
                  <Td className="text-muted-foreground">
                    {changeLines(r).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {pages > 1 && (
        <nav className="flex items-center gap-4 text-sm" aria-label="Páginas">
          {page > 1 && (
            <TextLink
              className="inline-flex min-h-11 items-center"
              href={`/equipe/auditoria?${auditSearch(query, page - 1)}`}
            >
              ← Anterior
            </TextLink>
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages && (
            <TextLink
              className="inline-flex min-h-11 items-center"
              href={`/equipe/auditoria?${auditSearch(query, page + 1)}`}
            >
              Próxima →
            </TextLink>
          )}
        </nav>
      )}
    </div>
  );
}
