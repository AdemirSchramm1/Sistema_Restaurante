import type { Metadata } from "next";
import { requireContext } from "@/actions/_session";
import {
  createGroupAction,
  createSubgroupAction,
  renameGroupAction,
  renameSubgroupAction,
  setGroupActiveAction,
  setSubgroupActiveAction,
} from "@/actions/groups";
import { serverDeps } from "@/infra/server";
import { listGroupTree } from "@/application/inventory/list-group-tree";
import { can } from "@/domain/access/permissions";
import { STORAGE_CLASS_LABELS, type StorageClass } from "@/domain/inventory/default-tree";
import { GROUP_FIELD_LABELS, groupSummary } from "@/components/groups/group-labels";
import { ActionForm } from "@/components/forms/action-form";
import { Alert, Badge, Card, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "Grupos" };

export default async function Page() {
  const ctx = await requireContext();
  const tree = await listGroupTree(serverDeps(), ctx, true);
  const manage = can(ctx.roles, "group.manage");
  if (!tree.ok) return <Alert>Não foi possível carregar os grupos.</Alert>;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Grupos e subgrupos</h1>
      {manage && (
        <Card className="grid gap-3">
          <CardTitle>Novo grupo</CardTitle>
          <ActionForm
            action={createGroupAction}
            submitLabel="Criar grupo"
            variant="default"
            aria-label="Novo grupo"
          >
            <Input
              name="name"
              aria-label="Nome do grupo"
              placeholder="Nome do grupo"
              className="w-60"
              required
            />
            <Select
              name="storageClass"
              aria-label={GROUP_FIELD_LABELS.storageClass}
              className="w-48"
              defaultValue="FOOD"
            >
              {(Object.keys(STORAGE_CLASS_LABELS) as StorageClass[]).map((k) => (
                <option key={k} value={k}>
                  {STORAGE_CLASS_LABELS[k]}
                </option>
              ))}
            </Select>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox name="inCogs" defaultChecked /> {GROUP_FIELD_LABELS.inCogs}
            </label>
          </ActionForm>
        </Card>
      )}
      <div className="grid gap-4">
        {tree.value.map((g) => (
          <Card key={g.id} className="grid gap-3" aria-label={`Grupo ${g.code} ${g.name}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="font-mono">{g.code}</Badge>
              <h2 className="text-lg font-semibold">{g.name}</h2>
              <span className="text-sm text-muted-foreground">{groupSummary(g)}</span>
              {g.isSystem && <Badge tone="muted">padrão</Badge>}
              {!g.active && <Badge tone="warn">inativo</Badge>}
            </div>
            {manage && (
              <div className="flex flex-wrap gap-4">
                <ActionForm
                  action={renameGroupAction}
                  hidden={{ id: g.id, version: g.version }}
                  submitLabel="Renomear"
                >
                  <Input
                    name="name"
                    defaultValue={g.name}
                    aria-label={`Novo nome do grupo ${g.code}`}
                    className="w-60"
                  />
                </ActionForm>
                {!g.isSystem && (
                  <ActionForm
                    action={setGroupActiveAction}
                    hidden={{ id: g.id, version: g.version, active: String(!g.active) }}
                    submitLabel={g.active ? "Inativar grupo" : "Reativar grupo"}
                  />
                )}
              </div>
            )}
            <ul className="grid gap-2">
              {g.subgroups.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-sm"
                >
                  <span className="font-mono">
                    {g.code}.{s.code}
                  </span>
                  <span className="min-w-40">{s.name}</span>
                  <span className="text-muted-foreground">{s.activeItems} itens ativos</span>
                  {!s.active && <Badge tone="warn">inativo</Badge>}
                  {manage && (
                    <>
                      <ActionForm
                        action={renameSubgroupAction}
                        hidden={{ id: s.id, version: s.version }}
                        submitLabel="Renomear"
                      >
                        <Input
                          name="name"
                          defaultValue={s.name}
                          aria-label={`Novo nome do subgrupo ${g.code}.${s.code}`}
                          className="h-8 w-48"
                        />
                      </ActionForm>
                      <ActionForm
                        action={setSubgroupActiveAction}
                        hidden={{ id: s.id, version: s.version, active: String(!s.active) }}
                        submitLabel={s.active ? "Inativar" : "Reativar"}
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
            {manage && g.active && (
              <ActionForm
                action={createSubgroupAction}
                hidden={{ groupId: g.id }}
                submitLabel="Adicionar subgrupo"
              >
                <Input
                  name="name"
                  placeholder="Novo subgrupo"
                  aria-label={`Novo subgrupo em ${g.name}`}
                  className="h-8 w-60"
                  required
                />
              </ActionForm>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
