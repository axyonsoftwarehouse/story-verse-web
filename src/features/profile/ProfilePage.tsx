import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeIcon, GiftIcon } from "../../components/badgeIcons";
import { useConfirm } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { profileColor } from "../../lib/profileColor";
import { findAvatar } from "../../avatars";
import { featuredBooks } from "../../data/ebooks";
import type { Ebook, StoryCharacter } from "../../data/types";
import { narratorCharacter } from "../../lib/ai";
import { knownCast } from "../../lib/cast";
import { characterTalks, forgetAllChats, storedChatSummary } from "../../lib/chatHistory";
import { achievements } from "../../lib/achievements";
import { deleteAccount, exportAccount, exportAccountFiles } from "../../lib/account";
import { APP_THEMES, appThemeFromMetadata, loadAppTheme, saveAppTheme, type AppThemeId } from "../../lib/appTheme";
import { finishedBooks } from "../../lib/finished";
import { publishShowcase } from "../../lib/social";
import { ownProfileCover, useOwnProfileExtras } from "../shop/useOwnProfileExtras";
import { PersonName } from "../shop/PersonName";
import { BadgeShelf } from "../shop/BadgeShelf";
import { shelfEntries } from "../../lib/libraryStore";
import { BILLING_UI_ENABLED } from "../../lib/billing";
import { useAnimatedNumber } from "../../lib/motion";
import { allHighlights, type Highlight } from "../../lib/highlights";
import { listLocalBooks } from "../../lib/localBooks";
import { progressPct, recentProgress } from "../../lib/progress";
import { GOAL_OPTIONS, readingSummary, readingTotals, setReadingGoalMinutes } from "../../lib/readingStats";
import { fetchWallet } from "../../lib/diamonds";
import { fetchGiftSummary, fetchReceivedGifts, giftDate, type GiftSummary, type ReceivedGift } from "../../lib/gifts";
import { loadReminderPrefs, saveReminderPrefs } from "../../lib/reminders";
import { apiEnabled } from "../../lib/backend";
import { updatePassword, updateProfileData, type SupabaseSession } from "../../lib/auth";
import { NightLight, NIGHT_LIGHT_LABELS, ReadingPrefs } from "../../lib/readingPrefs";
import { displayNameOf, metaString } from "../../lib/userMeta";
import { useBackClose } from "../../lib/useBackClose";
import { shelfAchievements } from "../../lib/shelfAchievements";
import { Avatar } from "../../components/Avatar";
import { BookCover } from "../../components/BookCover";
import { UserAvatar } from "../../components/UserAvatar";
import { PasswordInput } from "../../components/PasswordInput";
import { LastBook, ReminderSetup } from "../home/ReminderSetup";
import { ProfileShelf } from "../home/ProfileShelf";
import { EditProfileModal } from "./EditProfileModal";
import { ReadingDashboard } from "./ReadingDashboard";
import { MySubmissions } from "./MySubmissions";

function memberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Card do perfil que leva à "Minha estante", com os totais. */
function ShelfSummary({ onOpen }: { onOpen: () => void }) {
  const entries = shelfEntries();
  const finished = entries.filter((e) => e.status === "finished").length;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>Minha estante</h2>
        <p>
          {entries.length === 1 ? "1 livro" : `${entries.length} livros`} ·{" "}
          {finished === 1 ? "1 terminado" : `${finished} terminados`}
        </p>
      </div>
      <button type="button" className="btn" onClick={onOpen}>
        Abrir minha estante
      </button>
    </section>
  );
}

/**
 * Central de Privacidade (Ajustes): o que fica guardado sobre o leitor, para quê, e a limpeza
 * do histórico de conversas a qualquer momento. Buscas não são guardadas.
 */
function PrivacyCenter() {
  const [chats, setChats] = useState(() => storedChatSummary());
  const [cleared, setCleared] = useState(false);
  const clearChats = () => {
    if (!window.confirm("Apagar todas as suas conversas com os personagens, em todos os aparelhos da conta? Não dá para desfazer.")) {
      return;
    }
    forgetAllChats();
    setChats(storedChatSummary());
    setCleared(true);
  };
  return (
    <section className="shelf" id="privacidade">
      <div className="shelf-head">
        <h2>Privacidade</h2>
        <p>O que fica guardado sobre você, para quê, e como apagar. Ninguém da comunidade vê nada disso.</p>
      </div>
      <div className="profile-card profile-account privacy-center">
        <div className="profile-account-row">
          <div>
            <span className="profile-account-label">Conversas com os personagens</span>
            <p>
              Guardadas no seu aparelho e na sua conta para continuar de onde parou. Cada mensagem vai
              criptografada até a IA só para o personagem responder.
            </p>
            <strong>
              {chats.books === 0
                ? "Nenhuma conversa guardada."
                : `${chats.books} ${chats.books === 1 ? "conversa" : "conversas"} · ${chats.messages} ${chats.messages === 1 ? "mensagem sua" : "mensagens suas"}`}
            </strong>
          </div>
          <button type="button" className="btn" onClick={clearChats} disabled={chats.books === 0}>
            Apagar histórico
          </button>
        </div>
        {cleared ? (
          <p className="privacy-center-done" role="status">
            Histórico de conversas apagado. Os outros aparelhos da conta apagam na próxima sincronização.
          </p>
        ) : null}
        <div className="profile-account-row">
          <div>
            <span className="profile-account-label">Buscas</span>
            <p>
              Não ficam salvas. A busca no acervo vai só até os catálogos de livros para trazer resultados;
              a busca dentro de um livro roda no seu aparelho.
            </p>
          </div>
        </div>
        <div className="profile-account-row">
          <div>
            <span className="profile-account-label">Leitura</span>
            <p>
              Progresso, livros terminados, marcações e minutos lidos ficam na sua conta para você continuar em
              qualquer aparelho e manter a sequência.
            </p>
          </div>
        </div>
        <div className="profile-account-row">
          <div>
            <span className="profile-account-label">Tudo de uma vez</span>
            <p>Para apagar a conta e todos os dados dela, use Excluir conta, logo abaixo.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Perfil: quem é o leitor, números da leitura, estante, marcações, preferências e conta.
 * Nome, avatar e preferências são um rascunho até tocar em "Salvar alterações".
 */
export function ProfilePage({
  session,
  onSessionChange,
  onClose,
  onLogout,
  onAccountDeleted,
  loggingOut,
  onOpenBook,
  onOpenHighlight,
  prefs,
  setPrefs,
  lastBook,
  isAvailable,
  isStaff,
  canModerate,
  onOpenShop,
  onOpenShelf,
}: {
  session: SupabaseSession;
  onSessionChange: (session: SupabaseSession) => void;
  onClose: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
  loggingOut: boolean;
  onOpenBook: (book: Ebook) => void;
  onOpenHighlight: (book: Ebook, h: Highlight) => void;
  prefs: ReadingPrefs;
  setPrefs: React.Dispatch<React.SetStateAction<ReadingPrefs>>;
  lastBook?: LastBook;
  /** Livro ainda existe para esta conta (ver `bookAvailable`). */
  isAvailable: (book: Ebook) => boolean;
  isStaff?: boolean;
  canModerate?: boolean;
  onOpenShop: () => void;
  /** Abre "Minha estante"; ausente quando a conta não tem a estante. */
  onOpenShelf?: () => void;
}) {
  const user = session.user;
  // Enfeites da loja; a foto de capa enviada vem da sessão (atualiza na hora ao editar).
  const shopState = useOwnProfileExtras(user.id);
  const shopProfile = shopState.extras;
  const cover = ownProfileCover(shopState, metaString(user, "cover"));
  const [diamonds, setDiamonds] = useState<number | null>(null);
  const [giftSummary, setGiftSummary] = useState<GiftSummary | null>(null);
  const [receivedGifts, setReceivedGifts] = useState<ReceivedGift[]>([]);
  const shownDiamonds = useAnimatedNumber(diamonds);
  useEffect(() => {
    let alive = true;
    fetchWallet(session)
      .then((w) => alive && setDiamonds(w.balance))
      .catch(() => {
        // Sem a loja no Supabase ou sem internet: o botão mostra "–" no lugar do saldo.
      });
    Promise.all([fetchGiftSummary(session), fetchReceivedGifts(session, 6)])
      .then(([summary, gifts]) => {
        if (!alive) return;
        setGiftSummary(summary);
        setReceivedGifts(gifts);
      })
      .catch(() => {
        // Presentes ainda não configurados: o perfil segue normal.
      });
    return () => {
      alive = false;
    };
  }, [session]);
  const name = displayNameOf(user);
  const since = memberSince(user.created_at);
  const { confirm, dialog } = useConfirm();

  async function askLogout() {
    if (
      await confirm({
        title: "Sair da conta?",
        message: "Você precisará entrar de novo para continuar lendo neste aparelho.",
        confirmLabel: "Sair",
        danger: true,
      })
    ) {
      onLogout();
    }
  }

  const [summary, setSummary] = useState(readingSummary);
  const totals = useMemo(readingTotals, []);
  const reading = useMemo(() => recentProgress().filter((p) => isAvailable(p.book)), [isAvailable]);
  const finished = useMemo(finishedBooks, []);
  const [imported, setImported] = useState<Ebook[]>([]);
  useEffect(() => {
    void listLocalBooks().then(setImported).catch(() => {});
  }, []);

  // ---- Rascunho das preferências (só vale depois de salvar) ----
  const [goal, setGoal] = useState(summary.goalMinutes);
  const [theme, setTheme] = useState(prefs.theme);
  const [nightLight, setNightLight] = useState<NightLight>(prefs.nightLight);
  const [reminderTime, setReminderTime] = useState(() => loadReminderPrefs().time);
  const [editOpen, setEditOpen] = useState(false);
  useBackClose(editOpen, () => setEditOpen(false));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty =
    goal !== summary.goalMinutes ||
    theme !== prefs.theme ||
    nightLight !== prefs.nightLight ||
    reminderTime !== loadReminderPrefs().time;

  function discard() {
    setGoal(summary.goalMinutes);
    setTheme(prefs.theme);
    setNightLight(prefs.nightLight);
    setReminderTime(loadReminderPrefs().time);
    setSaveError("");
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      setReadingGoalMinutes(goal);
      setSummary(readingSummary());
      setPrefs((p) => ({ ...p, theme, nightLight }));
      saveReminderPrefs({ ...loadReminderPrefs(), time: reminderTime });
      setSavedFlash(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!savedFlash) return;
    const t = window.setTimeout(() => setSavedFlash(false), 2600);
    return () => window.clearTimeout(t);
  }, [savedFlash]);

  function leave() {
    if (dirty && !window.confirm("Sair sem salvar as alterações?")) return;
    onClose();
  }

  // Livro de cada marcação: dos começados, terminados, importados ou da estante.
  const bookById = useMemo(() => {
    const map = new Map<string, Ebook>();
    for (const b of featuredBooks) map.set(b.id, b);
    for (const b of imported) map.set(b.id, b);
    for (const f of finished) map.set(f.book.id, f.book);
    for (const p of reading) map.set(p.book.id, p.book);
    return map;
  }, [imported, finished, reading]);

  const marks = useMemo(
    () =>
      allHighlights()
        .map(({ bookId, highlights }) => {
          const groups = new Map<string, { first: Highlight; text: string }>();
          for (const h of [...highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.paragraph - b.paragraph)) {
            const key = h.group ?? h.id;
            const g = groups.get(key);
            if (g) g.text = `${g.text} ${h.text}`;
            else groups.set(key, { first: h, text: h.text });
          }
          return { book: bookById.get(bookId), items: [...groups.values()] };
        })
        .filter((m): m is { book: Ebook; items: { first: Highlight; text: string }[] } => Boolean(m.book)),
    [bookById],
  );
  const markCount = marks.reduce((n, m) => n + m.items.length, 0);
  const lendo = reading.filter((p) => !finished.some((f) => f.book.id === p.book.id));

  /** Com quem você mais conversou (das conversas guardadas), com o livro e o retrato de cada um. */
  const allTalks = useMemo(() => characterTalks(), []);
  const talks = useMemo(() => {
    const out: { book: Ebook; character: StoryCharacter; sent: number }[] = [];
    for (const t of allTalks) {
      const book = bookById.get(t.bookId);
      if (!book) continue;
      const character =
        t.characterId === "narrador" ? narratorCharacter(book.title) : knownCast(book)?.find((c) => c.id === t.characterId);
      if (!character) continue;
      out.push({ book, character, sent: t.sent });
    }
    return out;
  }, [allTalks, bookById]);
  const [allCharacters, setAllCharacters] = useState(false);
  const shownTalks = allCharacters ? talks : talks.slice(0, TALKS_PREVIEW);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const favorite = talks[0];

  const badges = useMemo(
    () =>
      achievements({
        totalMinutes: totals.totalMinutes,
        bestStreak: totals.bestStreak,
        finishedBooks: finished.length,
        marks: markCount,
        messagesSent: allTalks.reduce((n, t) => n + t.sent, 0),
        charactersTalked: allTalks.length,
        giftsReceived: giftSummary?.received_total ?? null,
        shelf: shelfAchievements(),
      }),
    [totals, finished.length, markCount, allTalks, giftSummary],
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const allBadges = unlockedCount === badges.length;
  // Perfil público (rede social): leva as conquistas e alguns números para quem abrir o perfil.
  useEffect(() => {
    void publishShowcase(user.id, badges, {
      totalMinutes: totals.totalMinutes,
      bestStreak: totals.bestStreak,
      finishedBooks: finished.length,
      messagesSent: allTalks.reduce((n, t) => n + t.sent, 0),
    });
  }, [user.id, badges, totals, finished.length, allTalks]);
  const nowReading = lendo[0];

  /** Cor do app: vale na hora (sem "Salvar"), sincroniza na conta para o perfil em Pessoas. */
  const [appTheme, setAppTheme] = useState<AppThemeId>(() =>
    apiEnabled ? appThemeFromMetadata(user.user_metadata?.profile_theme) : loadAppTheme(),
  );
  useEffect(() => {
    const fromAccount = appThemeFromMetadata(user.user_metadata?.profile_theme);
    setAppTheme(fromAccount);
    saveAppTheme(fromAccount);
  }, [user.user_metadata?.profile_theme]);

  async function pickAppTheme(id: AppThemeId) {
    setAppTheme(id);
    saveAppTheme(id);
    if (!apiEnabled) return;
    try {
      const next = await updateProfileData(session, { profileTheme: id === "dourado" ? "" : id });
      onSessionChange(next);
    } catch {
      /* o app já mudou; na próxima vez que salvar ou entrar tenta de novo */
    }
  }
  /** Preferências e conta ficam numa tela à parte; o perfil é sobre a leitura. */
  const [settingsOpen, setSettingsOpen] = useState(false);
  useBackClose(settingsOpen, () => setSettingsOpen(false));
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [settingsOpen]);

  // ---- Senha (ação direta, com o próprio botão) ----
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwState, setPwState] = useState<{ loading?: boolean; error?: string; ok?: string }>({});
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwCurrent) return setPwState({ error: "Informe a senha atual." });
    if (pw.length < 8) return setPwState({ error: "A senha precisa ter pelo menos 8 caracteres." });
    if (pw !== pwConfirm) return setPwState({ error: "As duas senhas não são iguais." });
    setPwState({ loading: true });
    try {
      await updatePassword(session, pwCurrent, pw);
      setPwCurrent("");
      setPw("");
      setPwConfirm("");
      setPwOpen(false);
      setPwState({ ok: "Senha trocada." });
    } catch (err) {
      setPwState({ error: err instanceof Error ? err.message : "Não foi possível trocar a senha." });
    }
  }

  // ---- Dados da conta: exportar/excluir ----
  const [accountBusy, setAccountBusy] = useState<"export" | "files" | "delete" | null>(null);
  const [accountError, setAccountError] = useState("");
  const [accountOk, setAccountOk] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  async function downloadData() {
    setAccountBusy("export");
    setAccountError("");
    setAccountOk("");
    try {
      const data = await exportAccount(session);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "storyverse-dados.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setAccountOk("Cópia dos seus dados gerada.");
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Não foi possível exportar seus dados.");
    } finally {
      setAccountBusy(null);
    }
  }

  async function downloadFiles() {
    setAccountBusy("files");
    setAccountError("");
    setAccountOk("");
    try {
      const blob = await exportAccountFiles(session);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "storyverse-arquivos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setAccountOk("Arquivos da conta gerados em ZIP.");
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Não foi possível exportar os arquivos.");
    } finally {
      setAccountBusy(null);
    }
  }

  async function removeAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) return setAccountError("Informe sua senha para excluir a conta.");
    if (!window.confirm("Excluir permanentemente a conta, os livros importados, as conversas e os arquivos? A assinatura no cartão, se houver, será cancelada. Não dá para desfazer.")) return;
    setAccountBusy("delete");
    setAccountError("");
    setAccountOk("");
    try {
      await deleteAccount(session, deletePassword);
      onAccountDeleted();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
      setAccountBusy(null);
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // Fechar a aba ou recarregar com alterações pendentes: o navegador pergunta antes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const chosenAvatar = findAvatar(user.user_metadata?.avatar);

  return (
    <div className={`home profile ${dirty ? "has-savebar" : ""}`}>
      {editOpen ? <EditProfileModal session={session} onSaved={onSessionChange} onClose={() => setEditOpen(false)} /> : null}
      <nav className="home-nav profile-nav nav-split">
        <button type="button" className="btn" onClick={settingsOpen ? () => setSettingsOpen(false) : leave}>
          Voltar
        </button>
        <span className="profile-nav-actions">
          {settingsOpen ? null : (
            <button type="button" className="btn profile-settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Ajustes">
              {Icon.settings}
              <span className="profile-settings-label">Ajustes</span>
            </button>
          )}
        <button type="button" className="btn ranking-diamonds" onClick={onOpenShop} title="Abrir a loja de diamantes">
          <span aria-hidden="true">💎</span>{" "}
          <strong className={`count-up ${shownDiamonds !== null && shownDiamonds !== diamonds ? "is-counting" : ""}`}>{shownDiamonds ?? "–"}</strong>
          <span className="sr-only"> diamantes. Abrir a loja</span>
        </button>
        </span>
      </nav>

      {settingsOpen ? null : (
      <>

      <header
        className={`profile-hero ${cover.reserve ? "has-cover" : ""}`}
      >
        {/* Capa: faixa dentro do cartão (fora da borda), que se dissolve no fundo. */}
        {cover.url ? (
          <div
            className="profile-cover"
            style={{ backgroundImage: `url("${cover.url}")` } as React.CSSProperties}
            aria-hidden="true"
          />
        ) : null}
        <div className="profile-hero-glow" style={{ "--c": chosenAvatar?.color ?? profileColor(user.id) } as React.CSSProperties} aria-hidden="true" />
        <button type="button" className="profile-avatar-btn" onClick={() => setEditOpen(true)} aria-label="Editar perfil">
          <UserAvatar user={user} className="profile-avatar" cosmetics={shopProfile?.cosmetics} animate />
          <span className="profile-avatar-edit" aria-hidden="true">{Icon.pencil}</span>
        </button>
        <div className="profile-id">
          <h1>
            <PersonName name={name} cosmetics={shopProfile?.cosmetics} />
          </h1>
          {allBadges ? <span className="legend-seal">🏆 Lenda da leitura</span> : null}
          {metaString(user, "bio") ? (
            <p className="profile-bio">{metaString(user, "bio")}</p>
          ) : (
            <button type="button" className="inline-link profile-bio-add" onClick={() => setEditOpen(true)}>
              {Icon.pencil}
              Adicionar biografia
            </button>
          )}
          {since ? <p>Lendo no Storyverse desde {since}</p> : null}
        </div>
      </header>

      {nowReading || favorite ? (
        <div className="profile-identity">
          {nowReading ? (
            <button type="button" className="identity-card identity-book" onClick={() => onOpenBook(nowReading.book)}>
              <span className="identity-cover">
                <BookCover book={nowReading.book} />
              </span>
              <span className="identity-text">
                <small>Lendo agora</small>
                <strong>{nowReading.book.title}</strong>
                <span className="identity-progress" aria-label={`${Math.round(progressPct(nowReading))}% lido`}>
                  <span style={{ width: `${Math.max(3, Math.round(progressPct(nowReading)))}%` }} />
                </span>
              </span>
            </button>
          ) : null}
          {favorite ? (
            <div className="identity-card identity-character" style={{ "--c": favorite.character.color } as React.CSSProperties}>
              <Avatar character={favorite.character} size="lg" bookTitle={favorite.book.title} />
              <span className="identity-text">
                <small>Personagem favorito</small>
                <strong>{favorite.character.name}</strong>
                <span>
                  {favorite.sent} {favorite.sent === 1 ? "mensagem" : "mensagens"} · {favorite.book.title}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <ReadingDashboard summary={summary} totals={totals} finishedCount={finished.length} markCount={markCount} />
      <p className="profile-device-note">Os números, as marcações e os livros são da sua conta: aparecem igual na Web e no app.</p>

      <section className="shelf">
        <div className="shelf-head">
          <h2>Seus personagens</h2>
          <p>Com quem você mais conversou nos livros.</p>
        </div>
        {talks.length === 0 ? (
          <p className="profile-empty profile-empty-card">
            <span className="profile-empty-icon" aria-hidden="true">
              💬
            </span>
            <span>Abra um livro e puxe conversa com um personagem: quem você mais conversar aparece aqui.</span>
          </p>
        ) : (
          <ol className="talk-grid">
            {shownTalks.map(({ book, character, sent }, i) => (
              <li key={`${book.id}-${character.id}`} style={{ "--c": character.color, "--i": i } as React.CSSProperties}>
                <button type="button" className={`talk-card ${i === 0 ? "is-top" : ""}`} onClick={() => onOpenBook(book)}>
                  {i === 0 ? <span className="talk-badge">Favorito</span> : null}
                  <Avatar character={character} size="lg" bookTitle={book.title} />
                  <strong>{character.name}</strong>
                  <span className="talk-book">{book.title}</span>
                  <span className="talk-count">
                    {sent} {sent === 1 ? "mensagem" : "mensagens"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {talks.length > TALKS_PREVIEW ? (
          <div className="shelf-more">
            <button type="button" className="btn" onClick={() => setAllCharacters((v) => !v)}>
              {allCharacters ? "Mostrar menos" : `Ver todos (${talks.length})`}
            </button>
          </div>
        ) : null}
      </section>

      {shopProfile?.badge_shelf?.length ? (
        <section className="shelf">
          <div className="shelf-head">
            <h2>Insígnias</h2>
            <p>As insígnias da loja que você tem.</p>
          </div>
          <BadgeShelf items={shopProfile.badge_shelf} />
        </section>
      ) : null}

      <section className="shelf">
        <div className="shelf-head">
          <h2>Conquistas</h2>
          {allBadges ? null : (
            <p>
              {unlockedCount} de {badges.length} conquistadas. As apagadas mostram quanto falta.
            </p>
          )}
        </div>
        {allBadges ? (
          <div className="badge-complete" role="status">
            <span className="badge-complete-trophy" aria-hidden="true">
              🏆
            </span>
            <div>
              <strong>Você conquistou todas as {badges.length} conquistas!</strong>
              <span>Lenda da leitura: não sobrou nenhum marco para trás.</span>
            </div>
          </div>
        ) : null}
        <ol className={`badge-grid ${allBadges ? "is-complete" : ""}`}>
          {/* Conquistadas primeiro; depois as que estão mais perto de sair. De início, só a primeira leva. */}
          {[...badges]
            .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.current / b.target - a.current / a.target)
            .slice(0, showAllBadges ? undefined : BADGES_PREVIEW)
            .map((b, i) => (
              <li
                key={b.id}
                className={`badge-card ${b.unlocked ? "is-unlocked" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="badge-medal" aria-hidden="true">
                  <BadgeIcon id={b.id} size={30} />
                </span>
                <strong>{b.title}</strong>
                <span className="badge-desc">{b.description}</span>
                {b.unlocked ? (
                  <span className="badge-done">Conquistada</span>
                ) : (
                  <>
                    <span className="badge-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, (b.current / b.target) * 100)}%` }} />
                    </span>
                    <span className="badge-missing">{b.missing}</span>
                  </>
                )}
              </li>
            ))}
        </ol>
        {badges.length > BADGES_PREVIEW ? (
          <div className="shelf-more">
            <button
              type="button"
              className="btn"
              aria-expanded={showAllBadges}
              onClick={() => setShowAllBadges((v) => !v)}
            >
              {showAllBadges ? "Mostrar menos" : `Ver todas (${badges.length})`}
            </button>
          </div>
        ) : null}
      </section>

      {onOpenShelf ? <ShelfSummary onOpen={onOpenShelf} /> : null}

      <ProfileShelf
        title="Lendo agora"
        empty="Nenhum livro começado ainda."
        onOpen={onOpenBook}
        items={lendo.map((p) => {
          const pct = Math.round(progressPct(p));
          return { book: p.book, sub: `${p.chapterLabel} · ${pct}%`, pct };
        })}
      />
      <ProfileShelf
        title="Terminados"
        onOpen={onOpenBook}
        items={finished.map((f) => ({
          book: f.book,
          sub: `Terminado em ${new Date(f.finishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
        }))}
      />
      <ProfileShelf title="Seus livros importados" onOpen={onOpenBook} items={imported.map((b) => ({ book: b, sub: b.author }))} />

      <MySubmissions session={session} />

      <section className="shelf">
        <div className="shelf-head">
          <h2>Presentes</h2>
          <p>Itens que outros leitores enviaram para você.</p>
        </div>
        {giftSummary ? (
          <div className="gift-summary">
            <div>
              <strong>{giftSummary.received_total}</strong>
              <span>recebidos</span>
            </div>
            <div>
              <strong>{giftSummary.received_this_week}</strong>
              <span>nesta semana</span>
            </div>
            <div>
              <strong>{giftSummary.sent_this_week}</strong>
              <span>enviados na semana</span>
            </div>
          </div>
        ) : null}
        {receivedGifts.length > 0 ? (
          <ul className="gift-received">
            {receivedGifts.map((gift, index) => (
              <li key={`${gift.gift_id}-${gift.created_at}-${index}`}>
                <span className="gift-received-icon" aria-hidden="true">
                  <GiftIcon id={gift.gift_id} emoji={gift.icon} size={22} />
                </span>
                <span>
                  <strong>{gift.name}</strong>
                  <small>
                    de {gift.from_name} · {giftDate(gift.created_at)}
                  </small>
                </span>
                <span className="gift-received-price">{gift.price} 💎</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty profile-empty-card">
            <span className="profile-empty-icon" aria-hidden="true">
              🎁
            </span>
            <span>Nenhum presente recebido ainda. Participe do ranking e os leitores podem enviar um.</span>
          </p>
        )}
      </section>

      <section className="shelf">
        <div className="shelf-head">
          <h2>Marcações</h2>
          <p>Os trechos que você destacou, de todos os livros.</p>
        </div>
        {marks.length === 0 ? (
          <p className="profile-empty profile-empty-card">
            <span className="profile-empty-icon" aria-hidden="true">
              {Icon.highlight}
            </span>
            <span>
              <strong>Nenhum trecho marcado ainda.</strong> Durante a leitura, selecione um trecho e toque em{" "}
              <strong>Marcar</strong>: ele fica guardado aqui.
            </span>
          </p>
        ) : (
          <div className="profile-marks">
            {marks.map(({ book, items }) => (
              <div key={book.id} className="profile-card profile-mark-book">
                <h3>{book.title}</h3>
                <ul className="marks-list">
                  {items.map(({ first, text }) => (
                    <li key={first.group ?? first.id}>
                      <span className="marks-chapter">{first.chapterLabel}</span>
                      <blockquote>{text}</blockquote>
                      <div className="marks-actions">
                        <button type="button" className="link-btn" onClick={() => onOpenHighlight(book, first)}>
                          Abrir no trecho
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      </>
      )}

      {settingsOpen ? (
      <>
      <header className="profile-settings-head">
        <span className="profile-settings-icon" aria-hidden="true">
          {Icon.settings}
        </span>
        <h1>Ajustes</h1>
        <p>Cor do app, leitura, privacidade, conta e sessão.</p>
      </header>

      <section className="shelf">
        <div className="shelf-head">
          <h2>Preferências</h2>
        </div>
        <div className="profile-card profile-prefs">
          <div className="profile-pref">
            <span>Cor do app</span>
            <p className="profile-pref-hint">Vale no app inteiro e na sua página em Pessoas.</p>
            <div className="theme-swatches" role="radiogroup" aria-label="Cor do app">
              {APP_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={appTheme === t.id}
                  className={`theme-swatch ${appTheme === t.id ? "is-on" : ""}`}
                  style={{ "--a": t.swatch[0], "--b": t.swatch[1], "--bg": t.bg } as React.CSSProperties}
                  onClick={() => void pickAppTheme(t.id)}
                  title={t.label}
                >
                  <span className="theme-swatch-dot" aria-hidden="true" />
                  <span className="theme-swatch-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="profile-pref">
            <span>Meta diária</span>
            <div className="segmented" role="radiogroup" aria-label="Meta diária">
              {GOAL_OPTIONS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={goal === m} className={goal === m ? "is-on" : ""} onClick={() => setGoal(m)}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div className="profile-pref">
            <span>Tema de leitura</span>
            <div className="segmented" role="radiogroup" aria-label="Tema de leitura">
              {(["night", "sepia"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? "is-on" : ""} onClick={() => setTheme(t)}>
                  {t === "night" ? "Noturno" : "Sépia"}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-pref">
            <span>Luz noturna</span>
            <div className="segmented" role="radiogroup" aria-label="Luz noturna">
              {([0, 1, 2] as const).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={nightLight === n} className={nightLight === n ? "is-on" : ""} onClick={() => setNightLight(n)}>
                  {NIGHT_LIGHT_LABELS[n].charAt(0).toUpperCase() + NIGHT_LIGHT_LABELS[n].slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ReminderSetup lastBook={lastBook} time={reminderTime} onTimeChange={setReminderTime} />
        </div>
      </section>

      {isStaff ? (
        <section className="shelf">
          <div className="shelf-head">
            <h2>Admin</h2>
          </div>
          <a className="profile-card profile-admin admin-entry" href="/admin">
            <div>
              <strong>Painel administrativo</strong>
              <span>Visão geral, contas, moderação e auditoria.</span>
            </div>
            <span className="btn btn-primary">Abrir painel</span>
          </a>
          {canModerate ? (
            <a className="profile-card profile-admin admin-entry" href="/admin/acervo">
              <div>
                <strong>Acervo</strong>
                <span>Cadastre, publique e modere os livros do catálogo.</span>
              </div>
              <span className="btn">Abrir acervo</span>
            </a>
          ) : null}
        </section>
      ) : null}

      <PrivacyCenter />

      <section className="shelf">
        <div className="shelf-head">
          <h2>Conta</h2>
        </div>
        <div className="profile-card profile-account">
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">E-mail</span>
              <strong>{user.email}</strong>
            </div>
          </div>
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Senha</span>
              <strong>••••••••</strong>
            </div>
            {!pwOpen ? (
              <button type="button" className="btn" onClick={() => { setPwOpen(true); setPwState({}); }}>
                Trocar senha
              </button>
            ) : null}
          </div>
          {pwOpen ? (
            <form className="auth-form profile-pw-form" onSubmit={savePassword}>
              <label>
                Senha atual
                <PasswordInput value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" required disabled={pwState.loading} />
              </label>
              <label>
                Senha nova
                <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required disabled={pwState.loading} />
              </label>
              <label>
                Repita a senha
                <PasswordInput value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} autoComplete="new-password" minLength={8} required disabled={pwState.loading} />
              </label>
              {pwState.error ? <p className="auth-error" role="alert">{pwState.error}</p> : null}
              <div className="profile-pw-actions">
                <button type="button" className="btn" onClick={() => { setPwOpen(false); setPwState({}); }} disabled={pwState.loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={pwState.loading}>
                  {pwState.loading ? "Salvando…" : "Salvar senha"}
                </button>
              </div>
            </form>
          ) : null}
          {pwState.ok ? <p className="auth-success" role="status">{pwState.ok}</p> : null}
          {BILLING_UI_ENABLED ? (
            <div className="profile-account-row">
              <div>
                <span className="profile-account-label">Assinatura</span>
                <strong>Plano, pagamento e cancelamento</strong>
              </div>
              <Link className="btn" to="/conta/assinatura">
                Minha assinatura
              </Link>
            </div>
          ) : null}
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Sessão</span>
              <strong>Conectado neste aparelho</strong>
            </div>
            <button type="button" className="btn profile-logout" onClick={() => void askLogout()} disabled={loggingOut}>
              {loggingOut ? "Saindo…" : "Sair da conta"}
            </button>
          </div>
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Seus dados</span>
              <strong>Baixe uma cópia em JSON (perfil, leitura e envios).</strong>
            </div>
            <button type="button" className="btn" onClick={() => void downloadData()} disabled={accountBusy !== null}>
              {accountBusy === "export" ? "Preparando…" : "Baixar meus dados"}
            </button>
          </div>
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Arquivos</span>
              <strong>Fotos, livros importados e textos enviados, em um ZIP.</strong>
            </div>
            <button type="button" className="btn" onClick={() => void downloadFiles()} disabled={accountBusy !== null}>
              {accountBusy === "files" ? "Preparando…" : "Baixar arquivos"}
            </button>
          </div>
          {accountOk ? <p className="auth-success" role="status">{accountOk}</p> : null}
          {accountError ? <p className="auth-error" role="alert">{accountError}</p> : null}
          <div className="profile-account-row">
            <div>
              <span className="profile-account-label">Excluir conta</span>
              <strong>Apaga a conta, os livros importados, as conversas e os arquivos.</strong>
            </div>
            <button type="button" className="btn" onClick={() => setDeleteOpen((open) => !open)} disabled={accountBusy !== null}>
              Excluir conta
            </button>
          </div>
          {deleteOpen ? (
            <form className="auth-form profile-pw-form" onSubmit={removeAccount}>
              <label>
                Senha atual
                <PasswordInput
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={accountBusy !== null}
                />
              </label>
              <div className="profile-pw-actions">
                <button type="button" className="btn" onClick={() => { setDeleteOpen(false); setDeletePassword(""); }} disabled={accountBusy !== null}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={accountBusy !== null}>
                  {accountBusy === "delete" ? "Excluindo…" : "Excluir definitivamente"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </section>
      </>
      ) : null}

      {dirty ? (
        <div className="profile-savebar" role="region" aria-label="Alterações não salvas">
          <span>{saveError || "Você tem alterações não salvas."}</span>
          <div>
            <button type="button" className="btn" onClick={discard} disabled={saving}>
              Descartar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      ) : savedFlash ? (
        <div className="profile-savebar is-saved" role="status">
          <span>✓ Alterações salvas</span>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}

/** Personagens no perfil antes do "Ver todos". */
const TALKS_PREVIEW = 6;

/** Conquistas visíveis antes do "Ver todas": uma fileira na grade larga, três no celular. */
const BADGES_PREVIEW = 6;
