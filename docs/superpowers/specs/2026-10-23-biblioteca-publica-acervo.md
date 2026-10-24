# Biblioteca pública / Acervo — Design

Data: 23/10/2026. Repositórios: `story-magic` (web) e `story-verse-api` (API).

## 1. Contexto e o que existe hoje

Hoje o acervo público é a tabela `book_submissions` com `status='approved'`. O admin só tem a tela de moderação (`/admin/moderacao/acervo`): aprovar/recusar, trocar capa, apagar e ver a prévia do texto. Não existe “Adicionar livro” no painel, edição de metadados, importação em lote, coleções ou destaque.

Do lado do leitor, um livro aprovado aparece em “Da comunidade”/“Novidades” e pode ser lido, conversado e colocado na estante. O usuário importa o acervo pessoal localmente; se quiser publicar, envia para a comunidade e espera a aprovação.

Para uma biblioteca pública com muitos livros, isso não basta:

- o admin precisa se passar por usuário para cadastrar um livro;
- não dá para corrigir título/autor/gênero/descrição na curadoria;
- não há lote, coleções, destaques, busca pública organizada nem detecção de duplicados;
- a origem (admin, comunidade, importação) fica misturada.

## 2. Objetivos

1. Separar **catálogo público curado** de **envios da comunidade**.
2. Dar ao admin uma área “Acervo” para adicionar, editar, publicar/ocultar, importar em lote, organizar em coleções e destacar livros.
3. Ter uma **biblioteca pública** navegável: busca, filtros, destaques, novidades e página do livro.
4. Manter o acervo pessoal do usuário privado; publicar continua sendo uma ação explícita com direitos e curadoria.
5. Migrar os aprovados atuais sem quebrar a estante, o chat ou as chaves `cm:` já usadas.

## 3. Não objetivos

- DRM, aluguel, empréstimo ou leitura paga por livro.
- Resenhas públicas, notas públicas e moderação de resenhas (Fase 2 da estante).
- Recomendações por perfil, “quem leu também leu” e OPDS.
- Edição de traduções ou texto no navegador.
- Escanear/OCR de PDFs e EPUBs complexos nesta fase (ver formatos).
- Substituir o acervo pessoal/importação local; ele continua existindo.

## 4. Modelo de dados

### 4.1 Catálogo (`catalog_books`)

- `id uuid primary key default gen_random_uuid()`
- `book_key text not null unique` — `cat:<uuid>` para livro criado no admin/importação; `cm:<submission_id>` para envio aprovado (preserva a chave atual).
- `source text not null` — `admin`, `community`, `import`.
- `submission_id uuid unique references book_submissions(id) on delete set null` — origem quando veio da comunidade.
- `title text not null`, `author text`, `genre text`, `language text not null default 'pt'`
- `series text`, `series_index numeric`, `description text`
- `rights text not null` (`public_domain`, `own_work`, `free_license`), `rights_note text`
- `storage_bucket text not null default 'catalog-books'`, `text_path text not null`, `char_count integer`
- `checksum text` — SHA-256 do texto normalizado, para duplicados.
- `cover_url text`
- `status text not null default 'draft'` (`draft`, `published`, `hidden`, `archived`)
- `featured boolean not null default false`, `sort_order integer not null default 0`
- `published_at timestamptz`, `created_by uuid references auth.users(id) on delete set null`
- `created_at`, `updated_at timestamptz not null default now()`
- `duplicate_of uuid references catalog_books(id) on delete set null`

Índices: `(status, published_at desc)`, `(genre, language)`, `(featured, sort_order)`, `lower(title)`, `checksum`, `submission_id`.

### 4.2 Coleções

- `catalog_collections (id, slug unique, title, description, status draft|published, sort_order, created_at, updated_at)`
- `catalog_collection_books (collection_id, book_id, sort_order, primary key (collection_id, book_id))`

Coleções são curadoria (“Clássicos”, “Para começar”, “Machado de Assis”), não tags livres.

### 4.3 Importações em lote

- `catalog_imports (id, created_by, status queued|running|done|failed, file_name, total, imported, skipped, error, created_at, finished_at)`
- `catalog_import_items (import_id, line, file_name, status imported|skipped|error, message, catalog_book_id)`

### 4.4 Envios da comunidade

`book_submissions` continua como caixa de entrada e histórico. Aprovar cria/atualiza uma linha em `catalog_books` com `book_key = cm:<submission_id>`, `source='community'`, `storage_bucket='community-books'` e o mesmo `text_path`. O envio não é apagado ao aprovar; fica para proveniência e auditoria. Rejeitar não cria catálogo.

### 4.5 Chave do livro e estante

- `cm:<submission_id>` continua valendo para aprovados da comunidade (sem quebrar a estante).
- `cat:<catalog_id>` é usado para livros criados no admin/importação.
- A validação de `bookKey` da estante (V15) e o cliente (`bookKeyOf`) passam a aceitar `cat:`.

## 5. Área do admin: “Acervo”

Rota `/admin/acervo` com abas:

### 5.1 Catálogo

- Lista com capa, título, autor, gênero, idioma, status, destaque, coleções e atualização.
- Busca por título/autor/bookKey e filtros por status, gênero, idioma, origem, destaque e coleção.
- Ações em massa: publicar, ocultar, destacar, adicionar a coleção, arquivar.
- **Adicionar livro** (assistente):
  1. arquivo (TXT/MD nesta fase);
  2. metadados (título, autor, gênero, idioma, série, descrição);
  3. direitos (`public_domain`, `own_work`, `free_license`) + justificativa;
  4. capa (upload ou buscar na Open Library);
  5. coleções/destaque/ordem;
  6. salvar rascunho ou publicar.
- **Editar** metadados, capa, texto (substituir arquivo com nova versão e checksum) e coleções.
- **Publicar/ocultar/arquivar** com confirmação; arquivar não apaga o arquivo nem a estante de quem já leu.
- **Prévia** do texto, como na moderação atual.
- Duplicados: ao salvar/importar, avisar se o checksum ou título+autor normalizado já existe; permitir “importar mesmo assim” com motivo e auditoria.

### 5.2 Envios

- A moderação atual (pendentes/publicados), com a mesma prévia, aprovação, recusa, capa e remoção.
- Aprovar cria o catálogo; a linha de envio mostra “Publicado no catálogo” com link para o livro.
- O admin pode **enviar um livro como admin** pelo catálogo, sem usar o fluxo de usuário.

### 5.3 Importações

- Upload de um ZIP com arquivos `.txt`/`.md` e um `metadata.csv` (`file,title,author,genre,language,series,series_index,rights,rights_note,description,cover_url,collection`).
- Prévia/dry-run: lista o que será importado, duplicados, erros de CSV e arquivos faltando.
- Execução em job; progresso; relatório final com importados/pulados/erros; baixar CSV de erros.
- Limite por lote (ex.: 100 livros/200 MB) e por arquivo (mesmo limite do bucket); recusar lote grande demais.
- Cada item importado gera auditoria e um livro `source='import'`.

### 5.4 Coleções e destaques

- CRUD de coleções, ordem dos livros e publicação.
- “Destaques” é uma coleção especial ou `featured` com `sort_order`; a home usa a ordem.

### 5.5 Papéis

| Ação | superadmin | moderator |
|---|:-:|:-:|
| Ver o acervo e a prévia | ✓ | ✓ |
| Adicionar/editar/publicar/ocultar livro | ✓ | ✓ |
| Importar em lote | ✓ | ✓ |
| Arquivar/apagar livro | ✓ | — |
| Gerenciar coleções/destaques | ✓ | ✓ |
| Moderar envios | ✓ | ✓ |

Toda ação grava auditoria: `catalog.create`, `catalog.update`, `catalog.publish`, `catalog.hide`, `catalog.archive`, `catalog.cover`, `catalog.import`, `collection.create/update/delete`, `book_submission.review`.

## 6. Biblioteca pública (web)

- Rota `/biblioteca` (substitui a ideia de “Da comunidade” como único acervo):
  - busca por título/autor;
  - filtros por gênero, idioma, coleção e “disponível para ler”;
  - destaques e novidades;
  - grid/lista com capa, título, autor, gênero e status de leitura (quando logado);
  - paginação por cursor.
- Página do livro `/biblioteca/:bookKey`:
  - capa, título, autor, gênero, idioma, série, descrição, direitos e coleções;
  - ações: Ler, Conversar, Adicionar à estante;
  - se o livro veio de envio, crédito discreto à comunidade (sem expor e-mail).
- A home usa o catálogo para “Novidades”, “Destaques” e “Da comunidade” (com origem/filtro).
- O leitor recebe o texto por um endpoint do catálogo com sessão e assinatura (ver 8.3), não por um caminho de storage aberto.
- O acervo pessoal do usuário continua em “Meus livros”/importados, separado do catálogo.

## 7. Fluxo do usuário

- Importar livro local: continua privado.
- “Enviar para a biblioteca” (antigo envio à comunidade): escolhe arquivo/metadados, declara direitos e acompanha o status.
- Aprovado: o livro entra no catálogo com `cm:<submission_id>` e aparece na biblioteca; a estante/chat que já usavam `cm:` continuam funcionando.
- Recusado: o envio mostra o motivo; o arquivo pode ser removido pelo dono.
- O usuário não publica direto; toda publicação passa por curadoria.

## 8. API

### 8.1 Público

- `GET /api/v1/catalog/books?q=&genre=&language=&author=&collection=&featured=&sort=&cursor=&limit=` — só `published`; retorna metadados e `bookKey`, sem caminho de storage.
- `GET /api/v1/catalog/books/{bookKey}` — detalhe público.
- `GET /api/v1/catalog/collections` — coleções publicadas com seus livros.
- `GET /api/v1/catalog/featured` — destaques na ordem.
- `GET /api/v1/catalog/books/{bookKey}/text` — texto (sessão + assinatura ativa, conforme a spec de assinatura); não expõe `text_path`.

### 8.2 Admin

- `GET /api/v1/admin/catalog/books?status=&q=&genre=&language=&collection=&cursor=`
- `POST /api/v1/admin/catalog/books` — metadados + arquivo já enviado ao storage; cria `draft` ou já publica.
- `PATCH /api/v1/admin/catalog/books/{id}` — metadados, coleções, destaque.
- `POST /api/v1/admin/catalog/books/{id}/publish|hide|archive`
- `PUT /api/v1/admin/catalog/books/{id}/cover`
- `POST /api/v1/admin/catalog/books/{id}/text` — substituir arquivo (nova versão).
- `POST /api/v1/admin/catalog/imports` — multipart ZIP+CSV; dry-run e execução.
- `GET /api/v1/admin/catalog/imports/{id}` / `GET .../{id}/errors.csv`
- `GET/POST/PATCH/DELETE /api/v1/admin/catalog/collections` e `PUT /{id}/books` (ordem).
- `GET /api/v1/admin/catalog/duplicates?checksum=&title=&author=`
- Aprovar envio continua em `PATCH /api/v1/community/submissions/{id}` com `status=approved`; a resposta inclui o `catalogBookId`/`bookKey`.

### 8.3 Storage e texto

- Buckets: `community-books` (envios e aprovados da comunidade) e `catalog-books` (admin/importação).
- O catálogo guarda `storage_bucket` + `text_path`; só o backend lê. O leitor usa `GET /catalog/books/{bookKey}/text`.
- O endpoint exige sessão e assinatura ativa (paywall total); devolve `text/plain` com limite de tamanho e cache curto.
- Covers em `profile-media`/urls existentes; upload de capa do catálogo passa pelo mesmo `uploadBookCover`/API.

## 9. Migração e compatibilidade

- Migração própria (proposta `V17__catalog.sql` se o catálogo entrar antes da Fase 2 do admin; nesse caso as migrações do admin/finance passam para V18/V19).
- Cria tabelas, índices e RLS.
- Copia `book_submissions` com `status='approved'` para `catalog_books`:
  - `book_key = 'cm:' || submission.id`, `source='community'`, `submission_id=...`, `storage_bucket='community-books'`, `status='published'`, `published_at=reviewed_at`;
  - não apaga o envio; idempotente.
- O cliente passa a ler o catálogo; durante a migração, mantém fallback para os aprovados ainda não copiados.
- A estante/chat que usam `cm:` continuam válidos; livros novos do admin usam `cat:` e o `bookKey` da estante/API precisa aceitar `cat:`.
- A API de envio/revisão existente continua; a aprovação cria o catálogo na mesma transação e audita.
- Rollback: catálogo pode ser desligado por feature flag; os envios aprovados continuam servindo como fallback.

## 10. Formatos, direitos e qualidade

- **Formatos do MVP:** texto UTF-8 (`txt`, `md`); o leitor atual renderiza texto. EPUB/PDF entram depois com extração de texto no servidor; não prometer fidelidade de layout.
- **Tamanho:** mesmo limite do bucket (10 MB por arquivo no envio; lote com limite próprio).
- **Direitos:** obrigatórios; apenas domínio público, obra própria ou licença livre. A importação em lote exige a coluna de direitos; sem ela, item vai para erro.
- **Proveniência:** `source`, `created_by`, `submission_id`, `rights_note`; auditoria em toda mudança.
- **Takedown:** arquivar/ocultar imediatamente; manter o texto para auditoria? Não expor; registrar motivo e responsável.
- **Duplicados:** checksum do texto normalizado; título+autor normalizados; aviso e override com motivo.
- **Capa:** upload ou Open Library; nunca depender de terceiros para o livro abrir.

## 11. Busca e organização

- Filtros públicos: gênero, idioma, coleção, autor, disponibilidade e ordenação (novos, título, autor, mais lidos).
- Busca inicial com `ILIKE`/trigram; se crescer, `tsvector`/índice GIN. Não bloquear o MVP por busca avançada.
- Coleções com ordem; destaques com ordem própria.
- “Mais lidos/terminados” sai da estante/leitura; não de contadores falsos.

## 12. Métricas do acervo

- Livros publicados por origem/gênero/idioma; novos por período.
- Aberturas, conclusões e notas por livro (a partir da estante/reading state), sem PII.
- Envios pendentes/aprovados/recusados; tempo de análise.
- Alimenta a Fase 2 do admin (métricas) sem acoplar a tela.

## 13. Testes e QA

API:

- CRUD do catálogo, publicação/ocultação/arquivamento, papéis (moderator x superadmin);
- aprovar envio cria catálogo com `cm:` e preserva a estante; rejeitar não cria;
- `GET /catalog/books` só publicados; filtros/ordenação; texto exige sessão+assinatura;
- duplicados por checksum e título/autor; override auditado;
- importação em lote: CSV inválido, arquivo faltando, duplicado, limite, progresso/erros;
- migração idempotente dos aprovados; `cat:` aceito na estante;
- RLS/storage: catálogo não vaza `text_path`; admin lê/escreve o bucket correto.

Web:

- admin: lista, adicionar/editar/publicar/ocultar, capa, coleções, importação (dry-run e execução);
- biblioteca pública: busca/filtros, destaque, página do livro, ler/conversar/estante;
- home usa catálogo; `cm:` antigo continua abrindo; `cat:` novo abre e sincroniza na estante;
- permissões: moderator vê acervo, não arquiva; support não vê.
- QA: seed com 3–5 livros de domínio público, um lote ZIP+CSV e um duplicado; nada de obra protegida.

## 14. Ordem de entrega

1. **Base:** migração + catálogo + migração dos aprovados + API pública/admin de leitura.
2. **Admin:** adicionar/editar/publicar/ocultar + capa + prévia.
3. **Importação em lote:** dry-run, job, relatório de erros.
4. **Biblioteca pública:** página, filtros, destaques/coleções, home e leitura.
5. **QA/curadoria:** lote inicial de livros, revisão de direitos e lançamento.

Cada etapa é um PR (API e web) e passa pelo QA antes do `develop` → `main`.

## 15. Decisões abertas

- Bucket novo `catalog-books` ou reutilizar `community-books` com prefixo `catalog/`.
- Moderator pode arquivar/apagar ou só publicar/ocultar? A proposta é só superadmin arquiva.
- Formatos iniciais: só TXT/MD ou já extrair EPUB/PDF.
- Campos de metadados além dos listados (ISBN, editora, ano, tags).
- Coleções versus tags; “Destaques” como coleção ou flag.
- Leitura pública anônima x sessão+assinatura (a spec de assinatura assume paywall total).
- Política de duplicados (bloquear ou avisar) e takedown.
- Busca: `ILIKE` no MVP x full-text.
- Origem dos lotes iniciais (Gutenberg/Open Library) e verificação de direitos.
- Numeração da migração (V17 se o catálogo vier antes do admin/finance).
