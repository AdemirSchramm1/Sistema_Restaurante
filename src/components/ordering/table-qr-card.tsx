"use client";

import { useState } from "react";
import type { ActionState } from "@/actions/_session";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export type TableQrCardProps = {
  restaurantName: string;
  table: { id: string; name: string; url: string; svg: string; version: number };
  /** Sem ação: folha de impressão, só o desenho. */
  rotateAction?: Action;
};

/** Cartão da mesa com o QR code (spec 009, US1). O SVG é gerado no servidor a partir do link. */
export function TableQrCard({ restaurantName, table, rotateAction }: TableQrCardProps) {
  const [confirming, setConfirming] = useState(false);
  const label = `Mesa ${table.name}`;
  return (
    <figure className="qr-card grid justify-items-center gap-2 rounded-lg border border-border p-4 text-center">
      <div
        role="img"
        aria-label={`QR code da ${label}`}
        className="w-48 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: table.svg }}
      />
      <figcaption className="grid gap-0.5">
        <span className="text-sm text-muted-foreground">{restaurantName}</span>
        <strong className="text-xl">{label}</strong>
        <span className="text-xs text-muted-foreground">Aponte a câmera para ver o cardápio e pedir</span>
      </figcaption>
      {rotateAction && (
        <div className="no-print grid w-full gap-2 text-sm">
          <a
            href={table.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir o cardápio da ${label}`}
            className="text-primary underline underline-offset-4"
          >
            Abrir o cardápio
          </a>
          <a
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(table.svg)}`}
            download={`mesa-${table.name}.svg`}
            className="text-primary underline underline-offset-4"
          >
            Baixar imagem
          </a>
          {confirming ? (
            <div className="grid gap-2 rounded-md border border-border p-2">
              <p>O QR code impresso nesta mesa vai parar de funcionar. Imprima o novo depois.</p>
              <ActionForm
                action={rotateAction}
                hidden={{ id: table.id, version: table.version }}
                submitLabel="Sim, trocar"
                variant="destructive"
                className="flex flex-wrap justify-center gap-2"
              >
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </ActionForm>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
              Trocar QR code
            </Button>
          )}
        </div>
      )}
    </figure>
  );
}
