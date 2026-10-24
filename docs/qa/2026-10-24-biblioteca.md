# Relatório — bloco biblioteca pública

- **Data:** 24/10/2026, ~16h30–17h10 (BRT)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io — contas anônima e `qa-leitor`
- **Build:** `develop` `bb60616` (deploy de QA `40126626061`) / API `2177ae6`
- **Evidências:** `qa-runs/2026-10-24-biblioteca/evidencias/`

## Resumo

| Cenário | Resultado | Observação |
|---|---|---|
| B-01 — `/biblioteca` anônima | Aprovado com ressalva | 2 livros; novidades ok. Sem livro em destaque no QA por padrão (com um destaque temporário, a seção apareceu). Erro de console do analytics da Vercel (BUG-014). |
| B-02 — busca e filtros | Aprovado com ressalva | Busca e idioma ok. Gênero/destaque dependem de dados que o catálogo do QA não tem (ver limitações). |
| B-03 — ficha do livro | Aprovado | Título, autor, resumo e direitos. Sem capa real no QA; o app desenha a capa de reserva. |
| B-04 — anônimo → login → leitor | Aprovado | "Ler agora" leva ao login; depois de entrar, o livro abre no leitor. |
| B-05 — ler, conversar e estante | Aprovado | Chat respondido pela personagem e livro na "Minha estante". |
| B-06 — home com novidades | Aprovado | "Novidades da biblioteca" e "Ver a biblioteca" (`/biblioteca`). |

**Re-testes:** BUG-010, BUG-011, BUG-012 e BUG-013 **corrigidos**.

**Novos defeitos:** BUG-014 (baixo, plataforma) e BUG-015 (baixo, estante).

## Cenários

### B-01 — abertura anônima

`/biblioteca` abre sem sessão, com o título "Leia, converse e guarde na sua estante.", busca,
filtros e a seção **Novidades** com os 2 livros do catálogo (`Envio de teste A` e
`Livro de teste do catalogo`). A seção **Destaques** não aparece porque nenhum livro está marcado
como destaque no QA. Para exercitar o caminho, um livro foi marcado como destaque por SQL e a seção
apareceu; o estado foi revertido em seguida.

Console: apenas o erro do script `/_vercel/insights/script.js` (BUG-014); nenhum erro da biblioteca.

**Evidências:** `b01-biblioteca-anonima.png`, `b01-destaques-e-novidades.png`.

### B-02 — busca e filtros

- Busca por `catalogo`: 1 resultado (`Livro de teste do catalogo`).
- Idioma português: 2 resultados.
- Gênero `Romance`: 0 resultados com a mensagem "Nenhum livro com esses filtros." — o único livro
  do catálogo tem gênero `Teste`, que não existe na lista fixa de gêneros da tela.
- "Só destaques": 0 resultados por padrão; com um livro em destaque, 1 resultado.

**Evidências:** `b02-busca-catalogo.png`, `b02-filtros.png`, `b02-filtro-destaques.png`.

### B-03 — ficha do livro

`/biblioteca/cat:a3c91034…` mostra capa de reserva, título, autor, gênero, idioma, número de páginas,
resumo ("Resumo do livro de teste.") e "Direitos: Domínio público.".

**Evidência:** `b03-ficha-livro.png`.

### B-04 — anônimo clica em "Ler agora"

A ação leva para `/?abrir=cat%3A…&login=1` com o formulário de login. Depois de entrar com
`qa-leitor`, o leitor abre no livro, com o texto e o painel de conversa.

**Evidências:** `b04-login-apos-ler-agora.png`, `b04-leitor-apos-login.png`.

### B-05 — ler, conversar e guardar

- O texto do catálogo abre no leitor.
- A conversa respondeu: "Olá, leitor. Estou bem por aqui e pronto para as validações."
- "Adicionar à estante" mostrou "Livro adicionado à sua estante." e o livro passou a aparecer em
  **Minha estante** (5 livros na conta).

**Evidências:** `b05-adicionado.png`, `b05-chat.png`, `b05-minha-estante.png`.

### B-06 — home

A home mostra a seção **Novidades da biblioteca** com o link **Ver a biblioteca** apontando para
`/biblioteca`.

**Evidência:** `b06-home-novidades.png`.

## Re-testes dos defeitos corrigidos (PR #63)

| ID | Caso | Resultado | Evidência |
|---|---|---|---|
| BUG-010 | Capa do "Pronto para voltar" estourando 62 px | Corrigido — capa 62×93, moldura 49×83, sem overflow | `bug010-capa-62px.png` |
| BUG-011 | Título de capítulo EPUB perdendo a primeira letra | Corrigido — H2 "Capítulo 1: Coelho maldito" | `bug011-import-preview.png`, `bug011-reader-coelho.png` |
| BUG-012 | Sem aviso de modo offline | Corrigido — aviso "Sem conexão — você está vendo o que já foi carregado." | `bug012-offline.png` |
| BUG-013 | Link de recuperação pedia senha sem validar o token | Corrigido — token inválido mostra "Este link de recuperação já foi usado ou passou do prazo." e nenhum campo de senha | `bug013-token-invalido.png` |

Para o BUG-011 foi importado um EPUB de teste (`coelho-maldito-qa.epub`).

## Novos defeitos

### BUG-014 — Baixo — Plataforma — Analytics da Vercel gera erro de console em todas as páginas

**Onde:** qualquer página do site (`/biblioteca`, home, leitor).
**Observado:** `Refused to execute script from '…/_vercel/insights/script.js' because its MIME type
('text/html') is not executable`.
**Causa provável:** `src/main.tsx` renderiza `<Analytics />` (`@vercel/analytics/react`); no VPS
auto-hospedado o caminho `/_vercel/insights/script.js` cai no fallback da SPA e responde `200`
`text/html` (conferido também na produção), não JavaScript.
**Efeito:** quebra o critério "zero erro de console" de qualquer tela; não quebra a biblioteca.
**Sugestão:** não montar o `Analytics` fora da Vercel (ou servir o script com o tipo correto).

### BUG-015 — Baixo — Estante — Remover da estante fica inconsistente na ficha pública

**Passos:** com `qa-leitor`, abrir **Minha estante** → detalhes do livro → **Remover da estante** →
abrir a ficha pública do mesmo livro.
**Esperado:** a ficha oferecer **Adicionar à estante**.
**Obtido:** a ficha continua mostrando **Na sua estante** por mais de 35 s (o `DELETE` só sobe na
sincronização do app principal — intervalo de 30 s em `src/lib/librarySync.ts`). A página pública lê
só o servidor (`fetchShelfEntry` em `src/features/catalog/PublicBookPage.tsx`), então não enxerga o
`pendingDelete` local.
**Efeito:** estado contraditório entre a estante e a ficha; o servidor só converge quando a home/app
principal sincroniza.
**Sugestão:** disparar a sincronização ao remover ou a ficha consultar a estante local.

**Evidências:** `bug015-ficha-antes-sync.png`, `bug015-ficha-depois-sync.png`.

## Limitações dos dados do QA

- Só existem 2 livros no catálogo curado, nenhum com capa real.
- O único livro de catálogo tem gênero `Teste`, fora da lista fixa de gêneros da tela; por isso o
  filtro de gênero não tem como retornar resultado.
- Nenhum livro em destaque por padrão (a seção **Destaques** fica oculta).

Para repetir B-01/B-02 com dados completos, cadastrar no QA um livro com capa e gênero da lista e
marcá-lo como destaque.
