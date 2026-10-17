# Revisão geral — 16/10/2026

Escopo: frontend story-magic, bibliotecas locais, service worker, SQL de Supabase e configurações de deploy. A API Java do repositório vizinho e o estado real dos serviços de produção não foram auditados. A revisão não alterou código de aplicação nem executou ataques contra serviços remotos.

P1 = corrigir com prioridade; P2 = corrigir no próximo ciclo. Os cenários abaixo distinguem reproduções locais de conclusões por leitura do código.

## 1. P1 — Tokens de autenticação ficam nos diagnósticos

Referências: `src/main.tsx:11`, `src/lib/telemetry.ts:117`, `src/lib/telemetry.ts:189`, `src/lib/auth.ts:317`.

`installTelemetry()` roda antes de React consumir o retorno do Supabase. O evento inicial copia `location.href`, incluindo `#access_token=...&refresh_token=...`, para sessionStorage. Remover o fragmento depois não limpa esse evento. O relatório copiável de diagnóstico inclui o contexto completo e pode levar credenciais a quem receber o relatório.

Reprodução local com tokens fictícios: após instalar a telemetria, tanto o armazenamento de diagnósticos quanto a exportação continham os tokens. Não há evidência de envio automático desses eventos a terceiros.

Correção: registrar somente origem e caminho; remover parâmetros sensíveis de qualquer contexto e relatório; limpar eventos antigos que contenham credenciais. Processar o retorno de autenticação antes de instrumentar a sessão também reduz a exposição.

## 2. P1 — Troca de conta falha sem bloquear acesso aos dados anteriores

Referências: `src/lib/dataOwner.ts:83`, `src/lib/dataOwner.ts:94`, `src/App.tsx:4782`.

Se salvar o cofre exceder a quota, `swapOwner()` retorna `false`, exatamente como numa troca desnecessária. A interface já aceitou a nova sessão e não trata esse retorno como erro. Os dados ativos continuam sendo da conta anterior. Uma falha durante a restauração também pode deixar uma troca parcial, pois não existe rollback.

Reprodução local: conta A com conversa privada, `setItem(vault:A)` lançando erro de quota, ativação de B. Resultado: retorno `false`, dono ainda A e conversa de A ainda nas chaves ativas.

Correção: propagar falha explicitamente e bloquear componentes que usam dados pessoais até a ativação concluir; preferir armazenamento diretamente separado por conta, sem copiar e apagar todas as chaves.

## 3. P2 — EPUB permite expansão ilimitada de arquivo comprimido

Referências: `src/lib/importBook.ts:90`, `src/lib/importBook.ts:239`.

O teto de 80 MB limita somente a entrada comprimida. `unzipSync(buf)` expande todas as entradas antes de validar a estrutura EPUB, sem teto por entrada, teto agregado ou limite de quantidade de arquivos. Um EPUB preparado pode consumir muita memória e travar a aba, inclusive antes de ser reconhecido como inválido. A rotina síncrona bloqueia a interface.

Verificado por leitura; não foi executada uma expansão destrutiva de memória.

Correção: descompressão incremental com contador real de bytes emitidos, limites por entrada/agregados e processamento em worker. Validar o diretório ZIP ajuda, mas não substitui contar a saída real.

## 4. P2 — Dependências de desenvolvimento vulneráveis

Referências: `package.json:41`, `package.json:42`, `package-lock.json`.

`npm audit --json` informou 13 pacotes: 1 baixo, 4 moderados, 6 altos e 2 críticos. As contagens incluem dependências transitivas e propagação de severidade; não representam 13 explorações independentes confirmadas.

O build usou Vite 5.4.21 e os testes Vitest 2.1.9. O aviso oficial do Vite sobre bypass de `server.fs.deny` em Windows inclui essa versão, com condições como exposição do servidor de desenvolvimento à rede. O aviso crítico de Vitest citado abaixo depende do servidor UI ativo. Os scripts atuais não ativam essa UI, e a configuração Vite não define `host` público. Portanto, esses avisos não demonstram execução remota no site estático publicado.

Fontes oficiais consultadas:

- [Vite: bypass de proteção de arquivos no Windows](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).
- [Vitest: leitura e execução de arquivos com servidor UI ativo](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp).

Correção: atualizar as ferramentas e dependências transitivas para versões corrigidas compatíveis, revisar mudanças de versão principal e repetir build, testes e auditoria. Evitar `npm audit fix --force` sem avaliar a migração.

## 5. P2 — Sincronização de livros escreve na biblioteca após trocar de conta

Referências: `src/lib/bookSync.ts:116`, `src/lib/bookSync.ts:126`, `src/lib/bookSync.ts:155`.

O dono só é conferido no começo. Depois de operações assíncronas, `updateLibrary()` grava nas chaves globais da conta atualmente ativa. Se A estiver enviando um livro e outra aba entrar como B, o envio de A pode concluir e inserir seu identificador e estado de upload na biblioteca de B. B passa a tentar baixar um objeto inexistente na própria pasta. Isso contamina metadados entre contas; a reprodução não demonstrou acesso de B ao conteúdo privado de A no servidor.

Reprodução local com rede controlada: iniciar upload de A, trocar dono e biblioteca para B, concluir upload. A biblioteca de B recebeu o ID do livro de A com `uploadedAt`.

Correção: guardar biblioteca por ID da conta e revalidar o dono após cada espera e antes de qualquer escrita; cancelar trabalhos antigos ao mudar a sessão.

## 6. P2 — Exclusão remota é marcada como concluída mesmo quando falha

Referências: `src/lib/bookSync.ts:142`, `src/lib/bookSync.ts:143`.

O DELETE tem erro suprimido, mas `purgedAt` é gravado imediatamente. Numa falha de rede, 401 ou erro do Storage, o arquivo continua remoto e sincronizações seguintes pulam a exclusão porque o marcador já existe. O usuário acredita que removeu o livro de todos os dispositivos, enquanto o conteúdo continua armazenado.

Verificado por leitura do fluxo de erro.

Correção: gravar `purgedAt` somente depois de confirmação de exclusão, tratando objeto já inexistente como sucesso e mantendo os demais erros pendentes para nova tentativa.

## 7. P2 — Instabilidade inicial desativa IA até recarregar a página

Referências: `src/lib/ai.ts:237`, `src/lib/ai.ts:243`.

No caminho da API própria, falha de rede, timeout ou 5xx na consulta de status define `serverLive=false`. Como chamadas seguintes retornam sempre que o valor não é null, nenhuma consulta de recuperação acontece. Depois que o servidor volta, a mesma aba continua retornando respostas simuladas.

Verificado por leitura. Esse caminho não está habilitado no `.env.local` inspecionado.

Correção: separar serviço sem configuração de estado desconhecido/temporariamente indisponível, com expiração de cache e nova tentativa ao reconectar.

## 8. P2 — Resposta atrasada do chat entra em outro livro

Referências: `src/App.tsx:5860`, `src/App.tsx:5897`, `src/App.tsx:5280`.

`sendMessage()` espera a IA e depois atualiza o estado corrente de threads, usando o personagem capturado da chamada anterior. Não confere se o livro ou a conta continuam os mesmos. Sair do livro A e abrir B enquanto a resposta está pendente pode inserir a resposta de A em B. Isso é especialmente visível quando os dois livros usam IDs de personagens gerados como `ia-0` ou `narrador`; a conversa incorreta pode ser persistida em B. Um erro atrasado também pode restaurar a mensagem digitada de A no campo de B.

Verificado por leitura do fluxo assíncrono.

Correção: associar cada requisição a livro, conta e geração do leitor, descartando conclusões obsoletas e cancelando chamadas ao sair.

## 9. P2 — Minutos autodeclarados permitem manipular ranking e recompensas

Referências: `supabase/weekly-ranking.sql:154`, `supabase/weekly-ranking.sql:158`, `supabase/diamonds.sql:224`.

`report_reading` aceita os segundos escolhidos pelo cliente, inclusive para dias anteriores ainda abertos e para amanhã, limitando cada dia a 12 horas. Qualquer usuário autenticado pode chamar o RPC diretamente e preencher dias com 43.200 segundos, sem ter lido. Esses valores determinam posições e diamantes, inclusive a recompensa diária. RLS identifica quem reporta, mas não comprova tempo efetivamente transcorrido.

Verificado nos scripts; não foi manipulado ranking real. Aplica-se ao caminho Supabase quando esses scripts estão instalados; as regras correspondentes da API própria não foram auditadas.

Correção: contabilizar sessões no servidor, com duração limitada pelo tempo transcorrido e controles de repetição/concorrência. Se o recurso for deliberadamente baseado em confiança, documentar isso e evitar dar valor econômico aos minutos autodeclarados.

## 10. P2 — Envio da comunidade pode referenciar arquivo de outro usuário

Referências: `supabase/community-books.sql:52`, `supabase/community-books.sql:82`, `supabase/community-books.sql:143`.

A policy de INSERT valida autor do envio e estado de moderação, mas não liga `text_path` à pasta desse autor nem exige que o objeto pertença a ele. Um usuário pode criar um envio apontando para um caminho conhecido de outro usuário no bucket community-books. Se o administrador aprovar esse envio, a policy de leitura libera o objeto apontado para qualquer pessoa. A exploração depende de conhecer o caminho e de aprovação; o bucket user-books não é abrangido por essa policy.

Verificado nos scripts SQL, sem execução no banco de produção.

Correção: exigir caminho na pasta de `auth.uid()`, confirmar existência e propriedade do objeto e impedir a referência cruzada também na aprovação. Aplicar a validação no servidor/banco, pois o caminho gerado pelo frontend pode ser substituído numa chamada direta.

## Outros riscos que dependem de configuração

- `src/lib/ai.ts:166`: o caminho sem API própria aceita chaves privadas `VITE_*`, incluídas no bundle público; o limite local de mensagens não protege essas chaves. O risco já é documentado no README. Não havia chave de IA definida no `.env.local` inspecionado. Usar a API própria e não fornecer chaves privadas ao build do frontend.
- `supabase/community-books.sql:22`: bootstrap de admin seleciona contas por grafia normalizada de e-mail, sem verificar confirmação. Se cadastro sem confirmação estiver habilitado e alguém registrar uma variante pontuada do Gmail antes de executar/reexecutar o script, essa conta pode receber admin. Preferir um UUID explicitamente validado e não conceder privilégio com base somente em e-mail declarado. O estado real da configuração Auth não foi consultado.

## Verificação realizada

- `npm test`: 6 arquivos e 25 testes passaram.
- `npm run build`: passou; aviso de chunk maior que 500 kB.
- `npm run lint`: 0 erros e 9 avisos.
- `npm audit --json`: concluído; 13 pacotes sinalizados.
- Reproduções locais isoladas: tokens em telemetria, troca de dono com erro de quota e troca de conta durante upload. Executaram módulos TypeScript transpilados com armazenamento/rede controlados e tokens fictícios.
- Nenhum teste de exploração contra produção, auditoria da API Java ou verificação das policies efetivamente aplicadas ao Supabase. Os testes existentes não cobrem os cenários novos acima.

Prioridade sugerida: corrigir exposição de tokens e ativação de conta; em seguida, isolamento das operações assíncronas, importação comprimida e atualizações de dependências. Revisar as regras SQL antes de atribuir valor às recompensas ou ampliar o acervo da comunidade.
