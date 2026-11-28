import { Alert } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { weekText } from "@/domain/audit/week";

/**
 * Aviso no topo das telas do gerente (spec 019, US3-1): uma linha por semana encerrada com
 * exceção da operação pequena sem revisão, a mais antiga primeiro.
 */
export function ReviewBanner({ weeks }: { weeks: readonly string[] }) {
  if (weeks.length === 0) return null;
  return (
    <Alert tone="warning">
      <ul className="grid gap-1">
        {weeks.map((w) => (
          <li key={w}>
            Há exceções da operação pequena para revisar (semana de {weekText(w)}).{" "}
            <TextLink href={`/equipe/auditoria/revisao?semana=${w}`}>Revisar</TextLink>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
