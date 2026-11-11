/** Esqueleto (vermelho). */
export type OpenTabCard = {
  id: string;
  tableName: string;
  openedAt: string;
  total: string;
  remaining: string;
  pendingOrders: number;
};
export function OpenTabs(_props: { tabs: OpenTabCard[]; serverNow: string }) {
  return null;
}
