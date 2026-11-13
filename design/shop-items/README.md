# Loja de itens de perfil — primeiro lote

Fontes editáveis (`*.svg`) dos itens do primeiro lote. Os arquivos publicados ficam em `public/shop/` e são
gerados por:

```sh
node scripts/export-shop-items.mjs
```

O script renderiza cada SVG com `@resvg/resvg-js` (devDependency) e codifica em WebP com o `ffmpeg`
(precisa de `libwebp` e `libwebp_anim`). A moldura épica tem um grupo `<g id="giro" data-giro-graus="120">`:
o script gera também `<slug>-animada.webp` girando esse grupo 2,5° por quadro, a 12 quadros por segundo
(48 quadros, laço de 4 s). O desenho da aurora se repete a cada terço de volta, por isso o laço fecha liso.

Regras de desenho:

- **Molduras** 512×512: furo transparente de raio 37% do lado (189,44 px), onde fica a foto; a arte fica entre
  os raios 190 e 256. O script recusa a exportação se algum pixel visível cair dentro do furo.
- **Insígnias** 256×256 com fundo transparente: formas cheias e grossas, douradas e com contorno escuro, para
  ler a 16 px ao lado do nome.
- **Capas** 1500×500 (3:1).
- **Cores de nome**: cada cor `#rrggbb` com contraste ≥ 4,5:1 contra `#14110e` e `#0e1612`.

## Itens

A tabela abaixo é a fonte da migração `V57__shop_first_batch.sql` da API (Task 4). `image_url`/`animated_url` usam `-` quando vazios;
`colors` é a lista de cores separadas por vírgula (só para `name_color`). O teste
`src/features/shop/firstBatch.test.ts` confere esta tabela e os arquivos.

| id | slug | category | tier | name | description | price | image_url | animated_url | colors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80380854-c5f9-4632-a343-31599b76e5af | moldura-anel-dourado | frame | common | Anel dourado | Um anel liso cor de ouro em volta da sua foto. | 80 | /shop/moldura-anel-dourado.webp | - | - |
| a3e84547-7422-4925-858a-11f46fccde72 | moldura-anel-azul | frame | common | Anel azul-noite | Um anel liso azul-claro, calmo como uma noite de leitura. | 80 | /shop/moldura-anel-azul.webp | - | - |
| cd3d40c3-b85e-40e1-b890-abe1cf13f2e6 | moldura-anel-esmeralda | frame | common | Anel esmeralda | Um anel liso verde-esmeralda em volta da sua foto. | 100 | /shop/moldura-anel-esmeralda.webp | - | - |
| ed44a84c-f6e1-457f-8209-e234910f6fa0 | moldura-coroa-de-folhas | frame | rare | Coroa de folhas | Ramos de folhas sobem dos dois lados até uma pequena coroa dourada. | 400 | /shop/moldura-coroa-de-folhas.webp | - | - |
| 94bae956-0baa-4ce8-869f-d32adb66f4ab | moldura-noite-de-estrelas | frame | rare | Noite de estrelas | Uma faixa de céu noturno com estrelas douradas e a lua crescente no alto. | 450 | /shop/moldura-noite-de-estrelas.webp | - | - |
| 578bbbcd-ff6c-4f3d-85ef-0f832bd4f026 | moldura-aurora | frame | epic | Aurora encantada | Um anel brilhante com as cores da aurora que gira devagar no seu perfil. | 900 | /shop/moldura-aurora.webp | /shop/moldura-aurora-animada.webp | - |
| 65df34fb-9adf-422a-98d1-a7cec2b1e262 | insignia-estrela | badge | common | Estrela | Uma estrela dourada ao lado do seu nome. | 50 | /shop/insignia-estrela.webp | - | - |
| 8fb84dff-d473-48d4-8dc2-467c4f5d66da | insignia-lua | badge | common | Lua crescente | A lua crescente e duas estrelas, para quem lê até tarde. | 60 | /shop/insignia-lua.webp | - | - |
| 0d0eb37f-bde2-4a02-8b23-3299552d5312 | insignia-livro | badge | common | Livro aberto | Um livro aberto, o símbolo de quem nunca larga uma história. | 60 | /shop/insignia-livro.webp | - | - |
| 8d56b735-800a-4f4a-a1d2-535a7394c781 | insignia-chave | badge | common | Chave antiga | Uma chave antiga que abre portas para outros mundos. | 80 | /shop/insignia-chave.webp | - | - |
| 2ba24177-6b08-4bcf-b325-3d615e02828a | insignia-pena | badge | common | Pena de escrever | A pena de quem também escreve as próprias histórias. | 100 | /shop/insignia-pena.webp | - | - |
| 0b9bbcf4-d431-44c3-893b-37520e99a99a | insignia-coruja | badge | rare | Coruja sábia | Uma coruja de olhos atentos, guardiã das bibliotecas. | 300 | /shop/insignia-coruja.webp | - | - |
| 2e6653dd-58d8-45b4-9556-a06dc60eeb71 | insignia-rosa | badge | rare | Rosa encantada | Uma rosa saída de um conto de fadas, ao lado do seu nome. | 350 | /shop/insignia-rosa.webp | - | - |
| 67bf68e9-5406-427a-a293-1731b7cea013 | insignia-dragao | badge | rare | Dragão | Um dragão dourado para quem vive grandes aventuras de fantasia. | 450 | /shop/insignia-dragao.webp | - | - |
| 76c6d89e-4ee2-49a7-9c9f-5c45eaacd1aa | capa-noite-estrelada | cover | rare | Noite estrelada | Um céu cheio de estrelas, a lua crescente e uma torre de biblioteca ao longe. | 400 | /shop/capa-noite-estrelada.webp | - | - |
| 78ff14b4-6384-465c-bbfe-8237d05bd006 | capa-folhas-de-outono | cover | rare | Folhas de outono | Folhas douradas e vermelhas caindo num fim de tarde de outono. | 400 | /shop/capa-folhas-de-outono.webp | - | - |
| a2cab125-f8ae-4891-a837-8d6d522dd84f | capa-biblioteca-antiga | cover | rare | Biblioteca antiga | Estantes cheias de livros antigos sob a luz quente de um lampião. | 500 | /shop/capa-biblioteca-antiga.webp | - | - |
| 9560f7bb-ad32-4614-9cc0-5fe67cb74d88 | nome-dourado | name_color | common | Nome dourado | Seu nome em dourado no chat, no ranking e nas listas. | 120 | - | - | #e4b86a |
| 8930fe69-2156-44fb-b451-ec187326c052 | nome-aurora | name_color | rare | Nome aurora | Seu nome num degradê de dourado, rosa e azul. | 450 | - | - | #f1cf88,#e88ab4,#8fb8e8 |
| 01179c8a-79bf-4f6b-9eda-959db5a0fc7c | nome-brasa | name_color | rare | Nome brasa | Seu nome num degradê quente, da cor da brasa de uma lareira. | 350 | - | - | #f7c873,#f08a5d |
