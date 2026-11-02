import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import { serverDeps } from "@/infra/server";
import { listProductCosts } from "@/application/inventory/product-costs";
import { ProductCostTable } from "@/components/costs/product-cost-table";
import { Alert } from "@/components/ui/card";

export const metadata: Metadata = { title: "Custos" };

/** Painel de custo dos produtos (spec 008, US2). */
export default async function Page() {
  const ctx = await requireContext();
  const panel = await listProductCosts(serverDeps(), ctx);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Custo dos produtos</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Quanto custa fazer uma unidade de cada produto vendido, pelo custo médio dos itens de hoje, e quanto
        do preço vai em ingredientes. A faixa comum vai até 35% do preço; acima de 40% sobra pouco para pagar
        o resto (equipe, aluguel, lucro).
      </p>
      {panel.ok ? (
        <ProductCostTable panel={panel.value} />
      ) : (
        <Alert>Não foi possível carregar os custos.</Alert>
      )}
    </div>
  );
}
