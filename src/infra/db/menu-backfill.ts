/**
 * Preenchimento da migração 0013 (spec 013, research R6): os produtos vendidos existentes ficam em
 * "Outros", na ordem alfabética que o cliente já via. O texto é o mesmo do arquivo da migração; o
 * teste de esquema confere os dois.
 */
export const MENU_POSITION_BACKFILL = `update recipes r set menu_position = o.pos
  from (select id, row_number() over (partition by restaurant_id order by name_normalized) as pos
          from recipes where kind = 'DISH') o
 where o.id = r.id`;
