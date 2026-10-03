# Arquitetura do Storyverse

## Módulos independentes

O repositório é um monorepo para facilitar o desenvolvimento conjunto, não um aplicativo único compilado ou executado como monólito.

| Módulo | Local | Tecnologia | Build e execução |
|---|---|---|---|
| Frontend | raiz (`src/`, `package.json`) | React, TypeScript e Vite | `npm run dev` / `npm run build` |
| API | `story-magic-api/` | Java e Spring Boot | Maven, usando `story-magic-api/pom.xml` |

Cada módulo tem fontes, dependências, configuração, testes e ciclo de execução próprios. O frontend não inclui fontes Java no build; o Maven da API não compila nem empacota arquivos React. Não mova as fontes de um módulo para dentro do outro nem compartilhe classes compiladas ou dependências.

## Limite entre módulos

- Quando integrado, o frontend deve acessar o backend exclusivamente pela API HTTP versionada em `/api/v1/**`.
- O backend não importa, lê ou executa arquivos do frontend; o único contrato compartilhado é JSON/HTTP, documentado junto à API.
- O backend é dono das regras de negócio do servidor e dos adaptadores de provedores que forem migrados para ele.
- O frontend continua dono da apresentação e das capacidades locais do navegador, como leitura de arquivos importados, IndexedDB, progresso local, voz e instalação PWA.
- Autenticação e identidade permanecem no Supabase até existir uma migração planejada. Não duplique usuários ou sessões no catálogo em memória da API.
- Dados locais do leitor não devem ser enviados ao backend sem uma funcionalidade que exija isso e uma decisão explícita de persistência e privacidade.
- Credenciais privadas de provedores só podem existir no ambiente do servidor; nunca devem usar variáveis `VITE_*`, ser incluídas no bundle ou enviadas ao navegador. Qualquer valor `VITE_*` é entregue ao navegador e não é segredo.

## Estado da integração

A API Java e os endpoints estão isolados e podem ser iniciados e testados independentemente. A integração do frontend com essa API ainda não foi ativada: partes existentes do frontend continuam chamando diretamente Supabase, Project Gutenberg, Open Library e provedores de IA. As chaves `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` e `VITE_OPENROUTER_API_KEY`, quando usadas, ficam acessíveis no bundle do navegador e devem ser tratadas como públicas; a separação estrutural atual ainda não moveu chamadas de IA nem essas configurações para o servidor. Não remova essas integrações do frontend antes de migrar cada fluxo de forma completa, com configuração no servidor, tratamento de falhas e testes de ponta a ponta.

Migrações devem ser feitas por fluxo, mantendo a interface HTTP como limite. Não adicione código React ao Maven, não exponha segredos no Vite e não transforme a API em dependência de runtime do build do frontend.

## Desenvolvimento e validação

Execute os módulos separadamente:

1. Frontend: na raiz, `npm run dev` ou `npm run build`.
2. API: importe `story-magic-api/pom.xml` no IntelliJ IDEA e execute `ApiApplication.main()`. Os testes ficam em `story-magic-api/src/test`.
3. Integração local: quando o frontend passar a consumir a API, configure `CORS_ALLOWED_ORIGINS` no backend para a origem exata do frontend; não use curingas com credenciais.

Consulte `story-magic-api/README.md` para os endpoints, ambientes e instruções de execução e deploy.
