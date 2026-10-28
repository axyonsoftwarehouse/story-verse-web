# Patch do banco de produção — revisão de segurança de 26/10/2026

Para quem cuida das releases. Este patch leva para o banco de **produção** as correções que já estão
no QA desde 27/10 (PR #111). Ele não depende de deploy de código: o frontend de produção atual
(`main`) continua funcionando igual (ver "Efeito para os usuários").

## O que corrige

1. **Capa de livro da comunidade** (`set_submission_cover`). Hoje quem enviou um livro pode trocar a
   capa **depois da aprovação**, sem moderação, e por uma imagem de **qualquer site**: bastava a URL
   conter `/profile-media/<id>/livros/` em qualquer parte (ex.: `https://site-qualquer/x.gif?a=/profile-media/<id>/livros/`).
   Isso permite publicar imagem imprópria num livro já aprovado, ou um pixel que registra o IP de
   quem abre o livro. Depois do patch, a capa só muda com o envio **em análise** e só por um arquivo
   da própria pessoa no Storage da API de produção.
2. **Foto do ranking** (`report_reading`): mesma brecha e mesma correção. O patch também apaga as
   fotos de ranking externas que já estiverem gravadas.
3. **Heartbeat de leitura** (`reading_heartbeat`): cada batida (a cada ~30 s, por leitor) pegava
   um lock **global** e exclusivo, e com isso todos os leitores entravam numa fila única. Agora o lock
   é compartilhado. Só o fechamento da semana (`close_reading_week`) pega o lock exclusivo, e ele
   também sai antes do lock quando a semana ainda está aberta ou já foi fechada.

## Arquivos

| No repositório | Na VPS |
|---|---|
| `deploy/sql/2026-10-26-revisao-seguranca-producao.sql` | `/home/deploy/storyverse/deploy/sql/` |
| `deploy/apply-sql-producao.sh` | `/home/deploy/storyverse/deploy/` |

O patch é idêntico ao do QA (`deploy/storyverse-qa/sql/2026-10-26-revisao-seguranca.sql`), exceto
pela origem de mídia (`https://api.storyverse.2.29.42.104.sslip.io`). Um teste em
`src/lib/sqlGuards.test.ts` garante que as funções dos dois patches são iguais às do `database/schema.sql`.

`apply-sql-producao.sh`:
- recusa rodar com o `.env` do QA;
- guarda as definições atuais das funções em `backups/funcoes/` antes de mudar qualquer coisa;
- compara as funções atuais com uma referência (opcional) e **para** se forem diferentes;
- só aplica depois de alguém digitar `APLICAR`.

Foi testado num Postgres 16 com o schema antigo: resposta errada cancela, referência diferente para
o script antes de aplicar, `.env` do QA é recusado, o caminho certo aplica e rodar de novo não muda nada.

## Passo a passo

Leva uns 10 minutos. O passo 3 deixa a API de produção fora do ar por alguns segundos (ou não, ver
a alternativa). Faça num horário de pouco uso.

**0. Copiar os arquivos** (de uma cópia do repositório com o PR já mergeado; atalho SSH `storyverse`):

```bash
scp deploy/apply-sql-producao.sh storyverse:/home/deploy/storyverse/deploy/
```
```bash
ssh storyverse "mkdir -p /home/deploy/storyverse/deploy/sql"
```
```bash
scp deploy/sql/2026-10-26-revisao-seguranca-producao.sql storyverse:/home/deploy/storyverse/deploy/sql/
```

No Windows, o Git pode ter gravado o `.sql` com CRLF. Na VPS, converta:

```bash
sed -i 's/\r$//' /home/deploy/storyverse/deploy/sql/2026-10-26-revisao-seguranca-producao.sql
```

**1. Backup completo do banco e da mídia** (o mesmo do cron diário):

```bash
bash /home/deploy/storyverse/deploy/backup.sh
```

**2. Aplicar, comparando com o QA.** O QA guardou as funções de antes do patch em
`/home/deploy/storyverse-qa/backups/20261027-010403-2026-10-26-revisao-seguranca.sql`. Se as da
produção forem iguais, é a mesma situação já validada no QA:

```bash
cd /home/deploy/storyverse && bash deploy/apply-sql-producao.sh deploy/sql/2026-10-26-revisao-seguranca-producao.sql /home/deploy/storyverse-qa/backups/20261027-010403-2026-10-26-revisao-seguranca.sql
```

- Se aparecer `Funções atuais iguais às da referência`, digite `APLICAR`. O fim esperado é
  `COMMIT` seguido de `Patch aplicado no banco storyverse.`
- Se aparecer `PARADO: as funções da produção são diferentes da referência`, alguma
  migração ou ajuste manual mudou essas funções na produção. **Não aplique às cegas.** Compare o
  arquivo de `backups/funcoes/` que o script acabou de criar com as funções de `database/schema.sql`.
  Se a diferença for só a produção estar mais antiga, o patch é a versão nova e dá para aplicar
  sem a referência (mesmo comando, sem o último argumento).

**3. Renovar as conexões da API** (o `app.media_origin` só vale em conexões novas):

```bash
cd /home/deploy/storyverse && docker compose restart api
```

Alternativa sem reiniciar: o pool de conexões da API se renova sozinho (em geral em até 30 min).
Até lá, a capa e a foto já exigem o caminho exato do Storage da pessoa. Só a checagem do domínio
fica para depois.

**4. Conferir:**

```bash
cd /home/deploy/storyverse && docker compose exec -T db psql -U storyverse -d storyverse -tA -c "select count(*) from pg_proc where proname = 'is_own_media_url'" -c "select position('xact_lock_shared' in pg_get_functiondef('public.reading_heartbeat(boolean)'::regprocedure)) > 0"
```
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.storyverse.2.29.42.104.sslip.io/api/v1/health/ready
```

O esperado: `1`, `t` e `200`. No app: abrir um livro e ler por um minuto (o ranking deve contar o
tempo) e abrir o ranking (as fotos aparecem).

## Desfazer

Use o arquivo que o script criou em `backups/funcoes/` (o nome aparece na saída do passo 2):

```bash
cd /home/deploy/storyverse && docker compose exec -T db psql -U storyverse -d storyverse -v ON_ERROR_STOP=1 < backups/funcoes/<arquivo>.sql
```
```bash
cd /home/deploy/storyverse && docker compose exec -T db psql -U storyverse -d storyverse -c "alter database storyverse reset app.media_origin"
```

A função nova `is_own_media_url` pode ficar: ela não é chamada pelas versões antigas e ninguém de fora
tem permissão para executá-la. As fotos de ranking apagadas no passo 2 voltam sozinhas na próxima vez
que a pessoa ler, se forem válidas.

## Efeito para os usuários

- Quem enviou um livro **já aprovado** não consegue mais trocar a capa sozinho. O admin continua
  podendo trocar pelo painel, que usa outra rota. O frontend de produção atual ainda tenta sincronizar
  essas capas depois do login: a tentativa falha em silêncio (só um aviso no console) e a imagem
  enviada é apagada. O `develop` já parou de tentar (vai junto na próxima release).
- Capas e fotos de outros sites deixam de ser aceitas. As que já estão em livros aprovados **não**
  são alteradas pelo patch: muitas são capas antigas da Open Library, legítimas.
- Leitura, ranking, diamantes e roleta continuam iguais.
