"use client";

import { useEffect, useRef, useState } from "react";
import { WARN_SECONDS } from "@/domain/ordering/menu-access";

/**
 * Tempo que falta do acesso de 20 minutos (spec 009, US3). Conta a partir do relógio do servidor:
 * o relógio do celular só mede quanto tempo passou desde a página carregar.
 */
export function AccessTimer({
  serverNow,
  expiresAt,
  unsent,
  onExpire,
}: {
  serverNow: string;
  expiresAt: string;
  unsent: readonly { name: string; quantity: number }[];
  onExpire?: () => void;
}) {
  const [loadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(loadedAt);
  const expired = useRef(false);
  const left = Math.max(
    0,
    Math.floor((Date.parse(expiresAt) - Date.parse(serverNow) - (now - loadedAt)) / 1000),
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0 && !expired.current) {
      expired.current = true;
      onExpire?.();
    }
  }, [left, onExpire]);

  if (left === 0)
    return (
      <div role="alert" className="grid gap-2 rounded-lg border border-border bg-muted p-4 text-center">
        <p className="text-lg font-medium">
          Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar.
        </p>
        {unsent.length > 0 && (
          <div className="text-sm">
            <p>Não foi enviado:</p>
            <ul>
              {unsent.map((u, i) => (
                <li key={i}>
                  {u.quantity} × {u.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );

  const minutes = Math.ceil(left / 60);
  return (
    <div className="grid gap-1 text-sm">
      <p className="text-muted-foreground" aria-live="off">
        Faltam {minutes} min
      </p>
      {unsent.length > 0 && left <= WARN_SECONDS && (
        <p role="status" className="rounded bg-amber-100 px-2 py-1 font-medium text-amber-900">
          Faltam 2 minutos. Envie o pedido para não perder o que escolheu.
        </p>
      )}
    </div>
  );
}
