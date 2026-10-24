# Relatório — re-teste do lote de correções

- **Data:** 24/10/2026, ~17h20–17h40 (BRT)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io
- **Build:** `develop` `ead5f80` (web) / `b860dc2` (API)
- **Evidências:** `qa-runs/2026-10-24-lote-correcoes/evidencias/`

## Resultado

| ID | O que foi conferido | Resultado | Evidência |
|---|---|---|---|
| BUG-001 | Minha estante com filtro de status | Corrigido — cabeçalho "1 livro de 5" | `bug001-contador-filtro.png` |
| BUG-003 | Sair da conta | Corrigido — diálogo de confirmação; cancelar mantém a sessão | `bug003-sair-confirmar.png` |
| BUG-004 | Cartões "Sem permissão" do admin | Corrigido — título e texto com separação (row-gap 4 px) | `bug004-sem-permissao.png` |
| BUG-005 | Busca de contas por `qa-leitor` (sem domínio) | Corrigido — encontra "Leitor de QA" com e-mail mascarado | `bug005-busca-qa-leitor.png` |
| BUG-006 | Confirmação de "Encerrar sessões" no admin | Corrigido — diálogo do app (`alertdialog` + `.confirm-dialog`) | `bug006-confirmacao-estilizada.png` |
| BUG-014 | Console do `/biblioteca` | Corrigido — sem o erro do `_vercel/insights/script.js` | `bug014-sem-erro-vercel.png` |
| BUG-015 | Remover da estante e abrir a ficha | Corrigido — `DELETE` enviado na hora; ficha mostra "Adicionar à estante" | `bug015-remocao-sincronizada.png` |

## Observações

- O BUG-002 foi fechado sem correção: a regra do percentual foi confirmada e coberta por
  `src/lib/progress.test.ts` (home, estante e leitor usam a mesma conta).
- O livro `Livro de teste do catalogo` foi removido e adicionado de novo durante o BUG-015; a estante
  terminou com o livro de volta.
