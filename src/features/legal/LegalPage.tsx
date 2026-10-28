import { Link } from "react-router-dom";
import "./legal.css";
import { LEGAL_HOLDER } from "./holder";

export type LegalDoc = "termos" | "privacidade" | "cancelamento";

export const LEGAL_CONTACT = "axyonsoftwarehouse@gmail.com";
const UPDATED_AT = "28 de outubro de 2026";

const TITLES: Record<LegalDoc, string> = {
  termos: "Termos de uso",
  privacidade: "Política de privacidade",
  cancelamento: "Cancelamento e reembolso",
};

function Contact() {
  return <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>;
}

function Terms() {
  return (
    <>
      <h2>1. Quem somos</h2>
      <p>
        O Storyverse é um serviço de leitura com conversa com os personagens dos livros, oferecido pela{" "}
        <strong>Axyon Software House</strong> ("nós"), nome comercial de {LEGAL_HOLDER}. Contato: <Contact />.
      </p>

      <h2>2. Conta</h2>
      <p>
        Para ler e conversar é preciso criar uma conta com nome, e-mail e senha. Você responde pelo que é
        feito na sua conta e deve manter a senha em segredo. Menores de 18 anos só podem usar o
        Storyverse com a autorização de quem é responsável por eles.
      </p>

      <h2>3. Assinatura</h2>
      <ul>
        <li>
          O acesso ao app depois do login exige uma assinatura mensal. O preço vigente aparece em{" "}
          <Link to="/assinar">/assinar</Link> e no checkout antes de qualquer cobrança.
        </li>
        <li>
          Os primeiros 7 dias são grátis e não pedem cartão. Se você não cadastrar um cartão até o fim do
          teste, o acesso termina e nada é cobrado.
        </li>
        <li>
          Com cartão cadastrado, a cobrança é mensal e automática, no mesmo dia de cada mês, até você
          cancelar.
        </li>
        <li>
          O pagamento é processado pelo Stripe. Nenhum dado de cartão passa pelos nossos servidores.
        </li>
        <li>
          Se uma cobrança falhar, o Stripe tenta de novo e o acesso continua por até 3 dias depois do fim do
          período. Se o pagamento não entrar, o acesso é suspenso até a regularização.
        </li>
        <li>
          Podemos mudar o preço. Avisamos por e-mail com pelo menos 30 dias de antecedência, e o novo
          valor só vale a partir da renovação seguinte; você pode cancelar antes.
        </li>
      </ul>
      <p>
        Cancelamento e reembolso estão em <Link to="/cancelamento">Cancelamento e reembolso</Link>.
      </p>

      <h2>4. Conteúdo dos livros e conversas com a IA</h2>
      <ul>
        <li>
          Os livros do acervo vêm de obras em domínio público ou com licença de uso. Os arquivos que você
          importa precisam ser seus ou de uso permitido, e ficam só na sua estante.
        </li>
        <li>
          As respostas dos personagens são geradas por inteligência artificial. Elas podem conter erros ou
          inventar detalhes e não representam a opinião da Axyon nem dos autores.
        </li>
        <li>O uso da IA tem limites diários para manter o serviço estável.</li>
      </ul>

      <h2>5. Comunidade</h2>
      <p>
        No fórum, não é permitido publicar conteúdo ilegal, ofensivo, discriminatório, spam ou spoiler sem
        aviso, nem se passar por outra pessoa. A moderação pode remover publicações e advertir, suspender ou
        encerrar contas que descumpram estas regras. Contas suspensas por violação não têm reembolso do
        período em curso.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o Storyverse no ar, mas o serviço pode ter pausas para manutenção ou
        falhas. Recursos podem mudar ou sair; se uma mudança tirar algo essencial do plano, você pode
        cancelar e pedir o reembolso proporcional ao período não usado.
      </p>

      <h2>7. Encerramento da conta</h2>
      <p>
        Você pode excluir sua conta em Perfil › Ajustes › Conta. A exclusão apaga seus dados como descrito
        na <Link to="/privacidade">Política de privacidade</Link>. Excluir a conta não cancela sozinho uma
        assinatura no cartão: cancele antes pelo portal do Stripe.
      </p>

      <h2>8. Mudanças nestes termos</h2>
      <p>
        Se mudarmos estes termos de forma relevante, avisamos por e-mail ou no app antes de a mudança valer.
        Continuar usando o Storyverse depois disso significa aceitar a nova versão.
      </p>

      <h2>9. Lei e foro</h2>
      <p>
        Estes termos seguem a lei brasileira, incluindo o Código de Defesa do Consumidor. Fica eleito o foro
        do seu domicílio.
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p>
        Esta política explica quais dados o Storyverse trata, para quê e quais são os seus direitos pela Lei
        Geral de Proteção de Dados (LGPD). A responsável pelos dados é a <strong>Axyon Software House</strong>
        , nome comercial de {LEGAL_HOLDER}. Pedidos sobre os seus dados: <Contact />.
      </p>

      <h2>1. O que guardamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> nome, e-mail, senha (guardada só como hash) e data de criação.
        </li>
        <li>
          <strong>Leitura:</strong> estante, progresso, livros terminados, marcações, metas e minutos lidos.
        </li>
        <li>
          <strong>Conversas com os personagens:</strong> as mensagens, para você continuar de onde parou.
        </li>
        <li>
          <strong>Comunidade:</strong> tópicos, respostas, denúncias e o histórico de moderação.
        </li>
        <li>
          <strong>Assinatura:</strong> identificadores do cliente e da assinatura no Stripe, situação, datas
          e status das faturas. Não guardamos número de cartão.
        </li>
        <li>
          <strong>Técnicos:</strong> registros de erro e de segurança (como endereço IP e horário de login),
          usados para proteger a conta e corrigir falhas.
        </li>
      </ul>
      <p>As buscas não ficam salvas.</p>

      <h2>2. Para quê e com qual base legal</h2>
      <ul>
        <li>Prestar o serviço e cobrar a assinatura: execução do contrato.</li>
        <li>Segurança, prevenção de fraude e moderação: legítimo interesse.</li>
        <li>Guardar registros de acesso e dados de cobrança pelo prazo da lei: obrigação legal.</li>
        <li>Medir o uso do site de forma agregada, sem identificar você: legítimo interesse.</li>
      </ul>
      <p>Não vendemos seus dados e não usamos seus dados para publicidade.</p>

      <h2>3. Com quem compartilhamos</h2>
      <p>Só com os fornecedores necessários para o serviço funcionar:</p>
      <ul>
        <li>
          <strong>Stripe:</strong> pagamentos e portal da assinatura.
        </li>
        <li>
          <strong>Google (Gemini) e Groq:</strong> geram as respostas dos personagens. Recebem o trecho da
          conversa e do livro necessário para responder, sem seu nome ou e-mail.
        </li>
        <li>
          <strong>Brevo:</strong> envio de e-mails da conta, como confirmação e troca de senha.
        </li>
        <li>
          <strong>Sentry:</strong> registro de erros do site e da API.
        </li>
        <li>
          <strong>Open Library e Project Gutenberg:</strong> recebem os termos das buscas no acervo, sem
          identificar você.
        </li>
      </ul>
      <p>
        Alguns desses fornecedores processam dados fora do Brasil, com as garantias previstas na LGPD. As
        métricas de visita usam o Umami, instalado no nosso próprio servidor e sem cookies de rastreamento.
      </p>

      <h2>4. Por quanto tempo</h2>
      <ul>
        <li>Os dados da conta, da leitura e das conversas ficam enquanto a conta existir.</li>
        <li>Você pode apagar o histórico de conversas quando quiser, em Perfil › Ajustes › Privacidade.</li>
        <li>
          Ao excluir a conta, apagamos seus dados. Ficam só os que a lei manda guardar: registros de acesso
          por 6 meses (Marco Civil da Internet) e dados de cobrança pelo prazo fiscal.
        </li>
      </ul>

      <h2>5. Seus direitos</h2>
      <p>
        Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, levá-los para outro serviço,
        pedir a exclusão e revogar consentimentos. Pelo app, você exporta seus dados e exclui a conta em
        Perfil › Ajustes › Conta. Para o resto, escreva para <Contact />; respondemos em até 15 dias. Você
        também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>6. Segurança</h2>
      <p>
        Usamos conexão criptografada, senhas com hash, controle de acesso por conta e registros de auditoria
        nas ações da equipe. Se acontecer um incidente que traga risco a você, avisamos você e a ANPD.
      </p>

      <h2>7. Cookies e armazenamento no aparelho</h2>
      <p>
        Usamos um cookie essencial para manter você conectado e o armazenamento do navegador para guardar
        preferências, progresso e conversas no seu aparelho. Não usamos cookies de publicidade.
      </p>

      <h2>8. Mudanças</h2>
      <p>Se esta política mudar de forma relevante, avisamos por e-mail ou no app.</p>
    </>
  );
}

function Cancellation() {
  return (
    <>
      <h2>Como cancelar</h2>
      <p>
        Em <Link to="/conta/assinatura">Minha assinatura</Link>, abra o portal do Stripe e cancele. Não há
        multa nem fidelidade. Se preferir, peça o cancelamento por e-mail em <Contact />.
      </p>

      <h2>O que acontece depois</h2>
      <ul>
        <li>No período de teste grátis: o acesso termina no fim do teste e nada é cobrado.</li>
        <li>Com a assinatura paga: o acesso continua até o fim do mês já pago, e não há novas cobranças.</li>
        <li>Seus dados de leitura continuam na conta, caso você volte a assinar.</li>
      </ul>

      <h2>Reembolso</h2>
      <ul>
        <li>
          <strong>Até 7 dias depois da primeira cobrança:</strong> devolvemos o valor integral, pelo direito
          de arrependimento do Código de Defesa do Consumidor (art. 49). Peça por <Contact /> com o e-mail da
          conta.
        </li>
        <li>
          <strong>Depois disso:</strong> não há reembolso proporcional do mês em curso; o acesso segue até o
          fim do período pago.
        </li>
        <li>
          <strong>Cobrança indevida ou em duplicidade:</strong> devolvemos o valor integral, a qualquer
          tempo.
        </li>
      </ul>
      <p>
        O reembolso volta para o mesmo cartão da compra. O prazo para aparecer na fatura depende do banco
        emissor, normalmente de 5 a 10 dias úteis.
      </p>
    </>
  );
}

const BODIES: Record<LegalDoc, () => React.JSX.Element> = {
  termos: Terms,
  privacidade: Privacy,
  cancelamento: Cancellation,
};

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const Body = BODIES[doc];
  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
      </nav>
      <article className="shelf legal-page">
        <div className="shelf-head">
          <span className="eyebrow">Storyverse</span>
          <h1>{TITLES[doc]}</h1>
          <p className="muted">Atualizado em {UPDATED_AT}.</p>
        </div>
        <div className="legal-body">
          <Body />
        </div>
        <nav className="legal-links" aria-label="Documentos">
          {(Object.keys(TITLES) as LegalDoc[])
            .filter((other) => other !== doc)
            .map((other) => (
              <Link key={other} className="foot-link" to={`/${other}`}>
                {TITLES[other]}
              </Link>
            ))}
        </nav>
      </article>
    </div>
  );
}
