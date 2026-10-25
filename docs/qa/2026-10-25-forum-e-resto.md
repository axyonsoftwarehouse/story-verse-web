# Relatório — fórum (F-01/F-02) e sobras do plano

- **Data:** 25/10/2026, 03h40–04h30 UTC (24/10, 00h40–01h30 em Brasília)
- **Alvo:** https://qa.storyverse.2.29.42.104.sslip.io — `/comunidade`, `/admin/moderacao/forum`, `/perfil`, `/ajustes`
- **Build:** site `8d308cf` → `7649173` (`develop`, deploys de QA verdes) / API `6408919`
- **Contas:** `qa-leitor`, `qa-moderador`, `qa-admin`, `qa-sem-estante` (login pelo cofre)
- **Execução:** navegador automatizado (Chromium 1280×900 e 390×844), contextos separados por papel
- **Evidências:** `qa-runs/2026-10-25-forum-e-resto/evidencias/` (14 prints) e `fixtures/`

## Resultado

| Cenário | Resultado | Observação |
|---|---|---|
| **F-01** — fórum abre, tópico e resposta | **Aprovado** depois de corrigir a mensagem da resposta | defeito baixo encontrado e corrigido no mesmo dia (ver abaixo) |
| **F-02** — denúncia chega na moderação | Aprovado | fila com motivo, autor, ações e auditoria |
| **E-03** — gate da feature `library` | Aprovado | `qa-sem-estante` sem "Minha estante" |
| **P-03** — 390 px sem rolagem horizontal | Aprovado | home, leitor, `/admin`, `/admin/acervo`, `/admin/contas` |
| **I-02** — importar PDF no app do leitor | Aprovado | 674 caracteres, abriu no leitor e persistiu |
| **I-03** — arquivo corrompido/sem texto | Aprovado | duas mensagens distintas, sem travar |
| **A-03** — segunda aba não derruba a sessão | Aprovado | mesmo contexto, sessão compartilhada |
| **A-05** — exportar dados | Aprovado | `storyverse-dados.json` (16 KB) |

## Fórum ligado no QA (PR #90)

O fórum estava pronto mas escondido: `FORUM_VISIBLE` só ligava com `?forum=1` (gravado por aparelho). O build de QA passou a definir `VITE_FORUM_ENABLED=true` (`.github/workflows/deploy-qa.yml`); **produção continua desligada**.

Medido depois do deploy: `/comunidade` abre direto (sem `?forum=1`), o menu logado mostra **Biblioteca · Comunidade** e a fila de moderação deixa de ser vazia.

## F-01 — tópico e resposta

| Passo | Resultado |
|---|---|
| Novo tópico (`qa-leitor`, espaço "Dúvidas") | Aviso **"Tópico enviado para análise."** — não aparece na lista |
| Fila do moderador → aba **Tópicos** | tópico pendente com `pending`, ações **Publicar / Ocultar / Fixar / Fechar** |
| Publicar | "Tópico publicado."; aparece em `/comunidade` como `Dúvidas1` com autor e data |
| Abrir o tópico | `Curtir · Salvar · Denunciar · Remover tópico`, campo de resposta |
| Responder | **pendente** — a fila de **Respostas** mostra o texto com `pending` |
| Publicar a resposta | tópico passa a mostrar **1 resposta** com autor e data |

**Defeito encontrado (baixo, corrigido):** ao responder, a tela anunciava **"Resposta publicada."** mesmo com a resposta em moderação (`status=pending`) — e o tópico continuava "0 respostas", porque só publicadas aparecem. Para quem responde, o texto parecia ter se perdido. Causa: `TopicPage.tsx:148` fixava a mensagem, sem olhar o status devolvido pela API (o `ForumHome` já fazia certo ao criar tópico). Correção no **PR #91**; re-teste no QA: o aviso agora é **"Resposta enviada para análise."** e o `Resposta publicada.` só aparece quando a resposta já entra publicada.

## F-02 — denúncia

1. `qa-sem-estante` abre o tópico e clica **Denunciar** → motivos (Spam, Abuso, Assédio, Spoiler sem aviso, Fora do tópico, Direitos autorais, Outro) + detalhes opcionais.
2. Envio → **"Denúncia enviada para a moderação."**
3. Fila do moderador → aba **Denúncias**: `Fora do tópico · Tópico · Leitor sem estante · 25 de out.` com o título e **Resolver / Ignorar**.
4. **Resolver** → "Denúncia marcada como resolvida." e fila vazia; banco em `actioned` e auditoria com `forum.topic.moderate`, `forum.reply.moderate` e `forum.report.resolve`.

## E-03 — gate da estante (`library`)

| Conta | Perfil | Estante |
|---|---|---|
| `qa-leitor` (tem a feature) | mostra **"Minha estante"** e o botão **"Abrir minha estante"** | abre |
| `qa-sem-estante` | **não** mostra nem o cartão nem o botão (só o nome da conta e a conquista "Estante cheia") | inacessível |

## P-03 — 390 px

`Emulation.setDeviceMetricsOverride(390×844, mobile)` com recarga em cada tela:

| Tela | `scrollWidth × clientWidth` | Transborda? |
|---|---|---|
| Home logada | 390 × 390 | não |
| Leitor (capítulos) | 390 × 390 | não |
| `/admin` | 390 × 390 | não |
| `/admin/acervo` | 390 × 390 | não |
| `/admin/contas` | 390 × 390 | não |

Os cards de carrossel (`button.row-card`, capa) passam da borda direita **dentro do próprio scroller horizontal** — é o componente de trilha, não rolagem da página.

## I-02 / I-03 — importar no app do leitor

A importação é local: *"O arquivo é lido no seu navegador e não é enviado para lugar nenhum."*

| Caso | Resultado |
|---|---|
| PDF com 674 caracteres (`gato-de-teste.pdf`) | "1 parte encontrada"; importou e abriu no leitor com o texto; persistiu no IndexedDB `storyverse-books v2` depois de recarregar |
| EPUB corrompido (`epub-corrompido.epub`) | **"Este arquivo não parece ser um EPUB válido."** — sem erro de console, diálogo aberto para trocar o arquivo |
| PDF com texto insuficiente (1ª tentativa, 4 linhas) | **"Não encontramos texto suficiente neste arquivo."** |

## A-03 — segunda aba

Abrir uma segunda aba no mesmo contexto: a nova já entra logada (sem botão Login) e a primeira continua logada depois de recarregar. Nenhuma das duas derruba a outra.

## A-05 — exportar dados

**"Baixar meus dados"** gera `storyverse-dados.json` (16 KB) com `exportedAt`, `user` (id, e-mail, criação, nome), `readingState`, `submissions` e `library`.

**"Excluir conta" não foi executado**: apagaria a conta `qa-leitor`, que a matriz de QA usa em várias rodadas. Fica registrado como pendência de execução com conta descartável.

## Detalhes do fórum — spoiler marcado e aceitar resposta (complemento, 17h10)

Executados depois da rodada principal, com o tópico **"Spoiler do final (QA)"** (espaço Clube de leitura, spoiler **do livro**).

| Verificação | Resultado |
|---|---|
| Criar tópico com spoiler | Seletor **Sem spoiler / Spoiler do capítulo / Spoiler do livro**; tópico enviado para análise |
| Lista do fórum | Em vez do trecho, aparece **"O texto pode conter spoiler."** e o selo **Spoiler** |
| Dentro do tópico | **"Este tópico contém spoiler. O texto pode revelar partes da história."** + botão **Mostrar mesmo assim**; o texto fica escondido até o clique |
| Depois de revelar | Texto aparece, selo **Spoiler do livro** no cabeçalho |
| Moderação | A fila mostra o selo **Spoiler** e o texto completo (moderador precisa ver para julgar) |
| **Aceitar resposta** (autor do tópico) | Botão aparece na resposta publicada; ao clicar, a resposta ganha **"Resposta aceita"**, classe `is-accepted`, e o botão desaparece |
| Persistência | Depois de recarregar, o selo **Resposta aceita** continua; banco: `accepted_reply_id = 843c0ed0…`, `spoiler_level = book`, `reply_count = 1` |
| Quem **não** é autor | `qa-moderador` não vê **Aceitar resposta** nem **Remover tópico**, mas vê o selo **Resposta aceita** |

Observações de comportamento (não são defeitos):

- **Resposta da equipe não passa pela fila**: a resposta do `qa-moderador` foi publicada na hora ("Resposta publicada.", contagem foi para "1 resposta").
- **Spoiler vale só para o tópico**: o formulário de resposta não tem seletor de spoiler; quem responde usa o aviso no texto.
- A auditoria registra `forum.topic.moderate` na publicação do tópico; **aceitar resposta é ação do autor, não entra na auditoria**.

## O que não foi executado

- **P-01** (instalar como PWA): o navegador automatizado não conclui o fluxo de instalação do sistema.
- **A-05, parte de excluir conta**: precisa de conta descartável (a criação exige senha digitada pelo dono).
- ~~Respostas com **spoiler marcado** e **aceitar resposta**~~ — executados no complemento acima.

## Estado final do QA

- Fórum **ligado** no build de QA (flag `VITE_FORUM_ENABLED=true`); produção segue desligada.
- Ficaram no ar, como conteúdo de teste, o tópico **"Como vocês marcam spoiler? (QA)"** com 1 resposta publicada e 1 pendente, e o tópico **"Spoiler do final (QA)"** (spoiler do livro, 1 resposta aceita).
- Conta `qa-leitor` tem o livro local **"gato de teste"** (PDF do I-02) na estante — é só local, no IndexedDB do navegador de teste.
- Livro de catálogo criado para o re-teste do "Publicar" foi **apagado**; nenhuma coleção, importação ou sanção pendente.
