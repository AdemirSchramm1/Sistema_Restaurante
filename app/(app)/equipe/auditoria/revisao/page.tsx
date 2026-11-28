import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { markWeekReviewedAction } from "@/actions/audit";
import { serverDeps } from "@/infra/server";
import { pendingReviews, weekExceptions } from "@/application/audit/exception-review";
import { businessDay } from "@/domain/ordering/business-day";
import { weekStartOf, weekText } from "@/domain/audit/week";
import { messageFor } from "@/components/forms/error-messages";
import { WeekReview } from "@/components/audit/week-review";
import { NoAccess } from "@/components/layout/no-access";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Revisão da semana" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * Revisão semanal das exceções da operação pequena (spec 019, US3). Abre na semana pedida; sem
 * semana, na mais antiga por revisar ou, sem pendência, na última semana encerrada.
 */
export default async function Page({ searchParams }: PageProps<"/equipe/auditoria/revisao">) {
  const ctx = await requireContext();
  const deps = serverDeps();
  const pending = await pendingReviews(deps, ctx);
  if (!pending.ok) return <NoAccess />;
  const settings = await deps.tenant(ctx.restaurantId, async (r) => ({
    ok: true as const,
    value: (await r.restaurants.get())!.timezone,
  }));
  const timezone = settings.ok ? settings.value : "America/Sao_Paulo";
  const thisWeek = weekStartOf(businessDay(deps.clock.now(), timezone));
  const lastClosed = new Date(Date.parse(`${thisWeek}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  // Qualquer dia escolhido vale pela semana dele; texto que não é dia cai na recusa da semana.
  const asked = firstParam((await searchParams).semana);
  const day = asked && !Number.isNaN(Date.parse(`${asked}T00:00:00Z`)) ? weekStartOf(asked) : asked;
  const weekStart = day ?? pending.value[0] ?? lastClosed;
  const week = await weekExceptions(deps, ctx, weekStart);
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Revisão da semana"
        description="Acertos de estoque aprovados por quem pediu (operação pequena). Confira e marque a semana como revisada."
      />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="semana">Semana (escolha um dia dela)</Label>
          <Input id="semana" type="date" name="semana" size="lg" defaultValue={weekStart} />
        </div>
        <Button type="submit" variant="outline" size="lg">
          Ver semana
        </Button>
      </form>
      {pending.value.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Semanas por revisar: {pending.value.map(weekText).join("; ")}.
        </p>
      )}
      {week.ok ? (
        <WeekReview week={week.value} timezone={timezone} action={markWeekReviewedAction} />
      ) : (
        <Alert>{messageFor(week.error)}</Alert>
      )}
    </div>
  );
}
