# Spec — Audiolivros no Storyverse

**Status:** frontend e API do admin implementados em 01/11/2026; segurança e validação de publicação revisadas em 02/11/2026; player e leitor pendentes
**Data:** 01/11/2026
**Repositórios:** `story-magic` (web) e `story-verse-api` (API Spring Boot)
**Fonte do áudio do piloto:** LibriVox (domínio público)

---

## 1. Objetivo

Permitir que um livro do catálogo tenha uma **edição em áudio** com narração humana, mantendo a mesma estante, o mesmo progresso, os mesmos personagens e o mesmo chat. O áudio não é um produto separado: é uma forma de consumir o mesmo livro.

O piloto usa audiolivros do LibriVox, com texto em EPUB também em domínio público. A experiência precisa funcionar em dois formatos:

1. **Um arquivo por capítulo/seção** (preferido).
2. **Um único MP3** com os capítulos marcados por tempos (fallback).

## 2. Decisões de produto

| Tema | Decisão |
|---|---|
| Posicionamento | Edição em áudio **atrelada ao livro**, não um catálogo separado. |
| Fonte | LibriVox, com atribuição ao narrador e à LibriVox. |
| Texto | EPUB de domínio público; o texto e o áudio precisam ser mapeados por capítulo. |
| Direitos | Reutilizar `public_domain`, `own_work` e `free_license` do catálogo. No piloto, texto e áudio são `public_domain`. |
| Armazenamento | Cloudflare R2, bucket privado `catalog-audio`, com URLs assinadas. |
| Acesso | Capítulo 1 grátis; capítulos 2+ exigem sessão e assinatura ativa. |
| Player | Player próprio no app (HTML5 Audio + Media Session + Wake Lock), sem biblioteca de terceiros. |
| Sincronização | Capítulo no MVP; destaque por parágrafo na fase 2. |
| Gamificação | Minutos ouvidos contam para a meta e a sequência, com métrica separada e sem contar duas vezes. |
| Offline | Fase 2, via Cache Storage/IndexedDB. |
| Autor parceiro | Painel do autor fica fora desta spec; ele é só para livros escritos. |
| Ingestão | Admin/curadoria. Piloto manual + planilha; importador LibriVox por ID depois. |

## 3. Fora de escopo (v1)

- Geração de áudio por TTS para estes audiolivros. O TTS continua existindo como "Ouvir" para livros sem áudio.
- Painel do autor para envio de áudio.
- DRM, aluguel, compra avulsa de capítulo, moedas ou anúncios.
- Vozes diferentes por personagem.
- Sincronização por parágrafo no piloto.
- Download offline no piloto.
- Player nativo fora do PWA.
- Música, efeitos sonoros e vídeo.
- Tradução automática do áudio.

## 4. Experiência do usuário

### 4.1 Entradas

- **Página do livro:** botão "Ouvir", com duração total, narrador e selo "Domínio público · LibriVox".
- **Leitor:** botão de fone no cabeçalho; abre o capítulo de áudio mapeado para o capítulo de texto atual.
- **Início:** cartão "Continuar ouvindo" quando houver progresso.
- **Estante:** ação "Ouvir" nos livros com áudio.
- **Player global:** mini-player fixo enquanto houver áudio carregado.

### 4.2 Player

- **Mini-player:** capa, título, capítulo, play/pause, barra de progresso e botão para expandir.
- **Player completo:** capa, título, autor, narrador, capítulo atual, barra com marcas de capítulo, play/pause, voltar/avançar 15 s, capítulo anterior/próximo, velocidade (0,75× a 2×), timer para dormir (15/30/45/60 min ou fim do capítulo), lista de capítulos, "Ler junto" e download (fase 2).
- **Media Session:** título, artista (narrador), álbum (livro), capa e handlers de play/pause/seek/next/prev.
- **Wake Lock:** manter a tela acordada enquanto estiver tocando, quando suportado.
- **Retomada:** salvar a cada 5–10 s e em pause/`visibilitychange`/`pagehide`; sincronizar com o servidor com debounce.
- **Um player só:** abrir outro audiolivro substitui o atual; a pessoa pode pausar/retomar pelo mini-player.
- **Erros:** 401/402 mostram o paywall; URL expirada renova; falha de rede tenta de novo; áudio indisponível mostra mensagem clara.

### 4.3 Integração com leitura

- **Capítulo:** quando o áudio muda de capítulo, o leitor de texto acompanha o capítulo mapeado (se estiver aberto).
- **Chat:** o contexto do personagem passa a usar o capítulo de texto mapeado ao tempo atual, não a rolagem. Isso evita spoiler e resposta sobre outro trecho.
- **Mensagens automáticas:** ao trocar de capítulo de áudio, reutilizar `readingAmbient` somente com o app visível.
- **Áudio de fundo:** o chat não é atualizado enquanto a tela está bloqueada; ao voltar, ele usa a posição salva.
- **Estatísticas:** minutos ouvidos entram em `readingStats` como métrica separada; a meta e a sequência consideram leitura + escuta. Enquanto o áudio estiver tocando, o tempo não soma também como leitura, para não contar duas vezes.
- **Conquistas:** fase 2 ("primeiro audiolivro", "10 horas ouvidas", "terminou um audiolivro").

## 5. Modelo de dados

Migration nova no `story-verse-api` (Flyway). Reutiliza `catalog_books` e o enum de direitos já existente no catálogo.

### 5.1 Edição em áudio

```sql
create table public.catalog_book_audio (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.catalog_books (id) on delete cascade,
  language text not null default 'pt',
  narrator text,
  source text not null default 'librivox'
    check (source in ('librivox', 'admin', 'partner')),
  source_url text,
  rights text not null default 'public_domain'
    check (rights in ('public_domain', 'own_work', 'free_license')),
  rights_note text,
  license_note text,
  text_mapping text not null default 'pending'
    check (text_mapping in ('pending', 'mapped', 'none')),
  total_duration_seconds integer not null default 0 check (total_duration_seconds >= 0),
  chapter_count integer not null default 0 check (chapter_count >= 0),
  cover_url text,
  status text not null default 'draft'
    check (status in ('draft', 'processing', 'published', 'hidden', 'failed')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.catalog_book_audio (book_id, status);
create index on public.catalog_book_audio (status, published_at desc);
```

### 5.2 Capítulos de áudio

```sql
create table public.catalog_audio_chapters (
  id uuid primary key default gen_random_uuid(),
  audio_id uuid not null references public.catalog_book_audio (id) on delete cascade,
  chapter_index integer not null check (chapter_index > 0),
  title text,
  audio_path text not null,                 -- chave privada no R2
  mime_type text not null default 'audio/mp4',
  duration_seconds integer not null check (duration_seconds >= 0),
  start_seconds integer not null default 0 check (start_seconds >= 0),
  end_seconds integer,
  size_bytes bigint,
  checksum text,
  text_chapter_index integer check (text_chapter_index is null or text_chapter_index > 0),
  text_chapter_end_index integer
    check (text_chapter_end_index is null or text_chapter_end_index >= text_chapter_index),
  status text not null default 'ready'
    check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  unique (audio_id, chapter_index)
);

create index on public.catalog_audio_chapters (audio_id, chapter_index);
```

- Em arquivos por capítulo: `start_seconds = 0` e `end_seconds = duration_seconds`.
- Em arquivo único: todos os capítulos apontam para o mesmo `audio_path` e usam `start_seconds`/`end_seconds` para navegar.
- `text_chapter_index` aponta para o índice do capítulo produzido por `splitIntoChapters` no leitor.
- `text_chapter_end_index` permite mapear um capítulo de áudio para um intervalo de capítulos de texto.

### 5.3 Progresso de escuta

```sql
create table public.audio_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  audio_id uuid not null references public.catalog_book_audio (id) on delete cascade,
  chapter_index integer not null default 1 check (chapter_index > 0),
  position_seconds integer not null default 0 check (position_seconds >= 0),
  playback_rate numeric(3,2) not null default 1.0
    check (playback_rate between 0.5 and 2.0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, audio_id)
);
```

O progresso é local-first. O servidor serve para retomada entre aparelhos; se falhar, a escuta continua no aparelho.

### 5.4 Importação em lote

Para o piloto, o cadastro é manual. A planilha de importação (fase 1.5) usa:

```text
book_key, audio_language, narrator, source, source_url, rights, rights_note,
license_note, chapter_file, chapter_index, chapter_title, start_seconds,
end_seconds, text_chapter_index, text_chapter_end_index
```

- `chapter_file` é o nome do arquivo enviado no ZIP; em arquivo único, o mesmo nome se repete com `start_seconds`/`end_seconds` diferentes.
- `book_key` precisa existir em `catalog_books`.
- O importador faz dry-run, relatório de erros e não publica automaticamente.

## 6. API

### 6.1 Público

```http
GET /api/v1/catalog/books/{bookKey}/audio
```

Devolve metadados públicos e o manifesto, sem caminhos do R2:

```json
{
  "editions": [
    {
      "id": "uuid",
      "language": "pt",
      "narrator": "Nome do narrador",
      "source": "librivox",
      "sourceUrl": "https://librivox.org/...",
      "rights": "public_domain",
      "licenseNote": "LibriVox · domínio público",
      "totalDurationSeconds": 36000,
      "chapterCount": 12,
      "coverUrl": "https://...",
      "freeChapterIndex": 1,
      "requiresSubscription": true,
      "chapters": [
        {
          "index": 1,
          "title": "Capítulo I",
          "durationSeconds": 1800,
          "textChapterIndex": 1,
          "textChapterEndIndex": 1,
          "free": true
        }
      ]
    }
  ]
}
```

```http
GET /api/v1/catalog/books/{bookKey}/audio/{audioId}/chapters/{index}/stream
```

- Capítulo 1: liberado sem sessão, com limite de taxa por IP.
- Capítulos 2+: exigem sessão e `requireAccess` (assinatura ativa). Com `BILLING_ENABLED=false`, basta sessão, como no catálogo.
- Resposta: `302` para URL assinada do R2 com TTL curto (10 min), ou proxy da API com `Range`.
- `Range` é suportado para busca e retomada.
- Não devolver `audio_path` em nenhuma resposta pública.

```http
GET /api/v1/me/audio/{audioId}
PUT /api/v1/me/audio/{audioId}
```

Corpo do `PUT`:

```json
{
  "chapterIndex": 3,
  "positionSeconds": 412,
  "playbackRate": 1.25,
  "completed": false
}
```

- Valida `chapterIndex` contra o manifesto, `positionSeconds` contra a duração e `playbackRate` entre 0,5 e 2,0.
- Idempotente; atualiza `updated_at`.

### 6.2 Admin

```http
GET    /api/v1/admin/catalog/books/{bookId}/audio
POST   /api/v1/admin/catalog/books/{bookId}/audio
PATCH  /api/v1/admin/catalog/audio/{audioId}
POST   /api/v1/admin/catalog/audio/{audioId}/upload-url
POST   /api/v1/admin/catalog/audio/{audioId}/chapters
PATCH  /api/v1/admin/catalog/audio/{audioId}/chapters/{index}
POST   /api/v1/admin/catalog/audio/{audioId}/process
POST   /api/v1/admin/catalog/audio/{audioId}/publish
POST   /api/v1/admin/catalog/audio/{audioId}/hide
DELETE /api/v1/admin/catalog/audio/{audioId}
GET    /api/v1/admin/catalog/audio/{audioId}/status
POST   /api/v1/admin/catalog/audio/imports
GET    /api/v1/admin/catalog/audio/imports/{id}
```

- Upload de arquivos grandes usa **URL assinada de PUT no R2**: `POST /upload-url` recebe `{ fileName, contentType, sizeBytes }` e devolve `{ uploadUrl, path }`; o admin envia o arquivo direto para o R2 e depois registra o caminho na API.
- `POST /chapters` recebe `{ path, chapterIndex, title, durationSeconds, startSeconds, endSeconds, sizeBytes }`. Em arquivo único, o mesmo `path` se repete com tempos diferentes; em arquivos por capítulo, cada `path` é próprio.
- A resposta do admin inclui `audio_path` por capítulo (nunca na API pública) para a tela conseguir adicionar outros capítulos do mesmo arquivo.
- `process` roda em job assíncrono: `ffprobe` (duração), transcodificação, normalização e, quando aplicável, extração de capítulos.
- `publish` valida: pelo menos um capítulo, duração > 0, `text_mapping` diferente de `pending` (`mapped` exige ao menos um capítulo ligado ao texto; `none` é a decisão explícita de publicar sem chat contextual) e, quando os direitos não são `public_domain`, `rights_note` preenchido.
- Só o papel `storyverse_api` lê `catalog_audio_chapters`; `anon`/`authenticated` não recebem grant nessa tabela para não expor `audio_path`.
- Auditoria: `catalog.audio.create`, `.update`, `.publish`, `.hide`, `.delete`, `.chapter.map`, `.import`.

## 7. Armazenamento e mídia

### 7.1 Cloudflare R2

- Bucket **privado** `catalog-audio`.
- Chaves:
  - `books/<bookKey>/<audioId>/original/<arquivo>`
  - `books/<bookKey>/<audioId>/chapters/<index>.m4a`
- URLs assinadas de leitura com TTL de 10 minutos.
- URLs assinadas de upload (admin) com TTL de 15 minutos e limite de tamanho.
- CORS liberado para a origem do app, com `GET`, `HEAD` e `Range`.
- Credenciais só no servidor; nunca em `VITE_*`.
- R2 tem egress zero; o custo principal é armazenamento e processamento.

### 7.2 Formato

- Fonte LibriVox: MP3 (geralmente 64–128 kbps).
- Saída recomendada: **AAC 64 kbps mono em `.m4a`** para voz.
- Normalização: `loudnorm` em torno de −18 LUFS, pico −1,5 dB.
- Manter o original quando o espaço permitir; se não, guardar só a fonte `source_url` e o derivado.
- Fallback MP3 96 kbps se houver problema de compatibilidade em algum navegador.
- Capa: usar a capa do EPUB/catálogo; se não houver, usar a capa da LibriVox.

### 7.3 Arquivo único vs. capítulos

- **Preferido:** baixar as seções individuais da página da LibriVox e ter um arquivo por capítulo.
- **MP3 único com marcadores:** extrair os tempos (`ffprobe`, frames CHAP, M4B) e gravar `start_seconds`/`end_seconds`.
- **MP3 único sem marcadores:** o admin informa os tempos ou usa `silencedetect` como sugestão; nunca publicar sem revisão.
- O player funciona nos dois casos. Dividir o arquivo é opcional; para offline, dividir melhora o cache por capítulo.

## 8. Ingestão e curadoria

### 8.1 Fluxo do piloto

1. Escolher 3 títulos da LibriVox:
   - um com arquivos por capítulo;
   - um com MP3 único;
   - um com mapeamento de texto incerto.
2. Verificar que o texto do EPUB é de domínio público e compatível com a gravação.
3. Registrar `source_url`, narrador, idioma e licença.
4. Subir o EPUB pelo fluxo atual de catálogo (texto) e o áudio pelo novo fluxo.
5. Mapear capítulos de áudio para capítulos de texto.
6. Publicar e testar.

### 8.2 Tela do admin

Na página do livro do catálogo, nova aba **Áudio**:

- Adicionar edição: idioma, narrador, fonte, `source_url`, direitos, licença, capa.
- Upload de arquivos (múltiplos) ou de um arquivo único.
- Lista de capítulos com título, duração, tamanho e status.
- Mapeamento: para cada capítulo de áudio, selecionar o capítulo de texto (ou intervalo).
- Prévia: tocar 30 s de um capítulo e ver o texto mapeado.
- Processamento: barra de status, erros e botão de tentar de novo.
- Publicar/ocultar/remover.
- Aviso quando a quantidade de capítulos de áudio e texto não bate.

### 8.3 Mapeamento automático

- Primeiro por ordem (áudio 1 → texto 1).
- Depois por título normalizado (ex.: "Chapter I" / "Capítulo I").
- Se as contagens baterem, sugerir o mapeamento por ordem e pedir confirmação.
- Se não baterem, exigir revisão manual e permitir intervalo (`text_chapter_end_index`).
- Um capítulo de áudio sem texto pode ser publicado como "sem chat contextual", com aviso no admin.

## 9. Frontend

### 9.1 Módulos novos

```text
src/lib/audiobooks.ts          manifesto, stream assinado, progresso
src/lib/audioPlayer.ts         estado do player e persistência local
src/lib/mediaSession.ts        Media Session + Wake Lock
src/features/audiobook/
  AudiobookProvider.tsx        player global (contexto + <audio>)
  MiniPlayer.tsx
  AudiobookPlayer.tsx          player completo
  ChapterList.tsx
  AudioBookPage.tsx           detalhe/entrada do audiolivro
  useAudiobook.ts              hooks de leitura do manifesto/progresso
  audiobook.css
```

### 9.2 Integrações

- `src/features/catalog/PublicBookPage.tsx`: botão "Ouvir" e metadados do narrador.
- `src/App.tsx`: montar o `AudiobookProvider` no shell e o mini-player; botão de fone no leitor.
- `src/lib/readingContext.ts`: aceitar `audioChapterIndex` e usar o capítulo de texto mapeado.
- `src/lib/readingAmbient.ts`: disparar mensagens na troca de capítulo de áudio.
- `src/lib/readingStats.ts`: `listeningSeconds`, `lastListenedAt`; meta/sequência sem dupla contagem.
- `src/lib/billing.ts` / `useSubscription.ts`: paywall do capítulo 2+.
- `src/lib/backend.ts`: reutilizar `apiRequest`/`apiFetch` e renovação de sessão.
- `src/lib/pwa.ts` / `public/sw.js`: fase 2, cache de áudio sob demanda.
- `src/lib/speech.ts` e `naturalVoice.ts`: não mudam; continuam sendo o "Ouvir" sintetizado para livros sem áudio.

### 9.3 Persistência local

- Chave local por `audioId`: capítulo, posição, velocidade, atualizado em.
- Salvar a cada 5–10 s e em eventos de saída.
- Ao abrir o livro, local primeiro; servidor depois; o mais recente vence.
- Ao sair da conta, limpar o progresso local daquela conta (padrão `dataOwner`).

## 10. Acesso e assinatura

- Manifesto e metadados: públicos.
- Capítulo 1: público, com limite de taxa; serve como amostra.
- Capítulos 2+: sessão + assinatura ativa (`requireAccess`).
- Com `BILLING_ENABLED=false`: sessão basta.
- `401`: pedir login; `402`: mostrar CTA de assinatura e o primeiro capítulo continua acessível.
- Admin/moderador pode pré-visualizar todos os capítulos.
- O player trata `401/402` sem perder a posição local.

## 11. Offline (fase 2)

- Download por capítulo ou do livro inteiro.
- Cache Storage/IndexedDB com manifesto local; tamanho exibido antes de baixar.
- Opção "somente Wi-Fi"; limite de armazenamento por conta; expiração e botão de apagar.
- Reprodução offline por Blob URL; o player usa o mesmo estado.
- Sem DRM. Baixar exige sessão + assinatura no momento do download; se a assinatura cair depois, o arquivo local continua tocando até ser removido. Documentar essa limitação.
- iOS pode apagar o cache; o app precisa avisar e permitir baixar de novo.
- Não armazenar áudio no service worker por padrão; só o que a pessoa baixar.

## 12. Segurança e direitos

- Bucket privado; nenhuma resposta pública expõe `audio_path`.
- URLs assinadas curtas; renovação no player.
- Rate limit no endpoint de stream e no capítulo grátis.
- Validar `chapterIndex`, `positionSeconds` e `playbackRate` no servidor.
- `source_url` é metadado administrativo; não é buscado em runtime.
- LibriVox: exibir "Narração: [narrador] · LibriVox · domínio público" com link para a fonte.
- Texto e áudio precisam ser de domínio público ou ter licença escrita; registrar a justificativa em `rights_note`/`license_note`.
- Auditoria de criação, publicação, ocultação e remoção.
- Não usar Supabase Storage para áudio; o fluxo é R2 via API.
- Nunca colocar credenciais do R2 em variáveis `VITE_*`.

## 13. Métricas

Eventos:

- `audio_manifest_view`
- `audio_play`
- `audio_pause`
- `audio_chapter_complete`
- `audio_book_complete`
- `audio_paywall_hit`
- `audio_error`
- `audio_download` (fase 2)

Agregados:

- ouvintes únicos;
- minutos ouvidos por dia;
- taxa de conclusão por livro/capítulo;
- conversão do capítulo grátis para assinatura;
- erros de stream e tempo de buffering;
- armazenamento e egress do R2.

## 14. Testes

### 14.1 Unitários

- Manifesto: parsing, capítulos, duração, capítulo grátis.
- Mapeamento: ordem, título, intervalo, contagens divergentes.
- Progresso: merge local/servidor, validação de limites, velocidade.
- Player: play/pause, seek, próximo/anterior, fim de capítulo, erro 401/402.
- Estatísticas: minutos ouvidos, sem dupla contagem, sequência.

### 14.2 API

- Manifesto público sem caminhos de storage.
- Capítulo 1 sem sessão; capítulo 2 sem sessão = 401; sem assinatura = 402.
- URL assinada expirada renova.
- `Range` funciona em arquivo único e por capítulo.
- Progresso idempotente e validado.
- `publish` recusa edição incompleta.

### 14.3 QA manual

- EPUB com capítulos iguais aos do áudio.
- MP3 único com tempos.
- Contagem de capítulos diferente (mapeamento manual).
- Android: background e tela bloqueada.
- iOS: background e tela bloqueada (PWA).
- Retomada após recarregar e em outro aparelho.
- Paywall do capítulo 2.
- Chat usando o capítulo correto, sem spoiler.
- Fase 2: download, modo avião, expiração, remoção.

## 15. Rollout

1. Migration e endpoints da API.
2. Upload/processamento/mapeamento no admin.
3. Manifesto + player + progresso no web.
4. Integração com leitor, chat e estatísticas.
5. Piloto com 3 títulos, atrás da feature `audiobooks` por conta.
6. QA e ajustes; liberar para assinantes.
7. Fase 2: offline, parágrafo, conquistas, importador LibriVox por ID.

Rollback: ocultar as edições de áudio e desligar a feature. Os arquivos permanecem no R2; o progresso não é apagado.

## 16. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Mapeamento errado entre áudio e texto | Piloto com 3 casos, revisão manual, aviso quando as contagens divergem. |
| MP3 único sem marcadores | Preferir seções da LibriVox; se não, timestamps manuais/silence detect com revisão. |
| EPUB de edição diferente da gravação | Verificar antes de publicar; usar edição pública compatível ou mapear por intervalo. |
| Background no iOS PWA | Spike no início; se falhar, deixar claro que a escuta em segundo plano é limitada no iPhone. |
| Custo de armazenamento/banda | R2 com egress zero, AAC 64 kbps, cache e limites por conta. |
| URL assinada expirando durante a escuta | Renovação automática antes do vencimento. |
| Chat dar spoiler | Contexto por capítulo mapeado; nunca enviar capítulos posteriores. |
| Direitos do texto | Só EPUB de domínio público ou licença escrita; registrar fonte. |
| Offline sem DRM | Limitar a domínio público; documentar que não há proteção contra cópia. |

## 17. Decisões abertas

- Capítulo 1 público para visitantes ou só para contas logadas? **Recomendação:** público, como amostra.
- AAC 64 kbps mono ou MP3 96 kbps? **Recomendação:** AAC 64 kbps, com fallback MP3 se necessário.
- Dividir o MP3 único ou manter com timestamps? **Recomendação:** manter com timestamps no MVP; dividir só quando ajudar no offline.
- Contar escuta na sequência/meta? **Recomendação:** sim, com métrica separada e sem dupla contagem.
- Importador LibriVox por ID agora ou depois? **Recomendação:** depois do piloto.
- Rota dedicada `/ouvir/:bookKey` ou painel/player sobre a tela atual? **Recomendação:** painel no MVP; rota para deep link na fase 2.
- Limite de download offline por conta? **Recomendação:** definir na fase 2, com base no custo do R2.

## 18. Checklist do piloto

- [ ] 3 títulos escolhidos (um por capítulo, um MP3 único, um mapeamento incerto).
- [ ] Texto e áudio confirmados como domínio público.
- [ ] `source_url`, narrador e licença registrados.
- [ ] EPUB cadastrado no catálogo.
- [ ] Áudio enviado ao R2 e processado.
- [ ] Capítulos mapeados e revisados.
- [ ] Capítulo 1 grátis; capítulo 2 com paywall.
- [ ] Retomada local e entre aparelhos.
- [ ] Background/tela bloqueada testados em Android e iOS.
- [ ] Chat usando o capítulo correto.
- [ ] Minutos ouvidos contando na meta/sequência.
- [ ] Métricas e erros observados.
- [ ] Decisão de escalar para os demais títulos.
