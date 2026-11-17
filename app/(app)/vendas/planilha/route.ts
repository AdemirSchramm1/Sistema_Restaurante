import { currentContext } from "@/actions/_session";
import { salesCsvResponse } from "@/actions/_sales-csv";
import { serverDeps } from "@/infra/server";

export const dynamic = "force-dynamic";

/** Planilha (CSV) do relatório de vendas, para o contador (spec 014, US6-7). */
export async function GET(request: Request) {
  return salesCsvResponse(serverDeps(), await currentContext(), new URL(request.url));
}
