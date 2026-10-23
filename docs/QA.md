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
- **IA paga**: o chat com personagens roda em modo demonstração.
- **Dados de produção**: o banco começa vazio e só tem as contas de teste.

## Contas de teste

| Conta | Para quê |
|---|---|
| `qa-leitor@example.com` | leitor com a estante (feature `library`) |
| `qa-sem-estante@example.com` | leitor sem a estante (tudo dela escondido) |
| `qa-admin@example.com` | superadmin |

Senha: `QA_TEST_PASSWORD` no `.env` de QA da VPS (`/home/deploy/storyverse-qa/.env`). `example.com`
é reservado: nenhum e-mail real recebe nada. Para criar mais contas, use o cadastro do próprio site.

## Publicar no QA

Push no branch `qa` publica sozinho. Para testar um PR sem mexer em branch nenhum:

```bash
gh workflow run deploy-qa.yml -f ref=feat/minha-branch                                   # site
gh workflow run deploy-api-qa.yml -R axyonsoftwarehouse/story-verse-api -f ref=feat/minha-branch   # API
```

Sem `-f ref`, publica a `main`. Site e API são independentes: publique os dois quando a mudança
mexer nos dois.

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
