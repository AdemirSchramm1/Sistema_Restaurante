import { describe, it, expect } from "vitest";
import type { GroupTree } from "@/application/inventory/ports";
import { subgroupOptions } from "./subgroup-options";

const group = (over: Partial<GroupTree[number]>): GroupTree[number] => ({
  id: "g1",
  code: "01",
  name: "Hortifruti",
  storageClass: "FOOD",
  inCogs: true,
  isSystem: false,
  active: true,
  version: 1,
  subgroups: [],
  ...over,
});
const sub = (id: string, code: string, name: string, active = true) => ({
  id,
  groupId: "g",
  code,
  name,
  active,
  version: 1,
  activeItems: 0,
});

describe("opções de subgrupo do formulário de item", () => {
  const tree: GroupTree = [
    group({ subgroups: [sub("s1", "01", "Legumes"), sub("s2", "02", "Frutas", false)] }),
    group({ id: "g2", code: "02", name: "Antigo", active: false, subgroups: [sub("s3", "01", "Velho")] }),
  ];

  it("só subgrupos ativos de grupos ativos, com o código e o caminho", () => {
    expect(subgroupOptions(tree)).toEqual([{ id: "s1", label: "01.01 · Hortifruti › Legumes" }]);
  });

  it("mantém o subgrupo atual do item mesmo inativo, para a edição não perdê-lo", () => {
    expect(subgroupOptions(tree, "s3").map((o) => o.id)).toEqual(["s1", "s3"]);
    expect(subgroupOptions(tree, "s2").map((o) => o.id)).toEqual(["s1", "s2"]);
  });
});
