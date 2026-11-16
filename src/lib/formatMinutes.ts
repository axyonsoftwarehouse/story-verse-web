/** "45 min", "1 h 20 min": tempo de leitura nas telas da home, do perfil e do ranking. */


export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
