import { requireContext, currentUser } from "@/actions/_session";
import { signOutAction } from "@/actions/auth";
import { serverDeps } from "@/infra/server";
import { getShellInfo } from "@/application/shell";
import { AppShell } from "@/components/layout/app-shell";
import { ReviewBanner } from "@/components/audit/review-banner";

/**
 * Casco das telas da equipe. Sessão e contexto saem do cache da requisição (spec 012, US4); nome do
 * restaurante, contagem do Repor e o aviso de revisão do gerente (spec 019) vêm numa transação só.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const [user, shell] = await Promise.all([currentUser(), getShellInfo(serverDeps(), ctx)]);
  return (
    <AppShell
      restaurantName={shell.ok ? shell.value.restaurantName : null}
      userName={user?.name ?? null}
      roles={ctx.roles}
      reorderCount={shell.ok ? (shell.value.reorderCount ?? 0) : 0}
      signOut={signOutAction}
    >
      {shell.ok && Boolean(shell.value.pendingReviewWeeks?.length) && (
        <div className="mb-4">
          <ReviewBanner weeks={shell.value.pendingReviewWeeks!} />
        </div>
      )}
      {children}
    </AppShell>
  );
}
