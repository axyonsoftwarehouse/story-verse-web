# QA — onde ficam os resultados

Esta pasta é a **fonte única** dos testes de QA do Storyverse. O Hermes escreve aqui; a correção
acontece no mesmo fluxo, referenciando o ID do defeito.

## Arquivos

| Arquivo | Para quê |
|---|---|
| [`RESULTADOS.md`](RESULTADOS.md) | Painel: rodadas, defeitos abertos e corrigidos. **É o lugar para olhar primeiro.** |
| `AAAA-MM-DD-<bloco>.md` | Relatório completo de uma rodada (passos, evidências, esperado × obtido). |
| `README.md` | Estas regras. |

Evidências (prints, HAR, vídeos) **não** são versionadas: ficam no workspace do Hermes em
`qa-runs/<data>-<bloco>/evidencias/` e o relatório cita o nome do arquivo. Se um print for
essencial para entender o defeito, ele pode ser copiado para `docs/qa/evidencias/`.

## Regras

1. **Toda rodada gera um relatório** `AAAA-MM-DD-<bloco>.md` e uma linha na tabela de rodadas do
   `RESULTADOS.md`.
2. **Todo defeito ganha um ID global** `BUG-###`, sequencial, e uma linha na tabela de defeitos
   abertos. Não reutilize IDs; os relatórios antigos usam `QA-01`, `NB-01` etc. — o painel guarda
   essa origem entre parênteses.
3. **Defeito só entra com evidência:** URL, passos, esperado × obtido, print e, quando houver,
   status HTTP/erro de console.
4. **Status do defeito:** `aberto` → `em correção` → `corrigido` → `re-testado`.
   - `em correção`: já existe branch/PR; preencher a coluna `Correção`.
   - `corrigido`: PR mergeado; aguarda re-teste no QA.
   - `re-testado`: o Hermes confirmou no QA; sai da lista de abertos.
5. **Trello:** cada defeito tem um cartão em `Desenvolvimento - Axyon Software`; o link/ID do cartão
   vai na coluna `Cartão`. O cartão só vai para DONE com print do re-teste + link do PR.
6. **Prioridade:** usar a severidade do plano (`Crítico`, `Alto`, `Médio`, `Baixo`) e a prioridade
   (`P0`–`P2`). Crítico/Alto bloqueiam release.
7. **Nada de dado real.** Contas e livros do QA são descartáveis; ações que mudam papéis/features
   voltam ao estado original.

## O que o Hermes atualiza

Ao terminar um bloco:

1. Cria/atualiza o relatório da rodada.
2. Adiciona a linha da rodada no `RESULTADOS.md`.
3. Para cada defeito novo, adiciona uma linha em **Defeitos abertos** com `BUG-###`.
4. Se um defeito já existia, atualiza a linha (não cria outra).

## O que fazemos na correção

1. Escolher um `BUG-###` aberto.
2. Criar a branch, corrigir e abrir o PR.
3. No `RESULTADOS.md`, mudar o status para `em correção` e preencher `Correção` com o PR.
4. Depois do merge, mudar para `corrigido` e pedir o re-teste do caso + smoke.

## Modelo de relatório

```md
# Relatório — <bloco>

- **Data:** AAAA-MM-DD, <horário> (HPBA)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io
- **Contas:** ...
- **Commit publicado:** <SHA ou “deploy automático da develop”>
- **Execução:** navegador automatizado (Chromium), rede interceptada
- **Evidências:** `qa-runs/<data>-<bloco>/evidencias/` (N prints)

## Resultado: <aprovado / aprovado com ressalvas / reprovado>

| ID | Cenário | Resultado | Evidência |
|---|---|---|---|
| ... | ... | ✅/❌ | ... |

## Defeitos

### BUG-### · <Severidade> · <área> — <título>

**Onde:** ...
**Passos:** ...
**Esperado:** ...
**Obtido:** ...
**Evidência:** `...png`
**Causa provável:** ...
**Cartão:** ...
```

## Rodadas antigas

Os relatórios de 23/10/2026 continuam válidos em:

- [`2026-10-23-nivel1.md`](2026-10-23-nivel1.md)
- [`2026-10-23-nivel2-admin.md`](2026-10-23-nivel2-admin.md)
- [`2026-10-23-importacao-pwa.md`](2026-10-23-importacao-pwa.md)

O plano completo está em [`../QA-PLANO-DE-TESTES.md`](../QA-PLANO-DE-TESTES.md).
