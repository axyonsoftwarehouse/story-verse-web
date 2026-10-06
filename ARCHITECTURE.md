# Arquitetura do Storyverse

## Escopo deste repositório

Este repositório contém só o frontend web (React, TypeScript e Vite; `npm run dev` / `npm run build`). A API Java/Spring Boot é um projeto separado, com repositório, build e deploy próprios. Não traga fontes do backend para cá nem compartilhe classes compiladas ou dependências.

## Limite com o backend

- Quando integrado, o frontend deve acessar o backend exclusivamente pela API HTTP versionada em `/api/v1/**`.
- O backend não importa, lê ou executa arquivos do frontend; o único contrato compartilhado é JSON/HTTP, documentado junto à API.
- O backend é dono das regras de negócio do servidor e dos adaptadores de provedores que forem migrados para ele.
- O frontend continua dono da apresentação e das capacidades locais do navegador, como leitura de arquivos importados, IndexedDB, progresso local, voz e instalação PWA.
- Autenticação e identidade permanecem no Supabase até existir uma migração planejada. Não duplique usuários ou sessões no catálogo em memória da API.
- Dados locais do leitor não devem ser enviados ao backend sem uma funcionalidade que exija isso e uma decisão explícita de persistência e privacidade.
- Credenciais privadas de provedores só podem existir no ambiente do servidor; nunca devem usar variáveis `VITE_*`, ser incluídas no bundle ou enviadas ao navegador. Qualquer valor `VITE_*` é entregue ao navegador e não é segredo.

## Estado da integração

A API Java fica em outro repositório e pode ser iniciada e testada de forma independente. A integração do frontend com essa API ainda não foi ativada: partes existentes do frontend continuam chamando diretamente Supabase, Project Gutenberg, Open Library e provedores de IA. As chaves `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` e `VITE_OPENROUTER_API_KEY`, quando usadas, ficam acessíveis no bundle do navegador e devem ser tratadas como públicas; a separação estrutural atual ainda não moveu chamadas de IA nem essas configurações para o servidor. Não remova essas integrações do frontend antes de migrar cada fluxo de forma completa, com configuração no servidor, tratamento de falhas e testes de ponta a ponta.

Migrações devem ser feitas por fluxo, mantendo a interface HTTP como limite. Não adicione código React ao Maven, não exponha segredos no Vite e não transforme a API em dependência de runtime do build do frontend.

## Desenvolvimento e validação

1. Na raiz, `npm run dev`, `npm run lint`, `npm test` e `npm run build` (a CI roda os três últimos).
2. Integração local: quando o frontend passar a consumir a API, configure `CORS_ALLOWED_ORIGINS` no backend para a origem exata do frontend; não use curingas com credenciais.
