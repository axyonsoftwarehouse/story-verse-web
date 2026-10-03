# Story Magic API

Backend REST Spring Boot do Story Magic. Este módulo tem ciclo de build e execução próprios; permanece isolado do frontend até a integração HTTP ser ativada deliberadamente.

## Organização

- `catalog/api`: endpoints REST e formato de resposta do catálogo.
- `catalog/application`: regras de busca do catálogo.
- `catalog/application/BookCatalogRepository`: porta de persistência do catálogo.
- `catalog/domain`: modelo de livro independente do formato HTTP.
- `catalog/infrastructure`: adaptador de catálogo em memória, substituível por um adaptador de banco sem alterar controladores ou regras de negócio.
- `integrations/gutenberg`: adaptador HTTP para obter textos públicos do Project Gutenberg, com timeout e espelho de contingência.
- `integrations/openlibrary`: cliente HTTP para busca de metadados públicos e capas da Open Library.
- `common/api`: conversão de erros de negócio e de integração para respostas HTTP padronizadas.
- `system/api`: endpoints operacionais, como verificação de saúde.
- `config`: configuração HTTP, incluindo CORS para o frontend local.
- `src/main/resources/application-{dev,prod}.yaml`: configurações separadas por ambiente; segredos são injetados por variáveis do ambiente de execução.
- `ApiApplication.java`: inicialização do Spring Boot.

## Executar localmente

Requisitos: JDK 25 ou superior. No IntelliJ IDEA, abra `story-magic-api/pom.xml` como projeto Maven e aguarde o carregamento das dependências. A classe principal é:

```text
com.story_magic.api.ApiApplication
```

Abra `src/main/java/com/story_magic/api/ApiApplication.java` e clique no triângulo verde ao lado de `main` → **Run 'ApiApplication.main()'**. O perfil `dev` é ativado por padrão e aceita CORS apenas das origens locais do Vite. O diretório compilado fica em `%USERPROFILE%\.story-magic-build\api`, para permitir executar mesmo se o caminho do repositório contiver caracteres especiais.

Para executar testes no IntelliJ, clique com o botão direito em `src/test/java` ou em uma classe de teste → **Run**. No Git Bash ou Linux/macOS, os mesmos testes podem ser executados com:

```bash
cd story-magic-api
./mvnw --batch-mode verify
```

As variáveis podem ser definidas na seção **Environment variables** da Run Configuration. `.env.example` é apenas uma referência; Spring Boot não carrega esse arquivo automaticamente. Nunca grave credenciais reais nesse arquivo ou no Git.

## Ambientes

- `dev` é o perfil padrão para execução local. `CORS_ALLOWED_ORIGINS` pode substituir as origens locais padrão.
- `prod` requer `CORS_ALLOWED_ORIGINS` explícita, ativa logs estruturados ECS em JSON e usa o mesmo endpoint de health para as verificações do provedor de hospedagem.
- `PORT` é lida pelo servidor; localmente assume `8080`, em produção o provedor injeta a porta.
- O desligamento do servidor é gracioso. Não há segredos externos necessários para os endpoints atuais.

Ative produção com `SPRING_PROFILES_ACTIVE=prod`. Defina valores secretos diretamente nas configurações do ambiente de execução/hospedagem, nunca em `application-prod.yaml`, imagens Docker ou variáveis `VITE_*`.

## API e health check

Com o servidor iniciado, abra:

```text
http://localhost:8080/api/v1/health
```

A resposta inclui `status: "ok"` e um timestamp. A porta padrão `8080` pode ser alterada com a variável `PORT`.

## Catálogo de livros

- `GET /api/v1/books`: lista o catálogo.
- `GET /api/v1/books?q=iracema`: busca sem diferenciar maiúsculas/minúsculas por título, autor, gênero ou sinopse.
- `GET /api/v1/books/gb-67740`: consulta um livro pelo identificador; retorna `404` se não existir.
- `GET /api/v1/books/gb-67740/content`: obtém o texto público integral do livro no Project Gutenberg. Responde como `text/plain; charset=UTF-8`, remove as marcações de licença do Gutenberg e tenta o espelho oficial se o site principal falhar.
- `GET /api/v1/external-books?q=crepusculo`: pesquisa metadados/capas na Open Library para livros fora do catálogo local. Retorna até seis sugestões; prioriza edição em português e mantém as regras de ano, número de edições e relevância que antes estavam no frontend.

A resposta é uma lista JSON com `id`, `gutenbergId`, `title`, `author`, `genre`, `blurb`, `coverUrl`, `textLanguage` e `shelf`. Os identificadores e campos principais seguem o formato de `Ebook` usado pelo frontend. O adaptador atual do catálogo é em memória; os dados de demonstração voltam ao padrão quando a API reinicia. O serviço depende de `BookCatalogRepository`, permitindo adicionar uma implementação de persistência sem acoplar essa mudança à API HTTP.

O CORS permite por padrão `http://localhost:5173` e `http://127.0.0.1:5173`. Configure `CORS_ALLOWED_ORIGINS` com uma lista separada por vírgulas ao usar outros endereços.

Erros seguem o formato `application/problem+json`, com título, detalhe, status HTTP e timestamp. Falhas em provedores externos retornam `502`; timeout retorna `504`; consultas inválidas retornam `400`. O endpoint de texto aceita somente IDs presentes no catálogo da API.

Esta versão fornece uma base REST somente de leitura. Ainda não há persistência ou endpoints de conta/login. O login continua sob responsabilidade do Supabase, e o frontend permanece desacoplado. Antes de adicionar dados pessoais ou operações de escrita, implementar autorização (por exemplo, validar access tokens JWT emitidos pelo Supabase) e uma estratégia de armazenamento permanente.

As rotas atuais só expõem metadados públicos, textos em domínio público e busca de catálogo. Elas não substituem a autorização do Supabase nem devem ser usadas para dados privados. Erros conhecidos são convertidos para `application/problem+json`; erros inesperados são registrados no log do servidor e retornam uma mensagem genérica, sem stack trace ou detalhes internos ao cliente.

Para persistência futura, implemente uma segunda versão de `BookCatalogRepository` com Spring Data/JDBC e configuração de datasource via variáveis de ambiente. Não adicione banco até serem definidos os dados que precisam persistir, migrações e política de backup. A pasta `integrations/` é a fronteira para adaptadores de IA; novas chaves de provedores devem ser lidas apenas de variáveis secretas do backend.

## Docker e deploy contínuo

A imagem Docker usa um estágio Maven de build, uma imagem JRE de runtime e executa como usuário não privilegiado. O build executa os testes (`verify`) antes de gerar a imagem:

```bash
cd story-magic-api
docker build -t story-magic-api .
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e CORS_ALLOWED_ORIGINS=https://SEU-FRONTEND.example \
  story-magic-api
```

O workflow `.github/workflows/story-magic-api.yml` testa o backend e constrói a imagem em alterações sob `story-magic-api/`.

### Render (always-on)

`render.yaml` descreve um serviço Docker **Starter** pago, com região Ohio, deploy automático após mudanças no Git e health check em `/api/v1/health`. O plano Starter é escolhido para evitar o modo de suspensão dos serviços gratuitos; a cobrança é feita pela Render.

Para publicar:

1. Envie o repositório para GitHub e conecte a conta GitHub ao Render.
2. No Render, crie um **Blueprint** e selecione o arquivo `story-magic-api/render.yaml`.
3. Informe a origem pública exata do frontend para `CORS_ALLOWED_ORIGINS` quando o Render solicitar. Não use `*`.
4. Crie o serviço e aguarde o deploy terminar. O endereço HTTPS aparecerá no painel; teste `<URL-do-serviço>/api/v1/health`.
5. Confirme que o health check está verde e que o auto deploy está habilitado. O serviço passa a ser atualizado a cada push na branch conectada.

A configuração de infraestrutura está pronta no repositório, mas o serviço ainda não está publicado: concluir esses passos exige acesso à conta Render e ao repositório GitHub, que não estão disponíveis neste ambiente. Escolha consciente de custo: o plano Starter é pago e pode ser alterado no Blueprint/painel.

## CI e validação

No IntelliJ, execute `ApiApplicationTests` e `OpenLibraryClientTests`; no Maven, `./mvnw --batch-mode verify`. O workflow também constrói o Dockerfile para verificar que a imagem de produção continua reproduzível.
