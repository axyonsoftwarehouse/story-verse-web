# Ambiente de QA

Cópia do Storyverse para testar antes de chegar aos usuários. **Dados de teste, nada aqui é real.**

**Resultados e defeitos:** o painel único fica em [`docs/qa/RESULTADOS.md`](qa/RESULTADOS.md).
Cada rodada tem um relatório em `docs/qa/AAAA-MM-DD-<bloco>.md` e cada defeito ganha um `BUG-###`
no painel, com status e link do PR da correção.

| | Endereço |
|---|---|
| Site | https://qa.storyverse.2.29.42.104.sslip.io |
| API | https://api.qa.storyverse.2.29.42.104.sslip.io |

Roda na mesma VPS da produção, separado dela: banco, arquivos, senhas e domínios próprios. O site
mostra a faixa "Ambiente de QA" no rodapé e nenhum dos dois domínios é indexado por buscadores.

## O que o QA não tem

- **E-mail**: cadastro entra direto, sem confirmação; "esqueci a senha" não envia nada.
- **IA de produção**: o QA usa uma chave Gemini exclusiva, com teto de 20 mensagens por conta/dia e
  100/dia no QA inteiro. Não consome a cota de produção.
- **Dados de produção**: o banco começa vazio e só tem as contas de teste.

Erros do site e da API vão para os projetos Sentry `storyverse-web-qa` e `storyverse-api-qa`, com
`environment=qa`.

## Contas de teste

| Conta | Para quê |
|---|---|
| `qa-leitor@example.com` | leitor com a estante (feature `library`) |
| `qa-sem-estante@example.com` | leitor sem a estante (tudo dela escondido) |
| `qa-admin@example.com` | superadmin |
| `qa-moderador@example.com` | moderador: acervo e fórum |
| `qa-suporte@example.com` | suporte: contas e fórum só leitura |
| `qa-suspenso@example.com` | suspensa por 30 dias: login bloqueado (recriada pelo `reset-qa.sh`) |

Senha: `QA_TEST_PASSWORD` no `.env` de QA da VPS (`/home/deploy/storyverse-qa/.env`). `example.com`
é reservado: nenhum e-mail real recebe nada. Para criar mais contas, use o cadastro do próprio site.
Se as contas de papel ainda não existirem, rode `bash seed-qa.sh` de novo. `qa-suspenso` já nasce
com uma suspensão ativa: use a senha normal e confira a mensagem de bloqueio com motivo e prazo.

## Roteiro do painel admin

Entre em `/admin` com cada conta e confira a tabela da spec:

| Conta | Seções visíveis | Ação permitida | URL proibida |
|---|---|---|---|
| `qa-leitor` | nenhuma (mostra "Sem permissão") | — | `/admin` |
| `qa-suporte` | Visão geral, Contas, Sanções, Fórum (sem botões de ação) | buscar uma conta, encerrar sessões e ver sanções | `/admin/features`, `/admin/acervo`, `/admin/acervo/envios`, `/admin/financeiro`, `/admin/auditoria` |
| `qa-moderador` | Visão geral, Sanções, Acervo, Fórum (com ações) | cadastrar/publicar/ocultar livro, moderar envios, resolver uma denúncia e ver sanções | `/admin/contas`, `/admin/features`, `/admin/financeiro`, `/admin/auditoria` |
| `qa-admin` | todas (inclui Sanções e Financeiro) | conceder/remover `moderator`/`support`, ligar/desligar features, aplicar/revogar sanções, ver auditoria e financeiro | dar/remover `superadmin` (não existe no painel) |

A URL proibida deve mostrar "Sem permissão" sem quebrar. As ações sensíveis pedem confirmação.

O Acervo tem quatro abas: **Catálogo** (`/admin/acervo`), **Envios** (`/admin/acervo/envios`),
**Coleções** (`/admin/acervo/colecoes`) e **Importações** (`/admin/acervo/importacoes`). O
endereço antigo `/admin/moderacao/acervo` redireciona para a aba Envios.

## Biblioteca pública

`/biblioteca` mostra o catálogo curado para qualquer pessoa: busca, filtros, destaques e novidades.
A ficha do livro (`/biblioteca/cat:<uuid>`) é aberta; **ler e conversar exigem conta**. Livros do
catálogo entram na estante como `cat:<uuid>` e o leitor os carrega por
`GET /api/v1/catalog/books/{bookKey}/text`.

## Assinatura (Stripe)

`/assinar` e `/conta/assinatura` são públicas (a segunda pede login para mostrar os dados). O
paywall só liga com **`BILLING_ENABLED=true` na API e `VITE_BILLING_ENABLED=true` no build do web**;
sem as duas, ninguém é bloqueado. O QA precisa das chaves de **teste** do Stripe
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`) e do webhook configurado para
`https://api.qa…/api/v1/billing/webhook`. Sem chaves, `/assinar` mostra o plano, mas o checkout
responde 503.

## Fluxo de branches

- `main` = produção. Só recebe release do `develop`, pelo workflow `deploy-storyverse.yml`.
- `develop` = integração/próxima release e **branch padrão do repositório**. Todo push no `develop`
  publica no QA sozinho; PRs de feature já nascem com ele como base.
- Feature: PR para `develop`; review + `verify`; merge publica no QA; teste.
- Release: PR `develop` → `main`; depois merge de `main` de volta no `develop`.
- Hotfix: branch a partir da `main`, PR para `main`, e back-merge no `develop`.
- Para testar uma branch antes do merge, publique à mão; o QA mostra essa branch até o próximo
  deploy do `develop`.

## Publicar no QA

Push no `develop` publica sozinho. Para testar uma branch sem mergear:

```bash
gh workflow run deploy-qa.yml -f ref=feat/minha-branch                                   # site
gh workflow run deploy-api-qa.yml -R axyonsoftwarehouse/story-verse-api -f ref=feat/minha-branch   # API
```

Sem `-f ref`, publica a `develop`. Na API, o push no `develop` também publica no QA pelo
`deploy-api-qa.yml`. Site e API são independentes: publique os dois quando a mudança mexer nos dois.

## Chave de deploy do QA

Os workflows de QA usam secrets próprios no environment `qa` (`QA_SSH_KEY`, `QA_KNOWN_HOSTS`,
`QA_USER`, `QA_HOST`), nunca a chave compartilhada da produção. Na VPS a chave é restrita por
`command="/home/deploy/qa-deploy/gate.sh"`: só aceita `rsync` para `_incoming-qa` (via `rrsync`) e
`deploy-web.sh` / `deploy-api.sh <imagem> <sha>`. Os scripts ficam em `/home/deploy/qa-deploy/`
(fonte em `deploy/storyverse-qa/vps/`). O environment `qa` não tem regra de branch, de propósito: é
ele que permite publicar uma branch antes do merge. Para trocar a chave, gere outra, acrescente a
linha em `~/.ssh/authorized_keys` e atualize `QA_SSH_KEY`/`QA_KNOWN_HOSTS` nos dois repositórios.

## Banco do QA

- Migrações rodam como na produção. Uma migração de um branch testado e depois descartado não
  impede a API de subir (`SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS=*:missing,*:future`), mas o banco
  fica com ela. Se dois branches usarem o mesmo número de migração com conteúdo diferente, a API não
  sobe (checksum diferente): aí é preciso o reset.
- Para voltar ao zero (apaga banco e arquivos do QA e recria as contas):

```bash
ssh deploy@<vps> 'cd /home/deploy/storyverse-qa && bash reset-qa.sh'
```

- Só recriar/ajustar as contas de teste: `bash seed-qa.sh` (idempotente).

Os dois scripts recusam rodar fora de `/home/deploy/storyverse-qa` ou com um `.env` que não seja o
do QA, para nunca tocar na produção.

## Limites

API 512 MB e 0,5 CPU; banco 256 MB e 0,5 CPU. A VPS é dividida com a produção e o Foodie.

## Arquivos

- `deploy/storyverse-qa/` — Compose, `.env.example`, init do banco, seed, reset e checagens.
- `deploy/edge/Caddyfile` — blocos `qa.storyverse…` e `api.qa.storyverse…`.
- `.github/workflows/deploy-qa.yml` (aqui) e `deploy-api-qa.yml` (story-verse-api).
- Plano original: `docs/superpowers/plans/2026-10-23-ambiente-qa.md`.
