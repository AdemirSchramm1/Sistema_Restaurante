import { currentContext } from "@/actions/_session";
import { auditCsvResponse } from "@/actions/_audit-csv";
import { serverDeps } from "@/infra/server";

export const dynamic = "force-dynamic";

/** Planilha (CSV) da auditoria com o filtro da tela (spec 019, FR-005). */
export async function GET(request: Request) {
  return auditCsvResponse(serverDeps(), await currentContext(), new URL(request.url));
}
