/** Faixa fixa que só aparece no build de QA (`VITE_APP_ENV=qa`), para ninguém confundir com a produção. */
export function QaBanner({ env }: { env?: string }) {
  if (env !== "qa") return null;
  return (
    <div className="qa-banner" role="status">
      Ambiente de QA — dados de teste, nada aqui é real.
    </div>
  );
}
