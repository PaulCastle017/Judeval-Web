/**
 * ¿Forma parte de la plantilla de esa categoría? Mismo criterio para pasar lista y para convocar:
 * de la categoría, activo y que no esté de baja (los lesionados sí cuentan).
 */
export function inRoster(player: { category_id: string; status: string; active: boolean }, categoryId: string): boolean {
  return player.category_id === categoryId && player.active && player.status !== 'baja'
}
