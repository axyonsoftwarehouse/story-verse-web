import { userStorage } from "./lib/dataOwner";
import { authModalFromUrl, safeLoginReturn } from "./lib/loginReturn";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BadgeIcon } from "./components/badgeIcons";
import { useConfirm } from "./components/ConfirmDialog";
import {
  AboutDialog,
  AuthModal,
  DailySpinModal,
  DiamondShopPage,
  InstallAppDialog,
  NewPasswordModal,
  ProfilePage,
  RankingPage,
  prefetchCommunityRoutes,
  RouteLoading,
} from "./lazyRoutes";
import { Icon } from "./components/Icon";
import { formatMinutes } from "./lib/formatMinutes";
import { ReaderCount } from "./components/ReaderCount";
import { disablePush } from "./lib/push";
import { warningMessage } from "./features/auth/sanctionNotice";
import { featuredBooks } from "./data/ebooks";
import type { Ebook, StoryCharacter } from "./data/types";
import { knownCast, loadCast } from "./lib/cast";
import {
  characterTalks,
} from "./lib/chatHistory";
import { achievements, takeNewAchievements, type Achievement } from "./lib/achievements";
import { quoteOfTheDay } from "./data/dailyQuotes";
import { applyAppTheme, syncAppThemeFromAccount } from "./lib/appTheme";
import { activateDataOwner, clearAccountStorage, currentDataOwner, dataOwnerReady } from "./lib/dataOwner";
import { startAutoSync, syncNow } from "./lib/cloudSync";
import { syncBooks } from "./lib/bookSync";
import {
  catalogBookToEbook,
  catalogNumericId,
  fetchCatalogBookText,
  getCatalogBook,
  searchCatalog,
} from "./lib/catalog";
import { finishedBooks, markBookFinished } from "./lib/finished";
import { useAccountFeatures } from "./features/auth/useAccountFeatures";
import { isStaff } from "./features/admin/adminSections";
import { FinishBookDialog } from "./features/library/FinishBookDialog";
import { LibraryPage } from "./features/library/LibraryPage";
import { hasFeature } from "./lib/accountFeatures";
import { GROUPS_AVAILABLE, PENDING_INVITE_KEY } from "./lib/groups";
import { GoldDust } from "./components/GoldDust";
import { publishShowcase } from "./lib/social";
import { useGroupsUnread } from "./features/groups/useGroupsUnread";
import { NavMore, type NavMoreItem } from "./features/notifications/NavMore";
import { useNavCrowded } from "./lib/useNavCrowded";
import { NotificationBell } from "./features/notifications/NotificationBell";
import { bookKeyOf } from "./lib/library";
import {
  recordFinished,
  recordOpened,
  recordProgress,
  shelfEnabled,
  type LocalShelfEntry,
} from "./lib/libraryStore";
import { useFinishPrompt } from "./features/library/useFinishPrompt";
import { connectShelf } from "./lib/libraryWiring";
import { BILLING_UI_ENABLED, billingDate, billingStatusLabel, type SubscriptionSnapshot } from "./lib/billing";
import { BillingBlocked } from "./features/billing/BillingBlocked";
import { watchPresence } from "./lib/presence";
import { holdSplash, releaseSplash } from "./lib/splash";
import {
  flyEmoji,
  haptic,
  installCoverTilt,
  openBookWithTransition,
  prefersReducedMotion,
  useReveal,
} from "./lib/motion";
import { readerUrl, rememberOpenBook, takeReaderParam } from "./lib/readerUrl";
import {
  approvedCommunityBooks,
  communityIdOf,
  fetchCommunityBookText,
  isNewCommunityBook,
  newBookLabel,
  syncSubmissionCovers,
} from "./lib/community";
import { lookupWord, normalizeWord, type WordInfo } from "./lib/dictionary";
import {
  allHighlights,
  loadHighlights,
  MAX_HIGHLIGHT_CHARS,
  saveHighlights,
  type Highlight,
} from "./lib/highlights";
import { splitIntoChapters } from "./lib/chapters";
import { fetchBookText } from "./lib/gutenberg";
import {
  deleteAllLocalRecords,
  isLocalBook,
  listLocalBooks,
  loadLocalBookImages,
  loadLocalBookText,
} from "./lib/localBooks";
import {
  loadProgress,
  progressPct,
  recentProgress,
  removeProgress,
  restoreProgress,
  saveProgress,
  type ReadingProgress,
} from "./lib/progress";
import { dismissNudge, homeNudge, NUDGE_AFTER_DAYS, nudgeText, voiceFor, type HomeNudge } from "./lib/characterNudge";
import { withOfflineCopy } from "./lib/offlineText";
import { type BookHint } from "./lib/openLibrary";
import { excerptNearScrollRatio } from "./lib/readingContext";
import { addSeenBlocks, countWords, type SeenBlock } from "./lib/readingPages";
import {
  addReadingSeconds,
  GOAL_OPTIONS,
  hasAnyReading,
  lastReadDay,
  readingSummary,
  readingTotals,
  reconcileStreak,
  setReadingGoalMinutes,
  takeShieldNotice,
  type ReadingEvents,
  dayKey,
} from "./lib/readingStats";
import {
  checkStreakFreeze,
  claimReadingRewards,
  fetchSpinStatus,
  rescueStreak,
  takeSpinOffer,
  type FreezeOutcome,
} from "./lib/diamonds";
import { PLACE_MEDALS, reportReading, readingHeartbeat, takeWeeklyAwards } from "./lib/ranking";
import { lastCharacter, syncEngagementState } from "./lib/reminders";
import { useAppInstall, useUpdateReady } from "./lib/pwa";
import { renderShareCard, shareOrDownload, type ShareCardInput } from "./lib/shareCard";
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthNetworkError,
  AuthSessionError,
  authEnabled,
  clearLegacyCredentials,
  loginRequired,
  consumeAuthRedirect,
  refreshAuthSession,
  refreshProfile,
  storedAuthSession,
  restoreAuthSession,
  signOut,
  type SupabaseSession,
  type SupabaseUser,
} from "./lib/auth";
import { LEGAL_HOLDER_NAME } from "./features/legal/holder";
import "./App.css";
import { installNudgeReady, noteBookOpened, noteVisit } from "./lib/installNudge";
import { FONT_SIZES, PREFS_KEY, loadPrefs } from "./lib/readingPrefs";
import { shortNameOf } from "./lib/characterName";
import { displayNameOf } from "./lib/userMeta";
import { savedLabel } from "./lib/streakLabels";
import { useBackClose } from "./lib/useBackClose";
import { shelfAchievements } from "./lib/shelfAchievements";
import { CONTINUE_PREVIEW } from "./lib/homePreviews";
import { Avatar } from "./components/Avatar";
import { BookCover } from "./components/BookCover";
import { UserAvatar } from "./components/UserAvatar";
import { CountUp } from "./components/CountUp";
import { LastBook, ReminderSetup } from "./features/home/ReminderSetup";
import { ProfileShelf } from "./features/home/ProfileShelf";
import { Explore, LangBadge } from "./features/home/Explore";
import { SHELVES } from "./data/shelves";
import { MyBooks } from "./features/home/MyBooks";
import { CelebrationOverlay, type Celebration } from "./features/home/CelebrationOverlay";
import { withoutImageMarkers } from "./lib/imageMarkers";
import { toBlocks } from "./features/reader/bookText";
import { listNames, uid, type Msg } from "./features/chat/chatHelpers";
import { VoicePanel } from "./features/reader/VoicePanel";
import { SelectionToolbar } from "./features/reader/SelectionToolbar";
import { WordCard } from "./features/reader/WordCard";
import { BookSearchDialog } from "./features/reader/BookSearchDialog";
import { HighlightsDialog } from "./features/reader/HighlightsDialog";
import { ChatPanel } from "./features/chat/ChatPanel";
import { useChat, type ChatSendContext } from "./features/chat/useChat";
import { useBookSearch } from "./features/reader/useBookSearch";
import { useBookTranslation } from "./features/reader/useBookTranslation";
import { useReadAloud } from "./features/reader/useReadAloud";
import { ReaderBar } from "./features/reader/ReaderBar";
import { ChapterText } from "./features/reader/ChapterText";

/** Capítulo sem tradução carregada: a mesma referência sempre, para não refazer o texto da tela. */

type LoadState = "idle" | "loading" | "ready" | "error";

/** Aviso na tela inicial: a sequência quebrou (oferta) ou foi salva com diamantes. */
function FreezeNudge({
  outcome,
  busy,
  onSave,
  onOpenShop,
  onClose,
}: {
  outcome: FreezeOutcome;
  busy: boolean;
  onSave: () => void;
  onOpenShop: () => void;
  onClose: () => void;
}) {
  const close = (
    <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar aviso">
      {Icon.close}
    </button>
  );
  if (outcome.kind === "saved") {
    return (
      <div className="nudge nudge-diamond" role="status">
        <span className="nudge-emoji" aria-hidden="true">
          🧊
        </span>
        <div>
          <strong>
            Sequência salva: {outcome.streak} {outcome.streak === 1 ? "dia" : "dias"}
          </strong>
          <span>Salva-ofensiva usado · −{outcome.spent} 💎</span>
        </div>
        {close}
      </div>
    );
  }
  const { rescue, wallet, reason } = outcome;
  const cost = rescue.paidDays.length * wallet.freeze_price;
  return (
    <div className="nudge nudge-diamond" role="status">
      <span className="nudge-emoji" aria-hidden="true">
        💔
      </span>
      <div>
        <strong>
          Sua sequência de {rescue.streak} {rescue.streak === 1 ? "dia" : "dias"} quebrou
        </strong>
        <span>
          {reason === "manual"
            ? "Dá para salvar com o Salva-ofensiva."
            : reason === "limit"
              ? "Limite da semana atingido."
              : `Faltam ${Math.max(0, cost - wallet.balance)} 💎 para salvar.`}
        </span>
      </div>
      {reason === "manual" ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>
          {busy ? "Salvando…" : `Salvar · ${cost} 💎`}
        </button>
      ) : reason === "no-balance" ? (
        <button type="button" className="btn" onClick={onOpenShop}>
          Loja
        </button>
      ) : null}
      {close}
    </div>
  );
}

/** Convite na tela inicial para abrir o ranking. */
function RankingTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="ranking-teaser" onClick={onOpen}>
      <span className="ranking-teaser-icon" aria-hidden="true">
        🏆
      </span>
      <span className="ranking-teaser-text">
        <strong>Ranking de leitores</strong>
        <span>Veja quem mais leu, no geral e na semana, e em que lugar você está. O pódio da semana ganha diamantes.</span>
      </span>
      <span className="ranking-teaser-go" aria-hidden="true">
        {Icon.next}
      </span>
    </button>
  );
}

/** Quantas pessoas estão na sala agora (null enquanto conecta ou sem Realtime). */
function usePresenceCount(room: string | null, who: string | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(null);
    if (!room) return;
    return watchPresence(room, who, setCount);
  }, [room, who]);
  return count;
}

/** Conquistas da conta agora (sem presentes: esses dependem do servidor e só contam no perfil). */
function currentAchievements(): Achievement[] {
  const talks = characterTalks();
  const markGroups = new Set(allHighlights().flatMap(({ bookId, highlights }) => highlights.map((h) => `${bookId}:${h.group ?? h.id}`)));
  const totals = readingTotals();
  return achievements({
    totalMinutes: totals.totalMinutes,
    bestStreak: totals.bestStreak,
    finishedBooks: finishedBooks().length,
    marks: markGroups.size,
    messagesSent: talks.reduce((n, t) => n + t.sent, 0),
    charactersTalked: talks.length,
    giftsReceived: null,
    shelf: shelfAchievements(),
  });
}

/** Aviso pequeno no topo quando sai uma conquista nova; some sozinho e não cobre a leitura. */
function AchievementToast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  const medal = useRef<HTMLSpanElement>(null);
  /** Ao sair, a medalha voa até o avatar do topo (é lá que as conquistas ficam guardadas). */
  const leave = useCallback(() => {
    flyEmoji(achievement.emoji, medal.current, document.querySelector(".nav-account .nav-avatar") ?? document.querySelector(".nav-account"));
    onDone();
  }, [achievement, onDone]);
  useEffect(() => {
    haptic([20, 40, 20]);
    const t = window.setTimeout(leave, 3600);
    return () => window.clearTimeout(t);
  }, [leave]);
  return createPortal(
    <div className="achievement-toast" role="status" onClick={leave}>
      <span className="achievement-toast-medal" aria-hidden="true" ref={medal}>
        <BadgeIcon id={achievement.id} size={22} />
      </span>
      <span>
        <small>Conquista desbloqueada</small>
        <strong>{achievement.title}</strong>
      </span>
    </div>,
    document.body,
  );
}

/**
 * Recado do personagem na tela inicial: o leitor sumiu do livro há alguns dias e quem estava
 * conversando com ele manda uma mensagem na própria voz. Responder abre o livro já na conversa.
 */
function CharacterNudgeCard({
  nudge,
  onContinue,
  onReply,
  onDismiss,
}: {
  nudge: HomeNudge;
  onContinue: () => void;
  onReply: () => void;
  onDismiss: () => void;
}) {
  const { progress, character, text } = nudge;
  const avatar: StoryCharacter = { id: character.id ?? character.name, name: character.name, role: "", color: character.color, systemHint: "" };
  return (
    <section className="character-nudge" aria-label={`Mensagem de ${character.name}`}>
      <Avatar character={avatar} bookTitle={progress.book.title} />
      <div className="character-nudge-body">
        <span className="eyebrow">
          {character.name} · {progress.book.title}
        </span>
        <p className="character-nudge-text">“{text}”</p>
        <span className="character-nudge-where">Você parou em {progress.chapterLabel}</span>
        <div className="character-nudge-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onReply}>
            {Icon.chat} Responder
          </button>
          <button type="button" className="link-btn" onClick={onContinue}>
            Continuar lendo
          </button>
        </div>
      </div>
      <button type="button" className="icon-btn character-nudge-close" onClick={onDismiss} aria-label={`Fechar a mensagem de ${character.name}`}>
        {Icon.close}
      </button>
    </section>
  );
}

/** Frase do dia: um trecho conhecido; tocar revela de qual livro é. */
function DailyQuote({ books }: { books: Ebook[] }) {
  const quote = useMemo(() => quoteOfTheDay(), []);
  const book = books.find((b) => b.title === quote.bookTitle);
  const [revealed, setRevealed] = useState(false);
  if (!book) return null;
  return (
    <section className="daily-quote" aria-label="Frase do dia">
      <span className="eyebrow">✦ Frase do dia</span>
      <blockquote>“{quote.text}”</blockquote>
      {revealed ? (
        <p className="daily-quote-book">
          <strong>{book.title}</strong> · {book.author}
        </p>
      ) : (
        <button type="button" className="btn daily-quote-guess" onClick={() => setRevealed(true)}>
          De qual livro é?
        </button>
      )}
    </section>
  );
}

function greetingNow(d = new Date()): string {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/** O que o personagem manda para chamar o leitor de volta (texto fixo: não gasta IA). */
function welcomeCallLine(hasCharacter: boolean, pick: number, d = new Date()): string {
  if (!hasCharacter) return "Sua história está te esperando. Os personagens também.";
  const h = d.getHours();
  const lines =
    h >= 22 || h < 5
      ? ["Ainda por aqui a essa hora? Dá tempo de mais um capítulo comigo.", "Noite boa pra ler, né? Vem, eu te conto o resto."]
      : h < 12
        ? ["Bom dia! Que tal começar o dia com a nossa história?", "Bom dia! Quero saber o que você vai achar do que vem agora."]
        : [
            "Oi! Fiquei pensando em você e na nossa história.",
            "Senti sua falta. Vamos continuar de onde paramos?",
            "Tenho uma coisa pra te contar sobre o que vem depois… mas só se você continuar lendo.",
          ];
  return lines[Math.floor(pick * lines.length)];
}

/**
 * Boas-vindas de quem está lendo: a capa do livro e o personagem "digitando" (só o nome, sem a
 * foto) até chegar o balão chamando de volta. A capa daqui é a que cresce e abre ao tocar em
 * "Continuar lendo".
 */
/**
 * Situação da assinatura em destaque na tela inicial, com o atalho para "Minha assinatura".
 * Quem está sem acesso nem chega aqui (vê a tela de bloqueio), então só sobram estes casos.
 */
function PlanCard({ status }: { status: SubscriptionSnapshot }) {
  const until = billingDate(status.accessUntil);
  // O motivo vem antes do status: acesso grátis e Pix não têm assinatura no cartão por trás.
  const reason = status.reason ?? status.status;
  const view =
    reason === "past_due"
      ? { tone: "is-warning", icon: "⚠️", title: "Pagamento pendente", sub: "Atualize o cartão para não perder o acesso.", cta: "Resolver agora" }
      : reason === "trial" || reason === "trialing"
        ? { tone: "is-trial", icon: "✨", title: "Você está no teste grátis", sub: `Acesso liberado até ${until}.`, cta: "Ver assinatura" }
        : reason === "pix"
          ? { tone: "", icon: "💠", title: "Pago com Pix", sub: `Acesso até ${until}. Não renova sozinho.`, cta: "Pagar mais dias" }
          : reason === "grant" || reason === "staff"
            ? {
                tone: "",
                icon: "🎁",
                title: billingStatusLabel(reason),
                sub: status.accessUntil ? `Liberado pela equipe até ${until}.` : "Seu acesso foi liberado pela equipe.",
                cta: "Ver detalhes",
              }
            : {
                tone: "",
                icon: "👑",
                title: `Assinante ${status.plan || "Storyverse"}`,
                sub: status.cancelAtPeriodEnd ? `Cancelada: acesso até ${until}.` : `Renova em ${until}.`,
                cta: "Minha assinatura",
              };
  return (
    <Link className={`plan-card ${view.tone}`} to="/conta/assinatura">
      <span className="plan-card-icon" aria-hidden="true">
        {view.icon}
      </span>
      <span className="plan-card-text">
        <strong>{view.title}</strong>
        <span>{view.sub}</span>
      </span>
      <span className="plan-card-cta">
        {view.cta}
        {Icon.next}
      </span>
    </Link>
  );
}

function WelcomeCall({ book, onOpen }: { book: Ebook; onOpen: () => void }) {
  const character = useMemo(() => {
    const cast = knownCast(book);
    if (!cast) return null;
    const last = lastCharacter(book.id);
    return cast.find((c) => c.name === last) ?? cast[0];
  }, [book]);
  // Sorteia uma vez só; a frase acompanha o personagem quando ele aparece depois do primeiro desenho.
  const [pick] = useState(() => Math.random());
  const line = welcomeCallLine(Boolean(character), pick);
  const [phase, setPhase] = useState<"waiting" | "typing" | "said">(() => (prefersReducedMotion() ? "said" : "waiting"));
  useEffect(() => {
    if (phase === "said") return;
    const typing = window.setTimeout(() => setPhase("typing"), 450);
    const said = window.setTimeout(() => setPhase("said"), 1900);
    return () => {
      window.clearTimeout(typing);
      window.clearTimeout(said);
    };
    // Só na primeira vez que a tela aparece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="welcome-call" onClick={onOpen} aria-label={`Continuar lendo ${book.title}`}>
      <span className="welcome-call-book">
        <BookCover book={book} />
      </span>
      <span className="welcome-call-talk" aria-hidden="true">
        <span className="welcome-call-name">{character ? shortNameOf(character) : book.title}</span>
        {phase === "said" ? (
          <span className="welcome-call-bubble">{line}</span>
        ) : phase === "typing" ? (
          <span className="welcome-call-bubble is-typing typing">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Estante em destaque para quem já está lendo: fileira que rola para o lado, com cartões
 * compactos (capa, título, autor, personagens). A sinopse aparece ao passar o mouse.
 */
function FeaturedRow({
  id,
  title,
  subtitle,
  books,
  progressById,
  onOpen,
}: {
  id?: string;
  title: string;
  subtitle: string;
  books: Ebook[];
  progressById: Map<number, ReadingProgress>;
  onOpen: (b: Ebook) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges]);
  const scroll = (dir: 1 | -1) => {
    const el = rowRef.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="shelf featured-row" id={id}>
      <div className="shelf-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="row-nav" aria-hidden="true">
          <button type="button" className="icon-btn" onClick={() => scroll(-1)} disabled={edges.start} tabIndex={-1}>
            {Icon.back}
          </button>
          <button type="button" className="icon-btn" onClick={() => scroll(1)} disabled={edges.end} tabIndex={-1}>
            {Icon.next}
          </button>
        </div>
      </div>
      <div className="shelf-row" ref={rowRef} onScroll={updateEdges}>
        {books.map((b) => {
          const progress = progressById.get(b.gutenbergId);
          const pct = progress ? Math.round(progressPct(progress)) : null;
          return (
            <button key={b.id} type="button" className="row-card" onClick={() => onOpen(b)} title={b.blurb}>
              <BookCover book={b} />
              {pct !== null ? (
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
              ) : null}
              <strong>{b.title}</strong>
              <span className="row-card-author">{b.author}</span>
              <ReaderCount bookKey={bookKeyOf(b)} />
              {b.characters?.length ? (
                <span className="row-card-cast">
                  <span className="avatar-stack">
                    {b.characters.slice(0, 3).map((c) => (
                      <Avatar key={c.id} character={c} size="sm" bookTitle={b.title} />
                    ))}
                  </span>
                  {pct !== null ? `${pct}% lido` : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Aviso curto de privacidade nas telas de conversa e busca: o que acontece com o que a pessoa
 * digita, com o detalhe a um toque. A lista completa fica na Central de Privacidade (Ajustes).
 */

/** Sequência de dias lendo, semana, escudos, meta diária de minutos e lembrete. */
function ReadingStreak({ lastBook }: { lastBook?: LastBook }) {
  const [summary, setSummary] = useState(readingSummary);
  const [reminderOpen, setReminderOpen] = useState(false);
  /** Cada toque na chama solta faíscas e um recado (o número muda a key e reinicia a animação). */
  const [flare, setFlare] = useState(0);
  const flameRef = useRef<HTMLButtonElement>(null);
  function poke() {
    setFlare((n) => n + 1);
    haptic(15);
    if (prefersReducedMotion()) return;
    flameRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.45) rotate(-8deg)" }, { transform: "scale(0.92)" }, { transform: "scale(1)" }],
      { duration: 550, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }
  const pct = Math.min(100, (summary.todayMinutes / summary.goalMinutes) * 100);
  const goalDone = summary.todayMinutes >= summary.goalMinutes;
  return (
    <section className="streak" aria-label="Sua leitura">
      <div className="streak-main">
        <button
          ref={flameRef}
          type="button"
          className={`streak-flame ${summary.readToday ? "is-lit" : ""}`}
          onClick={poke}
          aria-label={`Sequência: ${summary.streak} ${summary.streak === 1 ? "dia" : "dias"}`}
        >
          <span aria-hidden="true">🔥</span>
          {flare > 0 ? (
            <span key={flare} className="flame-burst" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
              <b className="flame-tip">
                {summary.readToday
                  ? summary.streak > 1
                    ? `${summary.streak} dias! Volte amanhã 🔥`
                    : "Começou! Volte amanhã 🔥"
                  : "Leia hoje para acender"}
              </b>
            </span>
          ) : null}
        </button>
        <div>
          <strong>
            <CountUp value={summary.streak} /> {summary.streak === 1 ? "dia seguido" : "dias seguidos"}
          </strong>
          <span>
            {summary.readToday
              ? "Você já leu hoje. Continue assim!"
              : summary.streak > 0
                ? "Leia hoje para não perder a sequência."
                : "Leia um pouco hoje para começar uma sequência."}
          </span>
          <span
            className="streak-shields"
            title="A cada 7 dias seguidos você ganha um escudo (até 2). Se um dia passar sem leitura, ele salva a sua sequência."
          >
            {summary.shields > 0
              ? `🛡️ ${summary.shields} ${summary.shields === 1 ? "escudo" : "escudos"} protegendo a sequência`
              : "🛡️ Ganhe um escudo a cada 7 dias seguidos"}
          </span>
        </div>
      </div>

      <ol className="streak-week" aria-label="Últimos 7 dias">
        {summary.week.map((d, i) => (
          <li
            key={i}
            className={[`is-${d.state}`, d.today ? "is-today" : ""].filter(Boolean).join(" ")}
            aria-label={`${d.today ? "Hoje" : d.label}: ${d.state === "read" ? "leu" : d.state === "frozen" ? savedLabel(d) : "não leu"}`}
          >
            {d.state === "frozen" ? (d.bought ? "💎" : "🛡️") : d.label}
          </li>
        ))}
      </ol>

      <div className="streak-goal">
        <div className="streak-goal-text">
          <span>Meta de hoje</span>
          <strong>
            {goalDone ? "Meta cumprida! " : ""}
            <CountUp value={summary.todayMinutes} /> de {summary.goalMinutes} min
          </strong>
        </div>
        <div className={`streak-bar ${goalDone ? "is-done" : ""}`} aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="streak-goal-foot">
          <button
            type="button"
            className="inline-link"
            onClick={() => setReminderOpen((v) => !v)}
            aria-expanded={reminderOpen}
          >
            🔔 Lembrete diário
          </button>
          <label className="streak-select">
            Meta diária
            <select
              value={summary.goalMinutes}
              onChange={(e) => {
                setReadingGoalMinutes(Number(e.target.value));
                setSummary(readingSummary());
              }}
            >
              {GOAL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {reminderOpen ? <ReminderSetup lastBook={lastBook} /> : null}
    </section>
  );
}

/**
 * Exemplo do topo da página "acontecendo": a pergunta chega, o personagem escreve e a resposta
 * vai sendo digitada; depois recomeça. Os balões guardam o espaço desde o início (nada pula).
 */
function DemoConversation({ question, answer }: { question: string; answer: string }) {
  const [step, setStep] = useState(() => (prefersReducedMotion() ? 3 : 0));
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? answer.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    void (async () => {
      while (alive) {
        setStep(0);
        setTyped(0);
        await wait(700);
        if (!alive) return;
        setStep(1);
        await wait(1100);
        if (!alive) return;
        setStep(2);
        await wait(1600);
        if (!alive) return;
        setStep(3);
        for (let i = 2; i < answer.length && alive; i += 2) {
          setTyped(i);
          await wait(26);
        }
        setTyped(answer.length);
        await wait(7000);
      }
    })();
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [answer]);
  return (
    <>
      <div className={`bubble user demo-bubble ${step >= 1 ? "is-shown" : ""}`}>{question}</div>
      <div className={`bubble assistant demo-bubble ${step >= 2 ? "is-shown" : ""}`}>
        {answer.slice(0, step >= 3 ? typed : 0)}
        <span className="demo-rest">{answer.slice(step >= 3 ? typed : 0)}</span>
        {step === 2 ? (
          <span className="demo-typing typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}
      </div>
    </>
  );
}

/**
 * O livro ainda pode ser aberto por esta conta? Importado: precisa estar em "Seus livros" neste
 * aparelho. Da comunidade: precisa continuar aprovado no acervo. Do Gutenberg: sempre.
 * Enquanto a lista ainda não chegou (ou falhou, sem internet), não esconde o da comunidade;
 * o importado só aparece depois de conferido (o navegador responde na hora).
 */
function bookAvailable(b: Ebook, known: { localIds: Set<number> | null; communityIds: Set<string> | null }): boolean {
  if (isLocalBook(b)) return known.localIds?.has(b.gutenbergId) ?? false;
  if (b.source === "community") return known.communityIds?.has(b.id) ?? true;
  return true;
}
/** Livros começados, para retomar do ponto onde o leitor parou: os 4 mais recentes e "Ver todos". */
function ContinueReading({
  items,
  onOpen,
  onRemove,
  undo,
  onUndo,
}: {
  items: ReadingProgress[];
  onOpen: (b: Ebook) => void;
  /** Tira o livro da lista (o leitor não quer mais continuar). */
  onRemove: (p: ReadingProgress) => void;
  /** Livro que acabou de sair da lista, enquanto ainda dá para desfazer. */
  undo: ReadingProgress | null;
  onUndo: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, CONTINUE_PREVIEW);

  return (
    <section className="shelf continue">
      <div className="shelf-head">
        <h2>Continue lendo</h2>
        <p>Volte exatamente de onde parou.</p>
      </div>
      {undo ? (
        <div className="continue-undo" role="status">
          <span>
            <strong>{undo.book.title}</strong> saiu da lista
          </span>
          <button type="button" className="btn continue-undo-btn" onClick={onUndo}>
            {Icon.refresh}
            Desfazer
          </button>
        </div>
      ) : null}
      <div className="result-grid">
        {shown.map((p) => {
          const pct = Math.round(progressPct(p));
          return (
            <div key={p.book.gutenbergId} className="my-book">
              <button
                type="button"
                className="result"
                onClick={() => onOpen(p.book)}
                aria-label={`Continuar ${p.book.title}, ${p.chapterLabel}, ${pct}% lido`}
              >
                <BookCover book={p.book} />
                <span className="continue-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(pct, 3)}%` }} />
                </span>
                <strong>{p.book.title}</strong>
                <span>
                  {p.chapterLabel} · {pct}%
                </span>
              </button>
              <button
                type="button"
                className="link-btn my-book-remove"
                onClick={() => onRemove(p)}
                aria-label={`Tirar ${p.book.title} de Continue lendo`}
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>
      {items.length > CONTINUE_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Mostrar menos" : `Ver todos (${items.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const INSTALL_BANNER_KEY = "storyverse:install-banner-hidden";
/** Fechado no celular, o convite volta depois de 14 dias (o botão do topo continua lá). */
const INSTALL_BANNER_PAUSE = 14 * 24 * 60 * 60 * 1000;

function installBannerHidden(): boolean {
  try {
    return Date.now() - Number(userStorage.getItem(INSTALL_BANNER_KEY) ?? 0) < INSTALL_BANNER_PAUSE;
  } catch {
    return false;
  }
}

function hideInstallBanner() {
  try {
    userStorage.setItem(INSTALL_BANNER_KEY, String(Date.now()));
  } catch {
    // Sem armazenamento: some só nesta visita.
  }
}

/**
 * Aplica os escudos uma vez por carregamento da página, antes de desenhar qualquer coisa (assim o
 * quadro da sequência já mostra o dia salvo). Devolve o tamanho da sequência salva, para o aviso.
 */
let shieldNoticeCache: number | null | undefined;
function shieldNoticeOnLoad(): number | null {
  if (shieldNoticeCache === undefined) {
    const r = reconcileStreak();
    shieldNoticeCache = r.shieldsUsed > 0 && takeShieldNotice() ? r.streak : null;
  }
  return shieldNoticeCache;
}

/** Quantos livros curados entram em "Novidades da biblioteca" na home. */
const CATALOG_NEW_LIMIT = 6;

export function App() {
  const [book, setBook] = useState<Ebook | null>(null);
  const currentBookRef = useRef(book);
  const readerGeneration = useRef(0);
  currentBookRef.current = book;
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  // Sem Supabase configurado não há sessão para verificar: a tela abre direto.
  const [authLoading, setAuthLoading] = useState(authEnabled);
  // A tela de abertura espera o login carregar (no primeiro desenho, antes de ela poder sair).
  useState(() => holdSplash());
  useEffect(() => {
    if (!authLoading) releaseSplash();
  }, [authLoading]);
  useEffect(() => () => releaseSplash(), []);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ text: string; ok?: boolean } | null>(null);
  const [sanctionNotice, setSanctionNotice] = useState<string | null>(null);
  const authUser: SupabaseUser | null = authSession?.user ?? null;
  const [readyOwner, setReadyOwner] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const dataIsReady = !authEnabled || (!authLoading && readyOwner === (authUser?.id ?? "anon"));
  /** Pode ler e importar: login desligado, conta opcional ou já entrou. */
  const canRead = dataIsReady && (!loginRequired || !!authUser);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  /** Estante (biblioteca pessoal): só para contas com a feature `library`. */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shelfPanelOpen, setShelfPanelOpen] = useState(false);
  const { capabilities } = useAccountFeatures(authSession);
  const subscription = capabilities?.subscription;
  const authScreen =
    window.location.pathname === "/confirmar-email" || window.location.pathname === "/redefinir-senha";
  const billingBlocked =
    BILLING_UI_ENABLED && !authScreen && Boolean(authUser) && subscription !== undefined && !subscription.active;
  /**
   * `/?login=1` ou `/?cadastro=1` (links "Entrar"/"Criar conta" das subpáginas e da assinatura): abre
   * a janela certa uma vez. Tira só esse parâmetro da URL; o `retorno` fica para depois do login.
   */
  useEffect(() => {
    if (authLoading || authUser) return;
    const mode = authModalFromUrl(window.location.search);
    if (!mode) return;
    setAuthModal(mode);
    const params = new URLSearchParams(window.location.search);
    params.delete("login");
    params.delete("cadastro");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
  }, [authLoading, authUser]);
  /** Voltou do login pedindo uma página conhecida (assinatura, audiolivro): continua de onde parou. */
  useEffect(() => {
    if (!authUser) return;
    const retorno = safeLoginReturn(new URLSearchParams(window.location.search).get("retorno"));
    if (retorno) window.location.assign(retorno);
  }, [authUser]);
  const shelfOn = hasFeature(capabilities, "library");
  const canModerate = (capabilities?.roles ?? []).some(
    (role) => role === "superadmin" || role === "moderator",
  );
  const staffOn = isStaff(capabilities?.roles ?? []);
  const groupsOn = GROUPS_AVAILABLE && hasFeature(capabilities, "groups");
  const groupsActivity = useGroupsUnread(groupsOn && authUser ? authUser.id : "");
  const groupsUnread = groupsActivity.total;
  /** Abriu um convite de grupo sem conta: depois de entrar, volta para ele. */
  useEffect(() => {
    if (!authUser) return;
    try {
      const code = localStorage.getItem(PENDING_INVITE_KEY);
      if (code && /^[A-Za-z0-9_-]{16,64}$/.test(code)) window.location.assign(`/g/${code}`);
    } catch {
      // Sem armazenamento.
    }
  }, [authUser]);
  // A estante só liga com os dados do aparelho já na conta da sessão (troca de conta terminada).
  useEffect(() => connectShelf(dataIsReady ? authSession : null, shelfOn), [authSession, shelfOn, dataIsReady]);
  /** Sequência quebrada ao abrir o app: salva com diamantes ou a oferta para salvar. */
  const [freezeOutcome, setFreezeOutcome] = useState<FreezeOutcome | null>(null);
  const [freezeBusy, setFreezeBusy] = useState(false);
  /** Roleta diária aberta (sozinha na primeira visita do dia, se ainda não girou). */
  const [spinOpen, setSpinOpen] = useState(false);
  const [communityBooks, setCommunityBooks] = useState<Ebook[]>([]);
  const [communityTick, setCommunityTick] = useState(0);
  /** Novidades do catálogo público (a biblioteca completa fica em /biblioteca). */
  const [catalogNew, setCatalogNew] = useState<Ebook[]>([]);
  /** Aberto pelo perfil numa marcação: o livro abre direto nesse trecho. */
  const openAtRef = useRef<{ bookId: string; chapterIndex: number; chapterLabel: string; paragraph: number } | null>(null);

  /** Chegou pelo link "esqueci minha senha": mostra a tela de senha nova. */
  const [passwordReset, setPasswordReset] = useState(false);
  /** Link de recuperação da API própria (token sem sessão). */
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    void (async () => {
      try {
        clearLegacyCredentials();
        // Veio de um link do e-mail (confirmação de cadastro ou recuperação de senha)?
        const redirect = await consumeAuthRedirect().catch((err: unknown) => ({
          error: err instanceof Error ? err.message : "Não foi possível concluir o acesso pelo link.",
        }));
        if (redirect && "error" in redirect) {
          if (!cancelled) setAuthNotice({ text: redirect.error });
        } else if (redirect) {
          if (!cancelled) {
            if ("resetToken" in redirect) {
              setResetToken(redirect.resetToken);
            } else {
              setAuthSession(redirect.session);
              if (redirect.type === "recovery") setPasswordReset(true);
              else if (redirect.type === "signup") {
                setAuthNotice({ text: "E-mail confirmado. Boas-vindas ao Storyverse!", ok: true });
              }
            }
          }
          return;
        }
        const session = await restoreAuthSession();
        if (!cancelled) setAuthSession(session);
      } catch (err) {
        if (!cancelled) {
          setAuthSession(null);
          setAuthNotice({ text: err instanceof Error ? err.message : "Não foi possível restaurar sua sessão." });
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Muda para tentar renovar a sessão de novo (depois de uma falha de conexão). */
  const [refreshRetry, setRefreshRetry] = useState(0);
  useEffect(() => {
    if (!authSession) return;
    // Nunca menos de 30 s entre renovações: mesmo com o relógio errado, não estoura o limite do Supabase.
    const refreshIn = Math.max(30_000, authSession.expires_at * 1000 - Date.now() - 60_000);
    let retryTimer = 0;
    let alive = true;
    const onOnline = () => setRefreshRetry((n) => n + 1);
    const timer = window.setTimeout(() => {
      void refreshAuthSession()
        .then((session) => { if (alive) setAuthSession(session); })
        .catch((err: unknown) => {
          if (!alive) return;
          if (err instanceof AuthSessionError) {
            // Cookie inválido/expirado ou sessão encerrada: não há access token novo.
            setAuthSession(null);
            setAuthNotice({ text: "Sua sessão expirou. Entre novamente." });
            return;
          }
          // Sem internet ou limite do Supabase: continua logado e tenta de novo quando a conexão
          // voltar (ou em 1 min).
          if (err instanceof AuthNetworkError) {
            window.addEventListener("online", onOnline, { once: true });
            retryTimer = window.setTimeout(onOnline, 60_000);
            return;
          }
          setAuthSession(null);
          setAuthNotice({ text: err instanceof Error ? err.message : "Sua sessão expirou. Entre novamente." });
        });
    }, refreshIn);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      alive = false;
      window.removeEventListener("online", onOnline);
    };
  }, [authSession, refreshRetry]);

  useEffect(() => {
    function syncSession(event: StorageEvent) {
      if (event.key !== AUTH_SESSION_STORAGE_KEY) return;
      if (!event.newValue) {
        setAuthSession(null);
        return;
      }
      // O cookie HttpOnly é compartilhado entre abas; força uma renovação para esta aba.
      void refreshAuthSession(true)
        .then((next) => setAuthSession(next))
        .catch((err: unknown) => setAuthSession(err instanceof AuthSessionError ? null : storedAuthSession()));
    }
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const authUserId = authSession?.user.id;

  /**
   * Cada conta com os próprios dados de leitura neste aparelho: ao trocar de conta (ou sair), troca
   * antes de desenhar a tela, para não aparecer nada da conta anterior nem por um instante.
   */
  const [dataEpoch, setDataEpoch] = useState(0);
  // Cor do app: no aparelho ou da conta (para bater com o perfil em Pessoas).
  const accountTheme = authSession?.user.user_metadata?.profile_theme;
  useEffect(() => {
    if (!dataIsReady) return;
    if (authSession?.user) syncAppThemeFromAccount(authSession.user.user_metadata);
    else applyAppTheme();
  }, [dataIsReady, dataEpoch, authSession?.user.id, accountTheme]);
  const onlineCount = usePresenceCount(authEnabled ? "app" : null, authUserId);
  /** Elenco do livro aberto (null enquanto a IA ainda está sugerindo). */
  const [cast, setCast] = useState<StoryCharacter[] | null>(null);
  const chat = useChat({ book, cast, authSession, sendContext: chatSendContext, beginRequest: beginChatRequest });
  const { resetChat, startConversation, setChatOpen } = chat;
  const bookRoomId = book?.id;
  const readingHere = usePresenceCount(authEnabled && bookRoomId ? `book:${bookRoomId}` : null, authUserId);
  useLayoutEffect(() => {
    if (!authEnabled || authLoading) return;
    let alive = true;
    setReadyOwner(null);
    readerGeneration.current++;
    setOwnerError(null);
    setBook(null);
    resetChat();
    void activateDataOwner(authUserId ?? "anon").then((changed) => {
      if (!alive) return;
      setReadyOwner(authUserId ?? "anon");
      if (changed) {
        setPrefs(loadPrefs());
        setDataEpoch((n) => n + 1);
      }
    }).catch(() => {
      if (alive) setOwnerError("Não foi possível abrir os dados desta conta. Libere espaço no navegador e recarregue a página.");
    });
    return () => {
      alive = false;
    };
  }, [authUserId, authLoading, resetChat]);

  /**
   * Nuvem: a mesma conta na Web e no app instalado. Ao entrar (depois da troca de dono acima),
   * ao voltar para o app e de tempos em tempos, junta os dados da conta com os do aparelho, envia
   * e baixa os livros importados e atualiza o perfil.
   */
  const syncAccount = useCallback(async (session: SupabaseSession, opts: { keepalive: boolean; resume: boolean }) => {
    let changed = await syncNow(session, { keepalive: opts.keepalive });
    // A conta pode ter trocado durante o await: não mistura os dados locais de uma com a sessão da outra.
    if (currentDataOwner() !== session.user.id) return false;
    // Minutos da semana para o ranking (sem o ranking configurado no Supabase, segue sem ele).
    const reported = await reportReading(session, { keepalive: opts.keepalive }).catch(() => false);
    if (opts.keepalive) return changed;
    if (currentDataOwner() !== session.user.id) return false;
    // Leitura do dia que rende diamantes: pede a recompensa e avisa.
    if (reported) {
      const gained = await claimReadingRewards(session).catch(() => 0);
      if (gained > 0) setToast(`+${gained} 💎 pela leitura de hoje`);
    }
    const books = await syncBooks(session).catch(() => ({ local: false, library: false }));
    // A lista da conta mudou (livro enviado ou removido): manda já para os outros aparelhos.
    if (books.library) changed = (await syncNow(session).catch(() => false)) || changed;
    if (opts.resume) {
      void refreshProfile(session)
        .then((next) => next !== session && authSessionRef.current?.user.id === next.user.id && setAuthSession(next))
        .catch(() => {});
    }
    return changed || books.local;
  }, []);
  const applyRemoteData = useCallback(() => {
    setPrefs(loadPrefs());
    // A tela inicial é redesenhada com os dados novos: sem pular para o topo.
    const y = window.scrollY;
    setDataEpoch((n) => n + 1);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, []);
  useEffect(() => {
    if (!authEnabled || authLoading) return;
    const session = authSessionRef.current;
    if (!session) return;
    let alive = true;
    void dataOwnerReady()
      .then(() => {
        if (!alive) return false;
        return syncAccount(session, { keepalive: false, resume: true });
      })
      .then(async (changed) => {
        if (!alive) return;
        if (changed) applyRemoteData();
        const outcome = await checkStreakFreeze(session).catch(() => null);
        if (!alive) return;
        if (outcome) {
          setFreezeOutcome(outcome);
          if (outcome.kind === "saved") setDataEpoch((n) => n + 1);
        }
        const spin = await fetchSpinStatus(session).catch(() => null);
        if (alive && spin && !spin.spun_today && takeSpinOffer(dayKey())) setSpinOpen(true);
      })
      .catch(() => {
        // Sem a tabela ou sem internet: segue só com os dados do aparelho.
      });
    return () => {
      alive = false;
    };
  }, [authUserId, authLoading, syncAccount, applyRemoteData]);
  useEffect(
    () => (authEnabled ? startAutoSync(() => authSessionRef.current, syncAccount, applyRemoteData) : undefined),
    [syncAccount, applyRemoteData],
  );

  /** Sessão atual para o carregamento do texto (sem recarregar o livro quando o token renova). */
  const authSessionRef = useRef(authSession);
  authSessionRef.current = authSession;

  const { confirm: confirmApp, dialog: appConfirmDialog } = useConfirm();

  /** "Sair da conta" do menu ⋯: mesma confirmação dos Ajustes e da tela de assinatura. */
  async function askLogout() {
    if (
      await confirmApp({
        title: "Sair da conta?",
        message: "Você precisará entrar de novo para continuar lendo neste aparelho.",
        confirmLabel: "Sair",
        danger: true,
      })
    ) {
      void logout();
    }
  }

  async function logout() {
    if (!authSession || authActionLoading) return;
    setAuthActionLoading(true);
    setAuthNotice(null);
    setSanctionNotice(null);
    try {
      // Antes de sair, guarda na nuvem o que ainda não foi enviado.
      await syncNow(authSession).catch(() => {});
      // Este aparelho para de receber as notificações da conta que saiu.
      await disablePush(authSession).catch(() => {});
      await signOut(authSession);
    } catch (err) {
      setAuthNotice({ text: err instanceof Error ? `Sessão encerrada neste dispositivo. ${err.message}` : "Sessão encerrada neste dispositivo." });
    } finally {
      setAuthSession(null);
      setAuthActionLoading(false);
      setProfileOpen(false);
    }
  }

  const [fullText, setFullText] = useState("");
  const [chapterIndex, setChapterIndex] = useState(0);
  /** Para que lado o capítulo novo entra: avançando vem da direita, voltando vem da esquerda. */
  const shownChapterRef = useRef(chapterIndex);
  const chapterDirRef = useRef<"next" | "prev">("next");
  if (shownChapterRef.current !== chapterIndex) {
    chapterDirRef.current = chapterIndex > shownChapterRef.current ? "next" : "prev";
    shownChapterRef.current = chapterIndex;
  }
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [celebration, setCelebration] = useState<Celebration | null>(null);
  /** Conquistas novas na fila do aviso (uma por vez). */
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const noticeAchievements = useCallback(() => {
    const now = currentAchievements();
    const fresh = takeNewAchievements(now, userStorage);
    // Conquista nova: atualiza a vitrine do perfil público (só manda se mudou).
    const owner = storedAuthSession()?.user.id;
    if (fresh.length > 0 && owner) {
      const totals = readingTotals();
      void publishShowcase(owner, now, {
        totalMinutes: totals.totalMinutes,
        bestStreak: totals.bestStreak,
        finishedBooks: finishedBooks().length,
        messagesSent: characterTalks().reduce((n, t) => n + t.sent, 0),
      });
    }
    // Várias de uma vez é dado chegando de outro aparelho (já avisado lá): só registra.
    if (fresh.length > 0 && fresh.length <= 2) setAchievementQueue((q) => [...q, ...fresh]);
  }, []);
  const nextAchievement = useCallback(() => setAchievementQueue((q) => q.slice(1)), []);
  /** Meta do dia batida durante a leitura: a barra do topo brilha (a chave recomeça a animação). */
  const [goalFlash, setGoalFlash] = useState<number | null>(null);
  useEffect(() => {
    if (goalFlash === null) return;
    const t = window.setTimeout(() => setGoalFlash(null), 3600);
    return () => window.clearTimeout(t);
  }, [goalFlash]);
  /** Fechou o livro: a fita do marcador desce na página inicial, mostrando que o ponto ficou guardado. */
  const [bookmarkDrop, setBookmarkDrop] = useState<{ id: number; label: string } | null>(null);
  useEffect(() => {
    if (!bookmarkDrop) return;
    const t = window.setTimeout(() => setBookmarkDrop(null), 2800);
    return () => window.clearTimeout(t);
  }, [bookmarkDrop]);
  useEffect(() => {
    if (!celebration) return;
    const t = window.setTimeout(() => setCelebration(null), celebration.book ? 6500 : 4200);
    return () => window.clearTimeout(t);
  }, [celebration]);
  /** Semana do ranking fechada: parabéns para quem ficou no pódio (uma vez só, ao abrir o app). */
  useEffect(() => {
    if (!authEnabled || !authSession) return;
    let alive = true;
    const session = authSession;
    // Depois da sincronização de abertura, que envia os minutos do fim da semana.
    const t = window.setTimeout(() => {
      void takeWeeklyAwards(session)
        .then((awards) => {
          const last = awards[awards.length - 1];
          if (!alive || !last) return;
          const total = awards.reduce((sum, a) => sum + a.diamonds, 0);
          setCelebration({
            emoji: PLACE_MEDALS[last.place],
            title: `Você ficou em ${last.place}º lugar no ranking da semana!`,
            text: `${formatMinutes(last.minutes)} de leitura. Você ganhou ${total} 💎. Parabéns!`,
          });
        })
        .catch(() => {
          // Sem o ranking no Supabase ou sem internet: tenta de novo na próxima abertura.
        });
    }, 3000);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // Só quando troca de usuário (não a cada renovação do token).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);
  /** Ao abrir o app: escudos salvam a sequência de ontem, se preciso (aviso uma vez por dia). */
  const [shieldNotice, setShieldNotice] = useState<number | null>(shieldNoticeOnLoad);
  /** Capítulos já comemorados nesta visita (para não repetir a cada rolagem). */
  const finishedChaptersRef = useRef(new Set<string>());
  /** Aviso curto no rodapé da tela ("Imagem salva", "Trecho destacado"). */
  const [toast, setToast] = useState<string | null>(null);
  /**
   * Fim de capítulo: cartão no rodapé do próprio capítulo (onde o leitor está olhando), com o
   * progresso do livro. Some sozinho ao trocar de capítulo (a chave deixa de bater).
   */
  const [chapterDone, setChapterDone] = useState<{ key: string; label: string; done: number; total: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* Marcações, seleção de texto e significado de palavras. */
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [selection, setSelection] = useState<{
    text: string;
    /** Pedaço selecionado em cada parágrafo (a seleção pode atravessar vários). */
    parts: { block: number; text: string }[];
    block: number;
    x: number;
    top: number;
    bottom: number;
    word: string | null;
  } | null>(null);
  const [wordCard, setWordCard] = useState<{ word: string; x: number; y: number; info: WordInfo | null } | null>(
    null,
  );

  /** Ao abrir um capítulo, rola até este parágrafo (vindo de uma marcação). */
  const jumpToBlockRef = useRef<number | null>(null);
  /** Última interação no leitor: o tempo de leitura só conta com o leitor presente. */
  const lastActivityRef = useRef(Date.now());
  /** Conta as palavras na tela para as páginas lidas (definida junto dos parágrafos, mais abaixo). */
  const countVisibleWordsRef = useRef<() => void>(() => {});
  const scrollIdleRef = useRef<number | undefined>(undefined);

  const [prefs, setPrefs] = useState(loadPrefs);
  /** Ajustes de leitura no celular: fonte, tema, luz noturna e tela cheia. */
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  /** Fallback de tela cheia para navegadores sem Fullscreen API (iOS). */
  const [immersive, setImmersive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  /** Redesenha a página inicial quando um livro importado é removido (sai de "Continue lendo"). */
  const [homeTick, setHomeTick] = useState(0);
  /** Página inicial: estantes entram ao aparecer na tela; a barra do topo encolhe ao rolar. */
  const homeRef = useRef<HTMLDivElement>(null);
  useEffect(() => installCoverTilt(), []);
  useReveal(homeRef, ".shelf, .steps", [book, dataEpoch, canRead, homeTick, communityBooks.length, catalogNew.length]);
  const [navScrolled, setNavScrolled] = useState(false);
  const [navRef, navFit] = useNavCrowded();
  useEffect(() => {
    if (book) return;
    // Margem entre ligar e desligar: perto do limite a barra não fica alternando.
    const onScroll = () => setNavScrolled((on) => (on ? window.scrollY > 8 : window.scrollY > 40));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [book]);
  /** Ids da comunidade aprovados agora (`null`: lista ainda não veio ou falhou — não esconde nada). */
  const [communityIds, setCommunityIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!authEnabled || book) return;
    let alive = true;
    void approvedCommunityBooks(authSessionRef.current)
      .then((list) => {
        if (!alive) return;
        setCommunityBooks(list);
        setCommunityIds(new Set(list.map((b) => b.id)));
      })
      .catch(() => {
        if (!alive) return;
        setCommunityBooks([]);
        setCommunityIds(null);
      });
    return () => {
      alive = false;
    };
  }, [book, authUserId, communityTick]);
  /** Novidades da biblioteca pública: metadados abertos, sem sessão. */
  useEffect(() => {
    if (book) return;
    let alive = true;
    // O catálogo também lista os envios da comunidade (cm:), que já têm a estante "Da comunidade";
    // aqui ficam só os curados. Pede mais que 6 para sobrar curado depois do filtro.
    void searchCatalog({ sort: "new", limit: 30 })
      .then((page) => {
        if (!alive) return;
        setCatalogNew(
          page.items
            .filter((item) => item.book_key.startsWith("cat:"))
            .slice(0, CATALOG_NEW_LIMIT)
            .map(catalogBookToEbook),
        );
      })
      .catch(() => {
        if (alive) setCatalogNew([]);
      });
    return () => {
      alive = false;
    };
  }, [book, homeTick]);
  /** Livros importados que estão neste aparelho (`null`: ainda lendo do navegador). */
  const [localIds, setLocalIds] = useState<Set<number> | null>(null);
  const [localBookList, setLocalBookList] = useState<Ebook[]>([]);
  useEffect(() => {
    // O livro aberto agora existe: ao voltar para o início ele não some nem por um instante.
    if (book && isLocalBook(book)) setLocalIds((prev) => (prev?.has(book.gutenbergId) ? prev : new Set([...(prev ?? []), book.gutenbergId])));
    if (book) return;
    let alive = true;
    void listLocalBooks()
      .then((list) => {
        if (!alive) return;
        setLocalIds(new Set(list.map((b) => b.gutenbergId)));
        setLocalBookList(list);
      })
      .catch(() => alive && setLocalIds(new Set()));
    return () => {
      alive = false;
    };
  }, [book, authUserId, dataEpoch, homeTick]);
  const isAvailable = useCallback(
    (b: Ebook) => bookAvailable(b, { localIds, communityIds }),
    [localIds, communityIds],
  );
  /** Estante: o livro da entrada ainda abre aqui? (mesma regra de bookAvailable, pela chave) */
  const shelfAvailable = useCallback(
    (bookKey: string) => {
      if (bookKey.startsWith("local:")) return localIds?.has(Number(bookKey.slice(6))) ?? false;
      if (bookKey.startsWith("cm:")) return communityIds?.has(`cm-${bookKey.slice(3)}`) ?? true;
      return true;
    },
    [localIds, communityIds],
  );
  /** Estante: o Ebook completo da entrada (os conhecidos aqui ou um do Gutenberg montado da entrada). */
  const shelfBookFor = useCallback(
    (entry: LocalShelfEntry): Ebook => {
      const known = [
        ...localBookList,
        ...communityBooks,
        ...recentProgress().map((p) => p.book),
        ...finishedBooks().map((f) => f.book),
      ].find((b) => bookKeyOf(b) === entry.bookKey);
      if (known) return known;
      if (entry.bookKey.startsWith("cat:")) {
        const uuid = entry.bookKey.slice(4);
        return {
          id: `cat-${uuid}`,
          gutenbergId: catalogNumericId(entry.bookKey),
          title: entry.title,
          author: entry.author ?? "",
          genre: entry.genre ?? undefined,
          coverUrl: entry.coverUrl ?? undefined,
          textLanguage: entry.language ?? "pt",
          source: "catalog",
          catalogKey: entry.bookKey,
        };
      }
      const id = entry.bookKey.slice(entry.bookKey.indexOf(":") + 1);
      return {
        id: entry.bookKey.replace(":", "-"),
        gutenbergId: Number(id) || 0,
        title: entry.title,
        author: entry.author ?? "",
        genre: entry.genre ?? undefined,
        coverUrl: entry.coverUrl ?? undefined,
        textLanguage: entry.language ?? "pt",
        source: entry.source,
      };
    },
    [localBookList, communityBooks],
  );
  /** Nota/resenha do livro terminado: abre quando a comemoração some (toque ou timer). */
  const finishPrompt = useFinishPrompt(celebration !== null);
  const queueFinishPrompt = finishPrompt.queue;
  /** Capas do acervo iguais às de "Seus livros" (envios antigos ficaram com a da Open Library). */
  useEffect(() => {
    const session = authSessionRef.current;
    if (!authEnabled || !session) return;
    let alive = true;
    void listLocalBooks()
      .then((local) => (local.length > 0 ? syncSubmissionCovers(session, local) : 0))
      .then((changed) => alive && changed > 0 && setCommunityTick((n) => n + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authUserId]);
  /** Livro que acabou de sair de "Continue lendo" (dá para desfazer por alguns segundos). */
  const [continueUndo, setContinueUndo] = useState<ReadingProgress | null>(null);
  useEffect(() => {
    if (!continueUndo) return;
    const t = window.setTimeout(() => setContinueUndo(null), 7000);
    return () => window.clearTimeout(t);
  }, [continueUndo]);
  const [importRequest, setImportRequest] = useState<BookHint | Record<string, never> | null>(null);
  const { install, installed } = useAppInstall();
  /** Janela "Baixar app" (passo a passo quando o navegador não tem o botão de instalar). */
  const [installOpen, setInstallOpen] = useState(false);
  const [installBannerOff, setInstallBannerOff] = useState(installBannerHidden);
  /** U6: o convite espera a pessoa abrir um livro ou voltar outro dia (conta esta visita uma vez). */
  const [installNudgeOn, setInstallNudgeOn] = useState(() => {
    noteVisit();
    return installNudgeReady();
  });
  const installBannerShown = !installed && !installBannerOff && installNudgeOn;
  const updateReady = useUpdateReady();
  const updateBanner = updateReady ? (
    <div className="update-banner" role="status">
      <span>✨ Nova versão do Storyverse disponível.</span>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        Atualizar
      </button>
    </div>
  ) : null;
  /** Dados para a notificação diária do Android (o service worker não lê o localStorage). */
  useEffect(() => {
    if (book) return;
    const recent = recentProgress().find((p) => isAvailable(p.book));
    // O recado sai na voz do personagem; quem decide se já é hora de avisar é o service worker.
    const voice = recent ? voiceFor(recent.book) : undefined;
    void syncEngagementState({
      streak: readingSummary().streak,
      lastReadDay: lastReadDay(),
      book: recent
        ? {
            title: recent.book.title,
            chapterLabel: recent.chapterLabel,
            character: voice?.name ?? lastCharacter(recent.book.id),
            nudge: voice ? nudgeText(recent.book, voice, recent.chapterLabel, NUDGE_AFTER_DAYS) : undefined,
          }
        : undefined,
    });
  }, [book, isAvailable]);
  useEffect(() => {
    try {
      userStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preferência só não fica salva.
    }
  }, [prefs]);

  const readRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  /**
   * Capítulo a que a rolagem medida pertence. Fica vazio ao trocar de capítulo até o novo ser
   * posicionado: antes disso a rolagem ainda é a do capítulo anterior (e, terminado o 2, o 3
   * seria dado como concluído).
   */
  const ratioKeyRef = useRef<string | null>(null);
  /** Rolagem salva a reaplicar quando o capítulo onde o leitor parou for desenhado. */
  const restoreScrollRef = useRef<number | null>(null);
  /** Livro + capítulo na tela: resultados de tradução de outro capítulo são descartados. */
  const chapterKey = book ? `${book.gutenbergId}:${chapterIndex}` : "";
  const chapterKeyRef = useRef(chapterKey);
  chapterKeyRef.current = chapterKey;
  /** Trecho de tradução no topo da tela, medido junto com a rolagem. */
  const [visibleChunk, setVisibleChunk] = useState<{ key: string; chunk: number } | null>(null);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;

    setLoadState("loading");
    setLoadError(null);
    setFullText("");
    setChapterIndex(0);
    setScrollRatio(0);

    (isLocalBook(book)
      ? loadLocalBookText(book.gutenbergId)
      : book.source === "community" && (book.communityPath || communityIdOf(book))
        ? // A chave pelo caminho preserva as cópias offline gravadas antes do S9.
          withOfflineCopy(`community:${book.communityPath ?? communityIdOf(book)}`, () =>
            fetchCommunityBookText(authSessionRef.current, book),
          )
        : book.source === "catalog" && book.catalogKey
          ? withOfflineCopy(`catalog:${book.catalogKey}`, () =>
              fetchCatalogBookText(authSessionRef.current, book.catalogKey!),
            )
          : fetchBookText(book.gutenbergId))
      .then((text) => {
        if (cancelled) return;
        const saved = loadProgress(book.gutenbergId);
        const labels = splitIntoChapters(text).map((c) => c.label);
        // Procura pelo nome do capítulo: se a divisão em capítulos mudar numa versão nova do app,
        // o número salvo pode apontar para outro capítulo.
        const savedIndex = !saved
          ? -1
          : labels[saved.chapterIndex] === saved.chapterLabel
            ? saved.chapterIndex
            : labels.indexOf(saved.chapterLabel);
        const openAt = openAtRef.current?.bookId === book.id ? openAtRef.current : null;
        openAtRef.current = null;
        const openAtIndex = !openAt
          ? -1
          : labels[openAt.chapterIndex] === openAt.chapterLabel
            ? openAt.chapterIndex
            : labels.indexOf(openAt.chapterLabel);
        if (openAt && openAtIndex >= 0) {
          setChapterIndex(openAtIndex);
          jumpToBlockRef.current = openAt.paragraph;
        } else if (saved && savedIndex >= 0) {
          setChapterIndex(savedIndex);
          restoreScrollRef.current = saved.scrollRatio;
        }
        setFullText(text);
        setLoadState("ready");
        // Voltou depois de dias sem abrir este livro: o personagem manda uma mensagem de saudade.
        const awayDays = saved ? Math.floor((Date.now() - saved.updatedAt) / 86_400_000) : 0;
        const awayChapter = saved?.chapterLabel;
        return loadCast(book, text.slice(0, 3000)).then((list) => {
          if (cancelled) return;
          setCast(list);
          startConversation(book, list, { days: awayDays, chapter: awayChapter });
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar o livro.");
      });

    return () => {
      cancelled = true;
    };
  }, [book, loadAttempt, startConversation]);

  const onReadScroll = useCallback(() => {
    const el = readRef.current;
    if (!el) return;
    lastActivityRef.current = Date.now();
    setSelection(null);
    setWordCard(null);
    // Páginas lidas: conta o que está na tela quando a rolagem para por 1 s.
    window.clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = window.setTimeout(() => countVisibleWordsRef.current(), 1000);
    const max = el.scrollHeight - el.clientHeight;
    const r = max <= 0 ? 0 : el.scrollTop / max;
    setScrollRatio(r);

    // Busca binária pelo primeiro parágrafo visível (estão em ordem na página).
    const els = el.querySelectorAll<HTMLElement>("[data-chunk]");
    if (els.length === 0) return;
    const top = el.getBoundingClientRect().top;
    let lo = 0;
    let hi = els.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (els[mid].getBoundingClientRect().bottom > top) hi = mid;
      else lo = mid + 1;
    }
    const chunk = Number(els[lo].dataset.chunk);
    const key = chapterKeyRef.current;
    setVisibleChunk((v) => (v?.key === key && v.chunk === chunk ? v : { key, chunk }));
  }, []);

  /** Abre o livro; `opts` abre direto a conversa com um personagem (ex.: responder o recado dele). */
  const startBook = useCallback((b: Ebook, opts?: { characterId?: string; chat?: boolean }) => {
    if (authLoading) return;
    if (!canRead) {
      setAuthModal("login");
      return;
    }
    // O texto do catálogo exige sessão mesmo quando o login é opcional para o resto do app.
    if (b.source === "catalog" && !authUser) {
      setAuthModal("login");
      return;
    }
    recordOpened(b);
    noteBookOpened();
    setInstallNudgeOn(true);
    readerGeneration.current++;
    openBookWithTransition(() => {
      setBook(b);
      setCast(null);
      resetChat({ characterId: opts?.characterId, open: opts?.chat });
      window.scrollTo({ top: 0 });
    });
  }, [authLoading, authUser, canRead, resetChat]);

  /**
   * Link direto para um livro da biblioteca (`/?abrir=cat:<uuid>`). Se a pessoa ainda não entrou,
   * abre o login e tenta de novo quando a sessão chegar; o parâmetro fica na URL até abrir.
   */
  const openedFromUrlRef = useRef(false);
  useEffect(() => {
    if (openedFromUrlRef.current || authLoading) return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get("abrir");
    if (!key || !/^cat:[0-9a-fA-F-]{36}$/.test(key)) return;
    if (!canRead || !authUser) {
      setAuthModal("login");
      return;
    }
    openedFromUrlRef.current = true;
    const chat = params.get("chat") === "1";
    getCatalogBook(key)
      .then((loaded) => {
        window.history.replaceState({}, "", window.location.pathname);
        startBook(catalogBookToEbook(loaded));
        if (chat) setChatOpen(true);
      })
      .catch((err: unknown) => {
        openedFromUrlRef.current = false;
        setAuthNotice({
          text: err instanceof Error ? err.message : "Não foi possível abrir o livro.",
        });
      });
  }, [authLoading, authUser, canRead, startBook, setChatOpen]);

  /**
   * Recarregou com o livro aberto (`?ler=`): abre o mesmo livro quando a conta estiver pronta.
   * Lido no primeiro desenho, antes de o efeito abaixo apagar a cópia guardada do livro.
   */
  const [reopen, setReopen] = useState(takeReaderParam);
  useEffect(() => rememberOpenBook(book), [book]);
  useEffect(() => {
    if (!reopen || authLoading || !dataIsReady) return;
    setReopen(null);
    if (!canRead) return;
    const found =
      reopen.book ??
      recentProgress().find((p) => p.book.id === reopen.id)?.book ??
      [...featuredBooks, ...communityBooks].find((b) => b.id === reopen.id);
    if (found) startBook(found);
  }, [reopen, authLoading, dataIsReady, canRead, communityBooks, startBook]);

  const requestImport = useCallback(
    (hint: BookHint | Record<string, never> = {}) => {
      if (authLoading) return;
      if (!canRead) {
        setAuthModal("login");
        return;
      }
      setImportRequest(hint);
    },
    [authLoading, canRead],
  );

  const goToHomeSection = useCallback(
    (sectionId: string) => {
      if (authLoading) return;
      if (!canRead) {
        setAuthModal("login");
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [authLoading, canRead],
  );

  const toggleReadingFullscreen = useCallback(async () => {
    setReaderSettingsOpen(false);
    if (immersive) {
      setImmersive(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setImmersive(true);
      }
    } catch {
      // iOS/Safari pode negar a Fullscreen API; usa o modo imersivo.
      setImmersive(true);
    }
  }, [immersive]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  /** Marcações do livro aberto. */
  useEffect(() => {
    setHighlights(book ? loadHighlights(book.id) : []);
  }, [book]);

  /** Ilustrações de livro importado (guardadas no aparelho): endereços para as <img>. */
  const [bookImages, setBookImages] = useState<Record<string, string>>({});
  useEffect(() => {
    setBookImages({});
    if (!book || !isLocalBook(book)) return;
    let revoke: (() => void) | null = null;
    let alive = true;
    void loadLocalBookImages(book.gutenbergId).then((r) => {
      if (!alive) return r.revoke();
      revoke = r.revoke;
      setBookImages(r.urls);
    });
    return () => {
      alive = false;
      revoke?.();
    };
  }, [book]);

  /** Avisa da sequência de dias e da meta do dia batidas durante a leitura. */
  const celebrate = useCallback(
    (ev: ReadingEvents) => {
      noticeAchievements();
      if (ev.dayCompleted) {
        const n = ev.streak;
        const milestone = [3, 7, 14, 30, 50, 100, 365].includes(n);
        setCelebration({
          emoji: "🔥",
          title: n === 1 ? "Sequência começou!" : `${n} dias seguidos!`,
          roll: n > 1 ? { from: n - 1, to: n, suffix: "dias seguidos!" } : undefined,
          text: ev.shieldEarned
            ? "Você ganhou um escudo 🛡️: se um dia passar sem leitura, ele salva a sua sequência."
            : milestone
              ? "Que marca! Os personagens estão orgulhosos."
              : n === 1
                ? "Volte amanhã para manter o fogo aceso."
                : "Continue assim — volte amanhã para manter a sequência.",
        });
      } else if (ev.goalReached) {
        // Sem janela por cima do texto: a barra do topo brilha e um aviso pequeno some sozinho.
        haptic([20, 40, 20]);
        setGoalFlash(Date.now());
      }
    },
    [noticeAchievements],
  );

  // Conquista nova ao conversar, marcar um trecho ou ao abrir o app com os dados prontos.
  useEffect(() => {
    if (dataIsReady) noticeAchievements();
  }, [dataIsReady, chat.threads, highlights, noticeAchievements]);

  const chapters = useMemo(() => (fullText ? splitIntoChapters(fullText) : []), [fullText]);
  const currentChapter = chapters[chapterIndex] ?? chapters[0];
  /** Livro aberto e já carregado: ao sair, a fita do marcador lembra que o ponto ficou guardado. */
  const leavingTitleRef = useRef<string | null>(null);
  leavingTitleRef.current = book && loadState === "ready" ? book.title : null;

  useEffect(() => {
    ratioKeyRef.current = null;
    setScrollRatio(0);
  }, [chapterIndex]);

  /** Capítulo novo começa do topo; ao reabrir o livro, volta para onde o leitor parou. */
  useEffect(() => {
    if (loadState !== "ready") return;
    const frame = requestAnimationFrame(() => {
      const el = readRef.current;
      const ratio = restoreScrollRef.current;
      restoreScrollRef.current = null;
      const jump = jumpToBlockRef.current;
      jumpToBlockRef.current = null;
      if (!el) return;
      if (jump !== null) scrollToBlock(jump);
      else el.scrollTop = ratio ? ratio * (el.scrollHeight - el.clientHeight) : 0;
      ratioKeyRef.current = chapterKeyRef.current;
      onReadScroll();
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterIndex, loadState, onReadScroll]);

  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter) return;
    if (restoreScrollRef.current !== null) return; // Ainda não voltou para a posição salva.
    // Abrir e fechar um livro sem ler nada não o coloca em “Continue lendo”.
    if (chapterIndex === 0 && scrollRatio < 0.02 && !loadProgress(book.gutenbergId)) return;
    const owner = currentDataOwner();
    const t = setTimeout(() => {
      saveProgress(
        {
          book,
          chapterIndex,
          chapterLabel: currentChapter.label,
          chapterCount: chapters.length,
          scrollRatio,
        },
        owner,
      );
      if (owner === currentDataOwner()) {
        recordProgress(book, ((chapterIndex + scrollRatio) / Math.max(1, chapters.length)) * 100, currentChapter.label);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [book, loadState, chapterIndex, currentChapter, chapters.length, scrollRatio]);

  /** Chegou ao fim do capítulo: aviso rápido; no último capítulo, comemoração de livro terminado. */
  useEffect(() => {
    if (!book || loadState !== "ready" || !currentChapter || scrollRatio < 0.97) return;
    const key = `${book.gutenbergId}:${chapterIndex}`;
    if (ratioKeyRef.current !== key) return; // Rolagem ainda é a do capítulo anterior.
    if (finishedChaptersRef.current.has(key)) return;
    // Capítulo curtíssimo cabe na tela inteira: ainda não foi "lido".
    const el = readRef.current;
    if (!el || el.scrollHeight < el.clientHeight * 1.5) return;
    finishedChaptersRef.current.add(key);
    if (chapterIndex >= chapters.length - 1) {
      markBookFinished(book);
      recordFinished(book);
      if (shelfEnabled()) queueFinishPrompt(book);
      setCelebration({
        emoji: "🏆",
        title: `Você terminou “${book.title}”!`,
        text: "Que jornada. Conte para os personagens o que achou do final.",
        book,
      });
    } else {
      setChapterDone({ key, label: currentChapter.label, done: chapterIndex + 1, total: chapters.length });
      haptic(20);
    }
  }, [book, loadState, currentChapter, scrollRatio, chapterIndex, chapters.length, queueFinishPrompt]);

  const displayedStory = currentChapter?.body ?? "";

  /** Buscar no livro: palavra ou nome em todos os capítulos, com o trecho e o salto até lá. */
  const search = useBookSearch({ chapters, chapterIndex, setChapterIndex, jumpToBlockRef, scrollToBlock });

  /** Rola até um parágrafo do capítulo aberto e o destaca por um instante. */
  function scrollToBlock(i: number) {
    const target = readRef.current?.querySelector<HTMLElement>(`[data-block="${i}"]`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.classList.add("flash");
    window.setTimeout(() => target.classList.remove("flash"), 1800);
  }

  const blocks = useMemo(
    () => toBlocks(displayedStory, currentChapter?.label),
    [displayedStory, currentChapter],
  );
  const dropCapIndex = useMemo(
    () => blocks.findIndex((b) => b.kind === "p" && b.text.length > 80),
    [blocks],
  );

  /**
   * Páginas lidas (1 página = 250 palavras; a regra completa está em readingPages.ts): soma os
   * parágrafos que estão pelo menos pela metade na tela, ou que ocupam metade dela.
   */
  useEffect(() => {
    countVisibleWordsRef.current = () => {
      const el = readRef.current;
      if (!el || !book || loadState !== "ready" || document.visibilityState !== "visible") return;
      // Capítulo ainda não posicionado: a tela ainda é a do anterior.
      if (ratioKeyRef.current !== `${book.gutenbergId}:${chapterIndex}`) return;
      const view = el.getBoundingClientRect();
      const seen: SeenBlock[] = [];
      for (const node of el.querySelectorAll<HTMLElement>("[data-block]")) {
        const r = node.getBoundingClientRect();
        const shown = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
        if (shown <= 0 || (shown < r.height / 2 && shown < view.height / 2)) continue;
        const i = Number(node.dataset.block);
        const b = blocks[i];
        if (b && b.kind !== "image") seen.push({ key: `${book.gutenbergId}:${chapterIndex}:${i}`, words: countWords(b.text) });
      }
      addSeenBlocks(seen);
    };
  }, [book, loadState, chapterIndex, blocks]);
  useEffect(() => () => window.clearTimeout(scrollIdleRef.current), []);

  /* ---- Tradução dos livros em inglês: trecho a trecho, conforme o leitor avança. ---- */
  const translation = useBookTranslation({
    book,
    blocks,
    chapterIndex,
    chapterKey,
    chapterKeyRef,
    loaded: loadState === "ready",
    visibleChunk,
    prefs,
    setPrefs,
  });
  const { engine, translateOn, blockLanguage } = translation;

  /* ---- Leitura em voz alta ---- */
  const voice = useReadAloud({
    book,
    loaded: loadState === "ready",
    blocks,
    chunks: translation.chunks,
    translatedChunks: translation.translatedChunks,
    translateOn,
    shownTexts: translation.shownTexts,
    chapterIndex,
    chapterCount: chapters.length,
    setChapterIndex,
    readRef,
    lastActivityRef,
  });
  const { stopSpeaking, isSpeaking } = voice;

  /** Tempo de leitura (para a sequência de dias e a meta): conta de 15 em 15 s com o leitor ativo. */
  useEffect(() => {
    if (!book || loadState !== "ready") return;
    const TICK = 15;
    const session = authSessionRef.current;
    if (session) void readingHeartbeat(session, true).catch(() => {});
    const t = window.setInterval(() => {
      const active = Date.now() - lastActivityRef.current < 120_000 || isSpeaking();
      const reading = document.visibilityState === "visible" && active;
      if (reading) {
        celebrate(addReadingSeconds(TICK));
        countVisibleWordsRef.current();
      }
      if (session && authSessionRef.current?.user.id === session.user.id)
        void readingHeartbeat(authSessionRef.current, reading).catch(() => {});
    }, TICK * 1000);
    return () => {
      window.clearInterval(t);
      if (session) void readingHeartbeat(session, false).catch(() => {});
    };
  }, [book, loadState, celebrate, isSpeaking]);

  const leaveBook = useCallback(() => {
    readerGeneration.current++;
    if (leavingTitleRef.current) setBookmarkDrop({ id: Date.now(), label: leavingTitleRef.current });
    stopSpeaking();
    setHighlightsOpen(false);
    setReaderSettingsOpen(false);
    setImmersive(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setSelection(null);
    setWordCard(null);
    setBook(null);
    setCast(null);
    resetChat();
    setFullText("");
    setChapterIndex(0);
    setLoadState("idle");
    setLoadError(null);
  }, [stopSpeaking, resetChat]);

  /* ---- Seleção de texto: marcar, significado, compartilhar ---- */

  /** Lê a seleção atual no texto do livro (pode atravessar vários parágrafos). */
  function readSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setSelection(null);
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const prose = (common instanceof Element ? common : common.parentElement)?.closest(".prose");
    if (!prose) return setSelection(null);

    // Um pedaço por parágrafo tocado pela seleção (cada um é marcado no seu parágrafo).
    const parts: { block: number; text: string }[] = [];
    for (const el of Array.from(prose.querySelectorAll<HTMLElement>("p[data-block], h2[data-block]"))) {
      if (!range.intersectsNode(el)) continue;
      const piece = document.createRange();
      piece.selectNodeContents(el);
      if (el.contains(range.startContainer)) piece.setStart(range.startContainer, range.startOffset);
      if (el.contains(range.endContainer)) piece.setEnd(range.endContainer, range.endOffset);
      const text = piece.toString().replace(/\s+/g, " ").trim();
      if (text) parts.push({ block: Number(el.dataset.block), text });
      if (parts.length >= 12) break;
    }
    if (parts.length === 0) return setSelection(null);

    const text = parts.map((p) => p.text).join(" ");
    const rect = range.getBoundingClientRect();
    setSelection({
      text,
      parts,
      block: parts[0].block,
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
      word: parts.length === 1 && !/\s/.test(text) ? normalizeWord(text) : null,
    });
    setWordCard(null);
  }

  /** No celular, arrastar as alças da seleção não dispara toque: acompanha pela própria seleção. */
  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      timer = window.setTimeout(readSelection, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
    // readSelection só usa setters (estáveis) e o DOM.
  }, []);

  function handleSelection() {
    window.setTimeout(readSelection, 10);
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  function addHighlight() {
    if (!book || !selection || !currentChapter) return;
    // Trecho que atravessa parágrafos: um pedaço por parágrafo, todos do mesmo grupo.
    const group = uid();
    const createdAt = Date.now();
    const pieces: Highlight[] = selection.parts.map((p) => ({
      id: uid(),
      group,
      chapterIndex,
      chapterLabel: currentChapter.label,
      paragraph: p.block,
      text: p.text.slice(0, MAX_HIGHLIGHT_CHARS),
      createdAt,
    }));
    const next = [...highlights, ...pieces];
    setHighlights(next);
    saveHighlights(book.id, next);
    clearSelection();
    setToast("Trecho marcado");
  }

  /** Remove a marcação inteira (todos os pedaços do mesmo trecho). */
  function removeHighlight(h: Highlight) {
    if (!book) return;
    const next = highlights.filter((x) => (h.group ? x.group !== h.group : x.id !== h.id));
    setHighlights(next);
    saveHighlights(book.id, next);
  }

  /** Marcações agrupadas por trecho, na ordem do livro (para o painel). */
  const highlightGroups = useMemo(() => {
    const groups = new Map<string, { first: Highlight; text: string }>();
    for (const h of [...highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.paragraph - b.paragraph)) {
      const key = h.group ?? h.id;
      const g = groups.get(key);
      if (g) g.text = `${g.text} ${h.text}`;
      else groups.set(key, { first: h, text: h.text });
    }
    return [...groups.values()];
  }, [highlights]);

  function openHighlight(h: Highlight) {
    setHighlightsOpen(false);
    if (h.chapterIndex === chapterIndex) {
      requestAnimationFrame(() => scrollToBlock(h.paragraph));
    } else {
      jumpToBlockRef.current = h.paragraph;
      setChapterIndex(h.chapterIndex);
    }
  }

  function showMeaning() {
    if (!selection?.word) return;
    const word = selection.word;
    const lang = blockLanguage(selection.block);
    setWordCard({ word, x: selection.x, y: selection.bottom, info: null });
    clearSelection();
    void lookupWord(word, lang, engine).then((info) =>
      setWordCard((c) => (c && c.word === word ? { ...c, info } : c)),
    );
  }

  const [sharing, setSharing] = useState(false);
  async function shareCard(input: Omit<ShareCardInput, "bookTitle" | "bookAuthor" | "coverUrl">) {
    if (!book || sharing) return;
    setSharing(true);
    try {
      const blob = await renderShareCard({
        ...input,
        bookTitle: book.title,
        bookAuthor: book.author,
        coverUrl: book.coverUrl,
      });
      const slug = book.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const result = await shareOrDownload(blob, `storyverse-${slug || "livro"}.png`, `${book.title} no Storyverse`);
      if (result === "downloaded") setToast("Imagem salva — é só postar!");
    } catch (e) {
      console.warn("Falha ao gerar o card:", e);
      setToast("Não foi possível gerar a imagem.");
    } finally {
      setSharing(false);
    }
  }

  function shareMessage(m: Msg) {
    const { character, messages } = chat;
    if (!character) return;
    const idx = messages.findIndex((x) => x.id === m.id);
    const question = [...messages.slice(0, idx)].reverse().find((x) => x.role === "user")?.text;
    void shareCard({
      kind: "chat",
      text: m.text,
      characterName: character.name,
      characterRole: character.role,
      characterColor: character.color,
      question,
    });
  }

  function shareQuote(text: string, chapterLabel?: string) {
    void shareCard({ kind: "quote", text, chapterLabel });
  }

  /** Posição aproximada no livro inteiro (capítulos anteriores + rolagem no atual). */
  const readingProgressPct =
    chapters.length > 0 ? ((chapterIndex + scrollRatio) / chapters.length) * 100 : 0;
  const textExcerpt = useMemo(
    () => excerptNearScrollRatio(withoutImageMarkers(displayedStory), scrollRatio, 2000),
    [displayedStory, scrollRatio],
  );

  /** Lido pelo chat na hora do envio. */
  function chatSendContext(): ChatSendContext {
    return { ready: loadState === "ready" && Boolean(displayedStory), textExcerpt, readingProgressPct };
  }

  /** Início de um pedido ao personagem: a resposta só vale para o mesmo livro e a mesma conta. */
  function beginChatRequest() {
    const requestBook = book;
    const requestOwner = authSessionRef.current?.user.id;
    const generation = readerGeneration.current;
    return () =>
      readerGeneration.current === generation &&
      currentBookRef.current === requestBook &&
      authSessionRef.current?.user.id === requestOwner;
  }

  // Botão voltar do celular: fecha o que estiver aberto por cima, na ordem em que foi aberto.
  useBackClose(Boolean(book), leaveBook, book ? readerUrl(book.id) : undefined);
  useBackClose(profileOpen, () => setProfileOpen(false));
  useBackClose(rankingOpen, () => setRankingOpen(false));
  useBackClose(libraryOpen, () => setLibraryOpen(false));
  useBackClose(shopOpen, () => setShopOpen(false));
  useBackClose(spinOpen, () => setSpinOpen(false));
  useBackClose(authModal !== null, () => setAuthModal(null));
  useBackClose(aboutOpen, () => setAboutOpen(false));
  useBackClose(installOpen, () => setInstallOpen(false));
  useBackClose(importRequest !== null, () => setImportRequest(null));
  useBackClose(chat.chatOpen, () => setChatOpen(false));
  useBackClose(highlightsOpen, () => setHighlightsOpen(false));

  if (ownerError) return <main className="auth-loading" role="alert"><p>{ownerError}</p><button onClick={() => window.location.reload()}>Tentar novamente</button></main>;
  if (authLoading || !dataIsReady) {
    return (
      <main className="auth-loading" role="status" aria-live="polite">
        <img className="auth-loading-logo" src="/icons/logo.svg" alt="" aria-hidden="true" />
        <span className="spinner" aria-hidden="true" />
        <p>Abrindo o Storyverse…</p>
      </main>
    );
  }

  if (billingBlocked && subscription) {
    return <BillingBlocked status={subscription} onLogout={() => void logout()} />;
  }

  if (!book) {
    // Cópia do livro guardada no progresso pode estar velha (sem a capa achada depois): usa a
    // versão atual quando o livro é do acervo fixo ou da comunidade.
    const currentBook = new Map<string, Ebook>([...featuredBooks, ...communityBooks].map((b) => [b.id, b]));
    // Só livros que ainda dá para abrir: removido de "Seus livros" ou tirado do acervo sai daqui.
    const recent = recentProgress().filter((p) => isAvailable(p.book)).map((p) => {
      const now = currentBook.get(p.book.id);
      return now && now.coverUrl !== p.book.coverUrl ? { ...p, book: { ...p.book, coverUrl: now.coverUrl } } : p;
    });
    const summary = readingSummary();
    const lastBook = recent[0]
      ? {
          title: recent[0].book.title,
          chapterLabel: recent[0].chapterLabel,
          character: lastCharacter(recent[0].book.id),
        }
      : undefined;
    // Sumiu do livro há alguns dias: o personagem manda um recado (ver characterNudge.ts).
    const nudge = homeNudge(recent);
    const progressById = new Map(recent.map((p) => [p.book.gutenbergId, p]));
    if (shopOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <DiamondShopPage
            session={authSession}
            onClose={() => setShopOpen(false)}
            onStreakSaved={() => {
              setFreezeOutcome(null);
              setDataEpoch((n) => n + 1);
            }}
          />
        </Suspense>
      );
    }
    if (libraryOpen && authSession && shelfOn) {
      return (
        <LibraryPage
          onClose={() => setLibraryOpen(false)}
          onOpenBook={(b) => {
            setLibraryOpen(false);
            setProfileOpen(false);
            startBook(b);
          }}
          available={shelfAvailable}
          bookFor={shelfBookFor}
        />
      );
    }
    if (rankingOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <RankingPage session={authSession} onClose={() => setRankingOpen(false)} onOpenShop={() => setShopOpen(true)} />
        </Suspense>
      );
    }
    if (profileOpen && authSession) {
      return (
        <Suspense fallback={<RouteLoading />}>
          <ProfilePage
            isStaff={staffOn}
            canModerate={canModerate}
            onOpenShop={() => setShopOpen(true)}
            onOpenShelf={shelfOn ? () => setLibraryOpen(true) : undefined}
            session={authSession}
            onSessionChange={setAuthSession}
            onClose={() => setProfileOpen(false)}
            onLogout={() => void logout()}
            onAccountDeleted={() => {
              const owner = authSession?.user.id;
              if (owner) {
                clearAccountStorage(owner);
                void deleteAllLocalRecords(owner).catch(() => {});
              }
              if (authSession) void signOut(authSession).catch(() => {});
              setAuthSession(null);
              setProfileOpen(false);
              setAuthNotice({ text: "Conta excluída.", ok: true });
            }}
            loggingOut={authActionLoading}
            onOpenBook={startBook}
            onOpenHighlight={(b, h) => {
              openAtRef.current = { bookId: b.id, chapterIndex: h.chapterIndex, chapterLabel: h.chapterLabel, paragraph: h.paragraph };
              startBook(b);
            }}
            prefs={prefs}
            setPrefs={setPrefs}
            lastBook={lastBook}
            isAvailable={isAvailable}
          />
        </Suspense>
      );
    }
    const heroBook = featuredBooks.find((b) => b.demo && b.characters?.length);
    const heroChar = heroBook?.characters?.[0];
    /** Já entrou e pode ler: sem a apresentação do app, direto para os livros. */
    const returning = Boolean(authUser) && canRead;
    return (
      <div className={`home ${returning ? "is-returning" : ""}`} key={dataEpoch} ref={homeRef}>
        {authModal ? (
          <Suspense fallback={null}>
            <AuthModal
              mode={authModal}
              onClose={() => setAuthModal(null)}
              onAuthenticated={(session) => {
                setAuthSession(session);
                setAuthNotice(null);
                setSanctionNotice(session.warning ? warningMessage(session.warning.reason) : null);
                setAuthModal(null);
              }}
            />
          </Suspense>
        ) : null}
        {resetToken ? (
          <Suspense fallback={null}>
            <NewPasswordModal
              token={resetToken}
              onDone={(message) => {
                setResetToken(null);
                setAuthNotice({ text: message, ok: true });
                if (!authSession) setAuthModal("login");
              }}
              onCancel={() => {
                setResetToken(null);
                setAuthNotice(null);
                setAuthModal("login");
              }}
            />
          </Suspense>
        ) : passwordReset && authSession ? (
          <Suspense fallback={null}>
            <NewPasswordModal
              session={authSession}
              onDone={(message) => {
                setPasswordReset(false);
                setAuthNotice({ text: message, ok: true });
              }}
              onCancel={() => setPasswordReset(false)}
            />
          </Suspense>
        ) : null}
        <nav ref={navRef} className={`home-nav home-nav-main ${navScrolled ? "is-scrolled" : ""} ${navFit !== "full" ? "is-crowded" : "is-crowded"}`}>
          <span className="wordmark">
            <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
            <span className="wordmark-text">Storyverse</span>
          </span>
          <div className="home-nav-actions">
            {authUser && onlineCount !== null && onlineCount > 0 ? (
              <span className="online-pill" title="Pessoas com o Storyverse aberto agora" role="status">
                <span className="online-dot" aria-hidden="true" />
                <strong>{onlineCount}</strong>
                <span className="online-label">{onlineCount === 1 ? "online" : "online agora"}</span>
              </span>
            ) : null}
            <div className="nav-secondary">
            {!installed ? (
              <button
                type="button"
                className={`btn nav-install ${installBannerShown ? "has-banner" : ""}`}
                onClick={() => setInstallOpen(true)}
                aria-label="Baixar app"
                title="Baixar app"
              >
                {Icon.download}
                <span className="nav-install-label">Baixar app</span>
              </button>
            ) : null}
            <Link className="btn nav-library" to="/biblioteca" aria-label="Abrir a biblioteca pública">
              <span className="nav-library-long">Biblioteca</span>
              <span className="nav-library-short">Livros</span>
            </Link>
            <Link className="btn nav-audio" to="/ouvir" aria-label="Abrir os audiolivros">
              <span className="nav-audio-long">Audiolivros</span>
              <span className="nav-audio-short">Áudio</span>
            </Link>
            {staffOn ? (
              <Link className="btn nav-admin" to="/admin" aria-label="Abrir painel administrativo">
                Admin
              </Link>
            ) : null}
            {canRead ? (
              <button
                type="button"
                className="btn nav-import"
                onClick={() => requestImport()}
                aria-label="Importar livro"
              >
                {Icon.upload}
                <span className="nav-import-long">Importar livro</span>
                <span className="nav-import-short">Importar</span>
              </button>
            ) : null}
            </div>
            {groupsOn ? (
              <Link
                className="btn nav-groups"
                to="/grupos"
                onMouseEnter={prefetchCommunityRoutes}
                onFocus={prefetchCommunityRoutes}
                aria-label={groupsUnread > 0 ? `Abrir os grupos, ${groupsUnread} mensagens não lidas` : "Abrir os grupos"}
              >
                {Icon.chat}
                <span className="nav-groups-label">Grupos</span>
                {groupsUnread > 0 ? (
                  <span className="nav-groups-badge" aria-hidden="true" key={groupsUnread}>
                    {groupsUnread > 99 ? "99+" : groupsUnread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {groupsOn && authUser ? <NotificationBell groups={groupsActivity.groups} activity={groupsActivity.activity} /> : null}
            <NavMore
              items={[
                ...(!installed ? [{ key: "install", label: "Baixar app", icon: Icon.download, onClick: () => setInstallOpen(true) }] : []),
                { key: "library", label: "Biblioteca", icon: Icon.book, to: "/biblioteca" },
                { key: "audio", label: "Audiolivros", icon: Icon.speaker, to: "/ouvir" },
                ...(groupsOn && authUser ? [{ key: "people", label: "Pessoas", icon: Icon.chat, to: "/pessoas" }] : []),
                ...(canRead ? [{ key: "import", label: "Importar livro", icon: Icon.upload, onClick: () => requestImport() }] : []),
                ...(staffOn ? [{ key: "admin", label: "Painel admin", icon: Icon.settings, to: "/admin" }] : []),
                ...(authUser ? [{ key: "logout", label: "Sair da conta", icon: Icon.logout, onClick: () => void askLogout() }] : []),
              ] satisfies NavMoreItem[]}
            />
            {!authEnabled ? null : authUser ? (
              <button type="button" className="btn nav-account" onClick={() => setProfileOpen(true)} aria-label="Abrir seu perfil" title="Abrir seu perfil">
                <UserAvatar user={authUser} className="nav-avatar" />
                <span className="nav-account-name">{displayNameOf(authUser).split(" ")[0]}</span>
              </button>
            ) : (
              <>
                <button type="button" className="btn nav-login" onClick={() => setAuthModal("login")}>Login</button>
                <button type="button" className="btn btn-primary nav-register" onClick={() => setAuthModal("register")}>Criar conta</button>
              </>
            )}
          </div>
        </nav>

        {authNotice ? (
          <p className={`auth-global-notice ${authNotice.ok ? "is-ok" : ""}`} role={authNotice.ok ? "status" : "alert"}>
            {authNotice.text}
          </p>
        ) : null}

        {sanctionNotice ? (
          <div className="auth-global-notice auth-sanction-notice" role="status">
            <span>{sanctionNotice}</span>
            <button type="button" className="btn" onClick={() => setSanctionNotice(null)}>
              Fechar
            </button>
          </div>
        ) : null}

        {appConfirmDialog}
        {aboutOpen ? (
          <Suspense fallback={null}>
            <AboutDialog onClose={() => setAboutOpen(false)} />
          </Suspense>
        ) : null}
        {spinOpen && authSession ? (
          <Suspense fallback={null}>
            <DailySpinModal
              session={authSession}
              onClose={() => setSpinOpen(false)}
              onWon={(r) => r.is_new && setToast(`+${r.prize} 💎 na roleta`)}
            />
          </Suspense>
        ) : null}

        {installOpen ? (
          <Suspense fallback={null}>
            <InstallAppDialog install={install} onClose={() => setInstallOpen(false)} />
          </Suspense>
        ) : null}

        {installBannerShown ? (
          // No celular o convite fica aqui, fora do topo (lá não cabe junto com "Importar livro").
          <div className="install-banner">
            <span>Baixe o app do Storyverse: abre em tela cheia e funciona sem internet.</span>
            <button type="button" className="btn btn-primary" onClick={() => setInstallOpen(true)}>
              Baixar
            </button>
            <button
              type="button"
              className="icon-btn install-banner-close"
              onClick={() => {
                hideInstallBanner();
                setInstallBannerOff(true);
              }}
              aria-label="Fechar convite"
            >
              {Icon.close}
            </button>
          </div>
        ) : null}

        {freezeOutcome && authSession ? (
          <FreezeNudge
            outcome={freezeOutcome}
            busy={freezeBusy}
            onClose={() => setFreezeOutcome(null)}
            onOpenShop={() => setShopOpen(true)}
            onSave={() => {
              if (freezeOutcome.kind !== "offer") return;
              const { rescue, wallet } = freezeOutcome;
              setFreezeBusy(true);
              rescueStreak(authSession, rescue)
                .then((r) => {
                  setFreezeOutcome({ kind: "saved", streak: r.streak, spent: rescue.paidDays.length * wallet.freeze_price, balance: r.balance });
                  setDataEpoch((n) => n + 1);
                })
                .catch((err: unknown) => setToast(err instanceof Error ? err.message : "Não foi possível salvar a sequência."))
                .finally(() => setFreezeBusy(false));
            }}
          />
        ) : null}

        {shieldNotice !== null ? (
          <div className="nudge nudge-shield" role="status">
            <span className="nudge-emoji" aria-hidden="true">
              🛡️
            </span>
            <div>
              <strong>Um escudo salvou sua sequência!</strong>
              <span>Você não leu ontem, mas a sequência de {shieldNotice} dias continua. Bora ler hoje?</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => setShieldNotice(null)} aria-label="Fechar aviso">
              {Icon.close}
            </button>
          </div>
        ) : summary.streak > 0 && !summary.readToday && recent[0] ? (
          <div className="nudge" role="status">
            <span className="nudge-emoji" aria-hidden="true">
              🔥
            </span>
            <div>
              <strong>
                Sua sequência de {summary.streak} {summary.streak === 1 ? "dia" : "dias"} termina hoje!
              </strong>
              <span>
                {lastBook?.character ? `${lastBook.character} está te esperando` : "Sua história está te esperando"} em “
                {recent[0].book.title}”. Uns minutinhos já contam.
              </span>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => startBook(recent[0].book)}>
              Ler agora
            </button>
          </div>
        ) : null}

        {returning ? (
          <header className="welcome">
            <GoldDust density={30} />
            <span className="eyebrow">Storyverse</span>
            <h1>
              {greetingNow()}{authUser ? `, ${displayNameOf(authUser).split(" ")[0]}` : ""} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              {recent[0]
                ? `Pronto para voltar a “${recent[0].book.title}”?`
                : "Escolha um livro e comece a conversa com os personagens."}
            </p>
            {recent[0] ? (
              <WelcomeCall
                book={recent[0].book}
                onOpen={() => startBook(recent[0].book)}
              />
            ) : null}
            <div className="welcome-actions">
              {recent[0] ? (
                <button type="button" className="btn btn-primary" onClick={() => startBook(recent[0].book)}>
                  Continuar lendo
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => goToHomeSection("destaques")}>
                  Ver os destaques
                </button>
              )}
              <button type="button" className="btn" onClick={() => goToHomeSection("acervo")}>
                {Icon.search} Buscar no acervo
              </button>
              {/* No celular o "Importar" do topo some; aqui ele fica à mão (e dá para sugerir à comunidade). */}
              {canRead ? (
                <button type="button" className="btn" onClick={() => requestImport()}>
                  {Icon.upload} Importar livro
                </button>
              ) : null}
            </div>
            {BILLING_UI_ENABLED && subscription?.active ? <PlanCard status={subscription} /> : null}
          </header>
        ) : (
        <>
        <header className="hero">
          <GoldDust />
          <div className="hero-copy">
            <span className="eyebrow">Leitura interativa</span>
            <h1 className="hero-title">
              Leia o livro.
              <br />
              <em>Converse com quem vive nele.</em>
            </h1>
            <p className="hero-sub">
              Enquanto você lê, os personagens acompanham o seu ritmo e respondem no chat — com a voz, o
              tom e os segredos da própria história.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => goToHomeSection("destaques")}>
                Ver os destaques
              </button>
              <button type="button" className="btn btn-lg" onClick={() => goToHomeSection("acervo")}>
                Buscar no acervo
              </button>
              <button type="button" className="btn btn-lg" onClick={() => requestImport()}>
                {Icon.upload}
                Importar meu livro
              </button>
            </div>
            <p className="hero-hint">
              Não achou o seu livro favorito? Importe o arquivo (.epub, .pdf ou .txt) e converse com os
              personagens.
            </p>
          </div>

          {heroBook?.demo && heroChar ? (
            <button
              type="button"
              className="hero-demo"
              onClick={() => startBook(heroBook)}
              aria-label={`Abrir ${heroBook.title}`}
            >
              <div className="demo-page">
                <span className="demo-chapter">{heroBook.demo.chapterLabel}</span>
                <p>
                  <span className="demo-dropcap">{heroBook.demo.pageOpening.charAt(0)}</span>
                  {heroBook.demo.pageOpening.slice(1)}
                </p>
                <div className="demo-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="demo-chat">
                <div className="demo-chat-head">
                  <Avatar character={heroChar} size="sm" bookTitle={heroBook.title} />
                  <div>
                    <strong>{heroChar.name}</strong>
                    <small>{heroBook.title}</small>
                  </div>
                </div>
                <DemoConversation question={heroBook.demo.question} answer={heroBook.demo.answer} />
              </div>
            </button>
          ) : null}
        </header>

        <section className="steps" aria-label="Como funciona">
          <div className="step">
            <span className="step-n">1</span>
            <h3>Escolha uma história</h3>
            <p>Romances em português, terror, vampiros e mistério, qualquer livro do acervo ou um arquivo seu.</p>
          </div>
          <div className="step">
            <span className="step-n">2</span>
            <h3>Leia no seu ritmo</h3>
            <p>Capítulo a capítulo, com modo noturno ou sépia e letra do tamanho que preferir.</p>
          </div>
          <div className="step">
            <span className="step-n">3</span>
            <h3>Converse com os personagens</h3>
            <p>Pergunte, provoque, desabafe — eles sabem onde você parou e não dão spoiler.</p>
          </div>
        </section>
        </>
        )}

        {canRead && nudge ? (
          <CharacterNudgeCard
            nudge={nudge}
            onContinue={() => startBook(nudge.progress.book)}
            onReply={() => startBook(nudge.progress.book, { characterId: nudge.character.id, chat: true })}
            onDismiss={() => {
              dismissNudge(nudge.progress);
              setHomeTick((n) => n + 1);
            }}
          />
        ) : null}

        {recent.length > 0 || hasAnyReading() ? <ReadingStreak lastBook={lastBook} /> : null}

        {authSession ? <RankingTeaser onOpen={() => setRankingOpen(true)} /> : null}

        {recent.length > 0 || continueUndo ? (
          <ContinueReading
            items={recent}
            onOpen={startBook}
            onRemove={(p) => {
              removeProgress(p.book.gutenbergId);
              setContinueUndo(p);
              setHomeTick((n) => n + 1);
            }}
            undo={continueUndo}
            onUndo={() => {
              if (continueUndo) restoreProgress(continueUndo);
              setContinueUndo(null);
              setHomeTick((n) => n + 1);
            }}
          />
        ) : null}

        {/* A estante da pessoa logo depois do "Continue lendo": no celular ela ficava 6 telas abaixo. */}
        {canRead ? (
          <MyBooks
            onOpen={startBook}
            onRemoved={() => setHomeTick((n) => n + 1)}
            session={authSession}
            onSubmitted={() =>
              setAuthNotice({ text: "Livro enviado para análise. Você acompanha em Perfil › Seus envios.", ok: true })
            }
            onRequest={() => requestImport()}
            request={importRequest}
            setRequest={setImportRequest}
          />
        ) : null}

        {canRead ? <DailyQuote books={featuredBooks} /> : null}

        {catalogNew.length > 0 ? (
          <ProfileShelf
            eyebrow="📚 Biblioteca pública"
            title="Novidades da biblioteca"
            subtitle="Livros que acabaram de entrar no catálogo curado."
            items={catalogNew.map((b) => ({ book: b, sub: b.author }))}
            onOpen={startBook}
            action={
              <Link className="btn" to="/biblioteca">
                Ver a biblioteca
              </Link>
            }
          />
        ) : null}

        {SHELVES.map((shelf, si) => {
          const books = featuredBooks.filter((b) => (b.shelf ?? "classicos") === shelf.id);
          if (books.length === 0) return null;
          if (canRead) {
            return (
              <FeaturedRow
                key={shelf.id}
                id={si === 0 ? "destaques" : undefined}
                title={shelf.title}
                subtitle={shelf.subtitle}
                books={books}
                progressById={progressById}
                onOpen={startBook}
              />
            );
          }
          return (
            <section key={shelf.id} className="shelf" id={si === 0 ? "destaques" : undefined}>
              <div className="shelf-head">
                <h2>{shelf.title}</h2>
                <p>{shelf.subtitle}</p>
              </div>
              <div
                className={canRead ? "shelf-grid" : "book-carousel"}
                aria-label={canRead ? undefined : `${shelf.title}: carrossel de livros`}
              >
                <div className={canRead ? "shelf-grid-items" : "book-carousel-track"}>
                {(canRead ? books : [...books, ...books]).map((b, bookIndex) => {
                  const duplicate = !canRead && bookIndex >= books.length;
                  return (
                  <article key={`${b.id}-${bookIndex}`} className="book" aria-hidden={duplicate}>
                    <button
                      type="button"
                      className="book-cover-btn"
                      onClick={() => startBook(b)}
                      tabIndex={duplicate ? -1 : undefined}
                      aria-label={`Abrir ${b.title}`}
                    >
                      <BookCover book={b} />
                    </button>
                    <div className="book-info">
                      <div className="book-tags">
                        {b.genre ? <span className="genre-tag">{b.genre}</span> : null}
                        <LangBadge book={b} />
                      </div>
                      <h3>{b.title}</h3>
                      <p className="book-author">{b.author}</p>
                      {b.blurb ? <p className="book-blurb">{b.blurb}</p> : null}
                      {b.characters?.length ? (
                        <div className="book-cast">
                          <span className="avatar-stack">
                            {b.characters.map((c) => (
                              <Avatar key={c.id} character={c} size="sm" bookTitle={b.title} />
                            ))}
                          </span>
                          <span>Converse com {listNames(b.characters.map(shortNameOf))}</span>
                        </div>
                      ) : null}
                      <div className="book-actions">
                        <button type="button" className="btn btn-primary" onClick={() => startBook(b)} tabIndex={duplicate ? -1 : undefined}>
                          {progressById.has(b.gutenbergId) ? "Continuar lendo" : "Começar a ler"}
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
                </div>
              </div>
            </section>
          );
        })}

        {/* Uma estante só para a comunidade (U2): os recém-aprovados vêm primeiro, com o selo "Novo". */}
        {communityBooks.length > 0 ? (
          <ProfileShelf
            title="Da comunidade"
            subtitle="Livros enviados por leitores e aprovados pela curadoria."
            onOpen={startBook}
            items={communityBooks.map((b) => ({
              book: b,
              sub: b.author,
              ...(isNewCommunityBook(b) ? { badge: newBookLabel(b) } : {}),
            }))}
          />
        ) : null}

        {canRead ? (
          <div id="recursos">
            <Explore onOpen={startBook} onImport={(hint) => requestImport(hint ?? {})} communityBooks={communityBooks} />
          </div>
        ) : null}

        {celebration ? <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} /> : null}
        {finishPrompt.open ? <FinishBookDialog book={finishPrompt.open} onClose={finishPrompt.close} /> : null}
        {achievementQueue[0] ? <AchievementToast key={achievementQueue[0].id} achievement={achievementQueue[0]} onDone={nextAchievement} /> : null}

        {bookmarkDrop ? (
          <div key={bookmarkDrop.id} className="bookmark-drop" role="status">
            <span className="bookmark-ribbon" aria-hidden="true" />
            <span className="bookmark-label">
              <strong>Marcamos onde você parou</strong>
              <span>{bookmarkDrop.label}</span>
            </span>
          </div>
        ) : null}

        {updateBanner}

        <footer className="home-foot">
          <div className="foot-brand">
            <span className="wordmark foot-wordmark">
              <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
              Storyverse
            </span>
            <p>
              Leitura que conversa com você. Clássicos do{" "}
              <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
                Project Gutenberg
              </a>
              , livros da curadoria e da comunidade.
            </p>
          </div>
          <nav className="foot-cols" aria-label="Links do rodapé">
            <div className="foot-col">
              <h2 className="foot-col-title">Storyverse</h2>
              <button type="button" className="foot-link" onClick={() => setAboutOpen(true)}>
                Sobre nós
              </button>
              <Link className="foot-link" to="/biblioteca">
                Biblioteca pública
              </Link>
              {BILLING_UI_ENABLED && authUser ? (
                <Link className="foot-link" to="/conta/assinatura">
                  Minha assinatura
                </Link>
              ) : null}
            </div>
            <div className="foot-col">
              <h2 className="foot-col-title">Legal</h2>
              <Link className="foot-link" to="/termos">
                Termos de uso
              </Link>
              <Link className="foot-link" to="/privacidade">
                Privacidade
              </Link>
              <Link className="foot-link" to="/cancelamento">
                Cancelamento e reembolso
              </Link>
            </div>
          </nav>
          <div className="home-credit">
            <span>© {new Date().getFullYear()} Storyverse</span>
            <span>
              Desenvolvido por <strong>Axyon Software House</strong>
              <span className="home-credit-sep" aria-hidden="true"> · </span>
              <span className="home-credit-holder">{LEGAL_HOLDER_NAME}</span>
            </span>
          </div>
        </footer>
      </div>
    );
  }

  const ready = loadState === "ready" && fullText.length > 0;
  const hasNextChapter = chapterIndex < chapters.length - 1;

  return (
    <div className={`reader theme-${prefs.theme}${immersive ? " is-immersive" : ""}`}>
      {immersive || isFullscreen ? (
        <button type="button" className="reader-immersive-exit" onClick={() => void toggleReadingFullscreen()}>
          Sair da tela cheia
        </button>
      ) : null}
      {/* Por cima de tudo, sem pegar cliques: tira o azul da tela para ler à noite. */}
      {prefs.nightLight ? <div className={`night-light night-light-${prefs.nightLight}`} aria-hidden="true" /> : null}
      <ReaderBar
        book={book}
        chapterIndex={chapterIndex}
        chapters={chapters}
        currentChapter={currentChapter}
        goalFlash={goalFlash}
        hasNextChapter={hasNextChapter}
        highlights={highlights}
        immersive={immersive}
        isFullscreen={isFullscreen}
        leaveBook={leaveBook}
        prefs={prefs}
        readerSettingsOpen={readerSettingsOpen}
        readingHere={readingHere}
        readingProgressPct={readingProgressPct}
        ready={ready}
        search={search}
        setChapterIndex={setChapterIndex}
        setHighlightsOpen={setHighlightsOpen}
        setPrefs={setPrefs}
        setReaderSettingsOpen={setReaderSettingsOpen}
        setShelfPanelOpen={setShelfPanelOpen}
        shelfOn={shelfOn}
        shelfPanelOpen={shelfPanelOpen}
        toggleReadingFullscreen={toggleReadingFullscreen}
        translation={translation}
        voice={voice}
      />

      <div className="reader-layout">
        <main
          ref={readRef}
          className="page"
          onScroll={onReadScroll}
          style={{ "--read-size": `${FONT_SIZES[prefs.fontStep]}rem` } as React.CSSProperties}
        >
          {loadState === "loading" ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              {isLocalBook(book) ? "Abrindo o seu livro…" : "Buscando o livro no acervo…"}
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="page-status page-status-err">
              <p>{loadError}</p>
              <button type="button" className="btn btn-primary" onClick={retryLoad}>
                Tentar de novo
              </button>
            </div>
          ) : null}

          {ready && currentChapter ? (
            <ChapterText
              authSession={authSession}
              blocks={blocks}
              book={book}
              bookImages={bookImages}
              chapterDirRef={chapterDirRef}
              chapterDone={chapterDone}
              chapterIndex={chapterIndex}
              chapterKey={chapterKey}
              chapters={chapters}
              currentChapter={currentChapter}
              dropCapIndex={dropCapIndex}
              handleSelection={handleSelection}
              hasNextChapter={hasNextChapter}
              highlights={highlights}
              lastActivityRef={lastActivityRef}
              setChapterIndex={setChapterIndex}
              translation={translation}
              visibleChunk={visibleChunk}
              voice={voice}
            />
          ) : null}
        </main>

        {voice.voicePanelOpen && voice.speaking ? (
          <VoicePanel
            voice={voice}
          />
        ) : null}

        {selection ? (
          <SelectionToolbar
            addHighlight={addHighlight}
            clearSelection={clearSelection}
            currentChapter={currentChapter}
            selection={selection}
            shareQuote={shareQuote}
            showMeaning={showMeaning}
          />
        ) : null}

        {wordCard ? (
          <WordCard
            setWordCard={setWordCard}
            wordCard={wordCard}
          />
        ) : null}

        {search.searchOpen ? (
          <BookSearchDialog
            search={search}
          />
        ) : null}

        {highlightsOpen ? (
          <HighlightsDialog
            highlightGroups={highlightGroups}
            openHighlight={openHighlight}
            removeHighlight={removeHighlight}
            setHighlightsOpen={setHighlightsOpen}
            shareQuote={shareQuote}
          />
        ) : null}

        {celebration ? <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} /> : null}
        {finishPrompt.open ? <FinishBookDialog book={finishPrompt.open} onClose={finishPrompt.close} /> : null}
        {achievementQueue[0] ? <AchievementToast key={achievementQueue[0].id} achievement={achievementQueue[0]} onDone={nextAchievement} /> : null}

        {updateBanner}

        {toast || sharing ? (
          <div className="toast" role="status">
            {sharing ? "Gerando a imagem…" : toast}
          </div>
        ) : null}

        <ChatPanel
          book={book}
          chat={chat}
          ready={ready}
          setShopOpen={setShopOpen}
          shareMessage={shareMessage}
        />

        {!chat.chatOpen ? (
          <button
            type="button"
            className="chat-fab"
            onClick={() => {
              setChatOpen(true);
              requestAnimationFrame(() => chat.inputRef.current?.focus());
            }}
          >
            {chat.character ? <Avatar character={chat.character} size="sm" bookTitle={book.title} generate /> : null}
            {chat.character ? `Conversar com ${shortNameOf(chat.character)}` : "Conversar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
