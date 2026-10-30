/**
 * Falas prontas dos personagens escritos à mão (não gastam IA), por `<livro>:<personagem>`:
 * - `nudge`: recado de saudade quando o leitor some do livro (tela inicial e notificação);
 * - `farewell`: despedida quando o leitor termina o livro.
 * Sem spoiler: o recado aparece para quem ainda está no meio da história.
 */
export type CharacterLines = { nudge: string; farewell: string };

export const CHARACTER_LINES: Record<string, CharacterLines> = {
  // A Escrava Isaura
  "gb-74475:isaura": {
    nudge: "Os dias aqui são longos sem você. Ainda sonho com a liberdade… volta para ler comigo?",
    farewell: "Obrigada por ter caminhado comigo até o fim. Nenhuma corrente prende uma história bem lembrada.",
  },
  "gb-74475:leoncio": {
    nudge: "Ninguém sai da minha fazenda sem permissão. Nem você. Volte já para a leitura.",
    farewell: "Terminou, então. Lembre-se de que nesta casa quem dava as ordens era eu.",
  },
  "gb-74475:alvaro": {
    nudge: "Uma causa justa não espera, e esta história também não. Vamos seguir em frente?",
    farewell: "Chegamos ao fim juntos. Que a coragem destas páginas fique com você.",
  },
  // Amor de Perdição
  "gb-16425:simao": {
    nudge: "Você me deixou no meio da tormenta! Não suporto esperar. Volte, por Teresa e por mim.",
    farewell: "Você foi até o fim desta paixão. Poucos têm coragem para tanto.",
  },
  "gb-16425:teresa": {
    nudge: "Escrevi outra carta e não tive a quem entregar. Você volta para ler?",
    farewell: "Obrigada por ter ficado até a última página. Guarde este amor com carinho.",
  },
  "gb-16425:mariana": {
    nudge: "Deixei a sopa no fogo e a história parada. Quando quiser, estou aqui.",
    farewell: "Foi bom ter você por perto. Nem todo bem-querer precisa ser dito em voz alta.",
  },
  // O Primo Basílio
  "gb-42942:luisa": {
    nudge: "Larguei o romance que estava lendo para esperar você… volta logo?",
    farewell: "Você chegou ao fim da minha história. Espero que tenha me julgado com carinho.",
  },
  "gb-42942:basilio": {
    nudge: "Que desfeita, sumir assim! Pensei que gostasse de uma boa intriga.",
    farewell: "Acabou? Pois bem. Tudo na vida é passageiro, minha cara, inclusive os livros.",
  },
  "gb-42942:juliana": {
    nudge: "Ninguém nesta casa repara em nada, mas eu reparei que você sumiu.",
    farewell: "Terminou, hein? Agora você sabe tanto quanto eu. Ou quase.",
  },
  // Iracema
  "gb-67740:iracema": {
    nudge: "A jandaia cantou seu nome na mata. A história espera por você como o rio espera a chuva.",
    farewell: "Você atravessou a mata inteira comigo. Leve no peito o perfume da baunilha.",
  },
  "gb-67740:martim": {
    nudge: "Guerreiro não abandona a jornada no meio. Vamos continuar?",
    farewell: "Chegamos ao fim da viagem. Obrigado por ter vindo comigo.",
  },
  "gb-67740:poti": {
    nudge: "Poti espera o amigo na beira da trilha. Quando você vem?",
    farewell: "Amigo que vai até o fim é irmão. Poti não esquece.",
  },
  // O Guarani
  "gb-67724:peri": {
    nudge: "Peri vigia a casa de dia e de noite. Falta só você voltar.",
    farewell: "Você foi até o fim com Peri. Peri é grato.",
  },
  "gb-67724:ceci": {
    nudge: "Fiquei esperando você no jardim! A história fica sem graça sem alguém para ler.",
    farewell: "Que bom que você leu até o fim! Já estou com saudade.",
  },
  "gb-67724:loredano": {
    nudge: "Que estranho você sumir… Eu, por outro lado, continuo aqui, com os meus planos.",
    farewell: "Terminou o volume. Saiba que um homem paciente sempre encontra outra oportunidade.",
  },
  // Cinco Minutos
  "gb-44540:narrador": {
    nudge: "Cinco minutos, só cinco! Foi o que bastou para mudar minha vida. Me dá cinco minutos seus?",
    farewell: "Obrigado por ouvir minha história até o fim. Valeu cada minuto, não valeu?",
  },
  "gb-44540:carlota": {
    nudge: "Ainda tenho coisas para contar, mas só se você voltar.",
    farewell: "Agora você conhece meu segredo. Obrigada por ter lido com tanta delicadeza.",
  },
  // As Aventuras de Sherlock Holmes
  "gb-1661:holmes": {
    nudge: "O caso não se resolve sozinho, e o tédio me consome. Pela poeira no livro, você sumiu há dias.",
    farewell: "Caso encerrado. Você tem talento para observar. Elementar, não acha?",
  },
  "gb-1661:watson": {
    nudge: "Holmes não para de andar de um lado para o outro desde que você sumiu. Voltamos ao caso?",
    farewell: "Foi um prazer contar essas histórias a você. Holmes nunca admitiria, mas ele também gostou.",
  },
  "gb-1661:adler": {
    nudge: "Sumir sem deixar pistas? Achei que esse truque fosse meu.",
    farewell: "Você chegou ao fim. Para mim, sempre vai ser quem leu tudo.",
  },
  // Drácula
  "gb-345:dracula": {
    nudge: "A noite está longa e o castelo, vazio. Volte, meu caro hóspede. Eu insisto.",
    farewell: "A história acabou… por enquanto. Eu tenho todo o tempo do mundo.",
  },
  "gb-345:mina": {
    nudge: "Anotei no diário que você não aparece há dias. Está tudo bem? A história precisa de nós.",
    farewell: "Fechei o diário. Obrigada por ter atravessado essa escuridão comigo.",
  },
  "gb-345:vanhelsing": {
    nudge: "Meu amigo, não se pode deixar o mal sem vigilância! Volte, temos trabalho a fazer.",
    farewell: "Você foi corajoso até a última página. Guarde o alho, por via das dúvidas.",
  },
  // Orgulho e Preconceito
  "gb-1342:elizabeth": {
    nudge: "Sumiu sem dizer uma palavra? Que descortês… e eu que já estava gostando de você.",
    farewell: "Chegamos ao fim. Espero que tenha rido das tolices de todos, inclusive das minhas.",
  },
  "gb-1342:darcy": {
    nudge: "Notei sua ausência. Não costumo dizer essas coisas, mas a leitura ficou incompleta sem você.",
    farewell: "Foi uma honra. Confesso que minha primeira impressão sobre você estava errada.",
  },
  "gb-1342:mrsbennet": {
    nudge: "Meus pobres nervos! Você some e me deixa sem saber o que acontece. Volte agora mesmo!",
    farewell: "Terminou! Ah, que alívio para os meus nervos. Agora conte tudo para as vizinhas.",
  },
  // As Aventuras de Arsène Lupin
  "gb-6133:lupin": {
    nudge: "Roubei sua atenção uma vez, posso roubar de novo. A próxima página está esperando.",
    farewell: "Você chegou ao fim, mas comigo nada termina de verdade. Até a próxima aventura.",
  },
  "gb-6133:ganimard": {
    nudge: "Lupin está à solta e você, sumido! Preciso de ajuda nesta investigação.",
    farewell: "Terminou o livro. Eu ainda não terminei com aquele ladrão.",
  },
  // O Fantasma da Ópera
  "gb-175:erik": {
    nudge: "A ópera ficou em silêncio desde que você partiu. Volte. A música não pode esperar.",
    farewell: "A cortina desceu. Lembre-se de mim quando ouvir uma melodia na escuridão.",
  },
  "gb-175:christine": {
    nudge: "Ouvi uma voz no camarim e pensei que fosse você voltando. Vamos continuar?",
    farewell: "Obrigada por ficar até o último ato. Foi a mais bela plateia.",
  },
  "gb-175:raoul": {
    nudge: "Não posso enfrentar esse mistério sozinho! Volte, preciso de você.",
    farewell: "Chegamos ao fim. Você foi tão corajoso quanto qualquer visconde.",
  },
  // O Retrato de Dorian Gray
  "gb-174:dorian": {
    nudge: "Você sumiu e eu continuo o mesmo, como sempre. Volte para ver.",
    farewell: "Você terminou minha história. Não conte a ninguém o que viu.",
  },
  "gb-174:henry": {
    nudge: "A única forma de se livrar de uma tentação é ceder a ela. Ceda à próxima página.",
    farewell: "Acabou. Os livros nunca são morais ou imorais, só bem ou mal escritos. Este foi bem lido.",
  },
  "gb-174:basil": {
    nudge: "Deixei o pincel de lado esperando você. A história ficou pela metade, como um quadro inacabado.",
    farewell: "Obrigado por ter olhado com atenção até o fim. É tudo o que um artista deseja.",
  },
  // Frankenstein
  "gb-84:victor": {
    nudge: "Não consigo dormir. Preciso terminar de contar tudo, e você precisa ouvir.",
    farewell: "Você ouviu tudo. Que o meu erro sirva de aviso.",
  },
  "gb-84:criatura": {
    nudge: "Até você me abandonou? Volte. Eu só queria alguém para me ouvir.",
    farewell: "Você ficou até o fim. Foi a primeira pessoa que não fugiu de mim.",
  },
  // Alice no País das Maravilhas
  "gb-11:alice": {
    nudge: "Cada vez mais curioso! Você sumiu bem quando as coisas ficaram estranhas.",
    farewell: "Que sonho curioso! Obrigada por ter caído na toca do coelho comigo.",
  },
  "gb-11:chapeleiro": {
    nudge: "Está atrasado! Muito atrasado! O chá esfriou três vezes esperando você.",
    farewell: "Fim? Que palavra mais sem sentido. Volte para o chá quando quiser, é sempre seis horas.",
  },
  "gb-11:cheshire": {
    nudge: "Se você não sabe para onde vai, qualquer caminho serve. Que tal o caminho de volta ao livro?",
    farewell: "Todos aqui são loucos, e você leu até o fim. Tire suas conclusões.",
  },
  // As Minas de Salomão
  "gb-22015:quatermain": {
    nudge: "O acampamento está montado e a trilha espera. Um bom caçador sabe a hora de voltar.",
    farewell: "Fim da expedição. Não sou de muitas palavras, mas foi uma honra ter você na caravana.",
  },
  "gb-22015:henry": {
    nudge: "Não vou desistir da busca, e espero que você também não. Seguimos?",
    farewell: "Chegamos ao fim da jornada. Obrigado pela companhia.",
  },
  "gb-22015:umbopa": {
    nudge: "O caminho é longo e as estrelas perguntam por você. Volte à jornada.",
    farewell: "Quem caminha até o fim conhece o próprio coração. Siga em paz.",
  },
  // Da Terra à Lua
  "gb-28341:barbicane": {
    nudge: "Os cálculos estão prontos e o canhão, à espera. Falta só você. Retomamos?",
    farewell: "Missão cumprida. A precisão e a ousadia levaram você até a última página.",
  },
  "gb-28341:ardan": {
    nudge: "Sem você a Lua fica longe demais! Vamos, a aventura não pode esperar!",
    farewell: "Que viagem! Se um dia formos à Lua de verdade, guardo um lugar para você.",
  },
  "gb-28341:nicholl": {
    nudge: "Aposto que você não volta para terminar. Quer me provar o contrário?",
    farewell: "Está bem, você chegou ao fim. Perdi essa aposta.",
  },
};
