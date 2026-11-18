"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { tabletSignal } from "@/domain/ordering/tablet-signal";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type TableTabletCardProps = {
  table: {
    tableId: string;
    name: string;
    version: number;
    link: string | null;
    /** QR code do link, desenhado no servidor (o mesmo `qrSvg` da 009). */
    svg: string | null;
    boundAt: string | null;
    lastSeenAt: string | null;
  };
  now: string;
  timezone: string;
  createAction: Action;
  releaseAction: Action;
  rotateAction: Action;
};

/** "16/11 20:05" no fuso do restaurante. */
const dayTime = (iso: string, timeZone: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};

/**
 * Tablet da mesa no cartão da tela Mesas (spec 016, US4): criar o link, copiar, o QR code para abrir
 * no tablet sem digitar, a situação ("visto há", "Sem sinal há") e Liberar / Trocar link com
 * confirmação. Só o gerente vê.
 */
export function TableTabletCard({
  table,
  now,
  timezone,
  createAction,
  releaseAction,
  rotateAction,
}: TableTabletCardProps) {
  const [confirm, setConfirm] = useState<"RELEASE" | "ROTATE" | null>(null);
  const [copied, setCopied] = useState("");
  const label = `Mesa ${table.name}`;
  const link = table.link;
  const signal = tabletSignal(table.lastSeenAt ? new Date(table.lastSeenAt) : null, new Date(now));

  // Deu certo: a confirmação fecha e o cartão mostra a situação nova (Trocar link de novo à vista).
  const closingOnSuccess =
    (action: TableTabletCardProps["releaseAction"]): TableTabletCardProps["releaseAction"] =>
    async (prev, form) => {
      const result = await action(prev, form);
      if (result?.ok) setConfirm(null);
      return result;
    };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Link copiado");
    } catch {
      setCopied("Não deu para copiar. Selecione o link e copie.");
    }
  };

  return (
    <section
      aria-label={`Tablet da ${label}`}
      className="grid gap-2 rounded-lg border border-border p-3 text-sm"
    >
      <h3 className="font-semibold">Tablet da mesa</h3>
      {!link ? (
        <ActionForm
          action={createAction}
          hidden={{ id: table.tableId, version: table.version }}
          submitLabel="Criar link do tablet"
          size="lg"
          aria-label={`Criar link do tablet da ${label}`}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-xs">{link}</code>
            <Button type="button" size="lg" variant="outline" onClick={() => copy(link)}>
              Copiar
            </Button>
          </div>
          <p role="status" className="text-xs text-muted-foreground empty:hidden">
            {copied}
          </p>
          {table.svg && (
            <div
              role="img"
              aria-label={`QR code do link do tablet da ${label}`}
              className="w-32 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: table.svg }}
            />
          )}
          {table.boundAt === null ? (
            <p className="text-muted-foreground">Nenhum tablet ligado</p>
          ) : signal.kind === "LOST" ? (
            <p
              data-lost
              className="rounded-md bg-warning-soft px-2 py-1 font-medium text-warning-soft-foreground"
            >
              Tablet ligado desde {dayTime(table.boundAt, timezone)} · Sem sinal há {signal.minutes} min
            </p>
          ) : (
            <p>
              {`Tablet ligado desde ${dayTime(table.boundAt, timezone)}`}
              {signal.kind === "SEEN" ? ` · visto há ${signal.minutes} min` : ""}
            </p>
          )}

          {confirm ? (
            <div className="grid gap-2 rounded-md border border-border p-2">
              <p>
                {confirm === "RELEASE"
                  ? "O tablet ligado desliga na hora e o link aceita o próximo aparelho que o abrir."
                  : "O link antigo para de funcionar e o tablet ligado desliga. Abra o link novo no tablet."}
              </p>
              <ActionForm
                action={closingOnSuccess(confirm === "RELEASE" ? releaseAction : rotateAction)}
                hidden={{ id: table.tableId, version: table.version }}
                submitLabel={confirm === "RELEASE" ? "Sim, liberar" : "Sim, trocar link"}
                variant="destructive"
                size="lg"
                className="flex flex-wrap gap-2"
              >
                <Button type="button" size="lg" variant="ghost" onClick={() => setConfirm(null)}>
                  Cancelar
                </Button>
              </ActionForm>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {table.boundAt !== null && (
                <Button type="button" size="lg" variant="outline" onClick={() => setConfirm("RELEASE")}>
                  Liberar
                </Button>
              )}
              <Button type="button" size="lg" variant="outline" onClick={() => setConfirm("ROTATE")}>
                Trocar link
              </Button>
            </div>
          )}
        </>
      )}
      <details className="text-muted-foreground">
        <summary className="cursor-pointer py-3 text-foreground">Como travar o tablet</summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5">
          <li>Abra o link no navegador do tablet (não pela Tela de Início).</li>
          <li>Android: ative &quot;Fixar app&quot; nas configurações de segurança e fixe o navegador.</li>
          <li>
            iPad: ative o &quot;Acesso Guiado&quot; em Acessibilidade e inicie com três toques no botão
            lateral.
          </li>
          <li>
            Nas configurações de tela, deixe &quot;Bloqueio automático: Nunca&quot; e o tablet na tomada.
          </li>
        </ul>
      </details>
    </section>
  );
}
