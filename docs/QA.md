# Ambiente de QA

Cópia do Storyverse para testar antes de chegar aos usuários. **Dados de teste, nada aqui é real.**

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

Senha: `QA_TEST_PASSWORD` no `.env` de QA da VPS (`/home/deploy/storyverse-qa/.env`). `example.com`
é reservado: nenhum e-mail real recebe nada. Para criar mais contas, use o cadastro do próprio site.
Se as contas de papel ainda não existirem, rode `bash seed-qa.sh` de novo.

## Roteiro do painel admin

Entre em `/admin` com cada conta e confira a tabela da spec:

| Conta | Seções visíveis | Ação permitida | URL proibida |
|---|---|---|---|
| `qa-leitor` | nenhuma (mostra "Sem permissão") | — | `/admin` |
| `qa-suporte` | Visão geral, Contas, Fórum (sem botões de ação) | buscar uma conta e encerrar sessões | `/admin/features`, `/admin/moderacao/acervo`, `/admin/auditoria` |
| `qa-moderador` | Visão geral, Acervo, Fórum (com ações) | aprovar/recusar um envio e resolver uma denúncia | `/admin/contas`, `/admin/features`, `/admin/auditoria` |
| `qa-admin` | todas | conceder/remover `moderator`/`support`, ligar/desligar features, ver auditoria | dar/remover `superadmin` (não existe no painel) |

A URL proibida deve mostrar "Sem permissão" sem quebrar. As ações sensíveis pedem confirmação.

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
