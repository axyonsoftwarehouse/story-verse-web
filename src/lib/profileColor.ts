/** Cor da conta quando não há foto nem avatar pronto: fixa por id. */
const PROFILE_COLORS = ["#e4b86a", "#9bc4b5", "#d7a0b4", "#a8b8e0", "#c9a27e", "#b7c98a"];

export function profileColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROFILE_COLORS[h % PROFILE_COLORS.length];
}
