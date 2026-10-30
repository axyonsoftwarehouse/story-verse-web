import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { refreshAuthSession } from "../../lib/auth";
import { createGroup, updateGroup, type Group, type GroupFields } from "../../lib/groups";
import { prepareImage, uploadGroupPhoto } from "../../lib/profileMedia";
import { bookOptions } from "./groupHelpers";
import { GroupAvatar } from "./GroupParts";
import { GIcon } from "./groupIcons";

const DESCRIPTION_MAX = 300;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível salvar o grupo.";
}

/**
 * Criar ou editar um grupo (`group` presente = edição, só para o dono): foto, nome, descrição,
 * quem pode entrar e, opcional, o livro do clube com a meta.
 */
export function GroupForm({
  group,
  presetBook,
  presetTitle,
  onClose,
  onSaved,
}: {
  group?: Group;
  presetBook?: string | null;
  presetTitle?: string | null;
  onClose: () => void;
  onSaved: (g: Group) => void;
}) {
  const books = useMemo(() => bookOptions(), []);
  const [name, setName] = useState(group?.name ?? (presetTitle ? `Clube: ${presetTitle}`.slice(0, 60) : ""));
  const [description, setDescription] = useState(group?.description ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(group?.visibility ?? "public");
  const [bookKey, setBookKey] = useState(group?.book_key ?? presetBook ?? "");
  const [goalChapter, setGoalChapter] = useState(group?.goal_chapter ? String(group.goal_chapter) : "");
  const [goalUntil, setGoalUntil] = useState(group?.goal_until ?? "");
  const [photo, setPhoto] = useState<string | null>(group?.photo_url ?? null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const list = [...books];
    const known = group?.book_key ?? presetBook;
    if (known && !list.some((b) => b.key === known)) {
      list.unshift({ key: known, title: group?.book_title ?? presetTitle ?? known, cover: group?.book_cover ?? undefined });
    }
    return list;
  }, [books, group, presetBook, presetTitle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const blob = await prepareImage(file, "avatar");
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(message(err));
    }
  }

  function removePhoto() {
    setPhotoBlob(null);
    setPhotoPreview(null);
    setPhoto(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let photoUrl = photo;
      if (photoBlob) photoUrl = await uploadGroupPhoto(await refreshAuthSession(), photoBlob);
      const book = options.find((b) => b.key === bookKey);
      const fields: GroupFields = {
        name: name.trim(),
        description: description.trim() || null,
        photoUrl,
        visibility,
        bookKey: book?.key ?? null,
        bookTitle: book?.title ?? null,
        bookCover: book?.cover ?? null,
        goalChapter: book && goalChapter ? Number(goalChapter) : null,
        goalUntil: book && goalUntil ? goalUntil : null,
      };
      onSaved(group ? await updateGroup(group.id, fields) : await createGroup(fields));
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  const shownPhoto = photoPreview ?? photo;

  return createPortal(
    <div className="about-backdrop group-sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="group-sheet group-form" role="dialog" aria-modal="true" aria-labelledby="group-form-title" onSubmit={submit}>
        <header className="group-sheet-head">
          <h2 id="group-form-title">{group ? "Editar grupo" : "Novo grupo"}</h2>
          <button type="button" className="group-icon-btn" onClick={onClose} aria-label="Fechar" disabled={busy}>
            {GIcon.close}
          </button>
        </header>

        <div className="group-form-photo">
          <button type="button" className="group-photo-pick" onClick={() => fileRef.current?.click()} aria-label="Escolher a foto do grupo">
            <GroupAvatar id={group?.id ?? (name || "novo")} name={name || "?"} photo={shownPhoto} size="xl" />
            <span className="group-photo-badge">{GIcon.camera}</span>
          </button>
          <div className="group-form-photo-text">
            <strong>Foto do grupo</strong>
            <span>Aparece na lista e no topo da conversa.</span>
            {shownPhoto ? (
              <button type="button" className="group-text-btn" onClick={removePhoto}>
                Tirar foto
              </button>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />
        </div>

        <label className="group-field">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={60} required placeholder="Ex.: Clube do Drácula" />
        </label>

        <label className="group-field">
          <span>
            Descrição <small>{description.length}/{DESCRIPTION_MAX}</small>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder="Sobre o que o grupo conversa, o ritmo de leitura, as regras…"
          />
        </label>

        <fieldset className="group-field group-choice">
          <legend>Quem pode entrar</legend>
          <label className={visibility === "public" ? "is-on" : ""}>
            <input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
            <span className="group-choice-icon">{GIcon.users}</span>
            <span>
              <strong>Público</strong>
              <small>Aparece em Explorar; qualquer leitor entra.</small>
            </span>
          </label>
          <label className={visibility === "private" ? "is-on" : ""}>
            <input type="radio" name="visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} />
            <span className="group-choice-icon">{GIcon.lock}</span>
            <span>
              <strong>Privado</strong>
              <small>Só entra quem recebe o link de convite.</small>
            </span>
          </label>
        </fieldset>

        <label className="group-field">
          <span>Livro do clube (opcional)</span>
          <select value={bookKey} onChange={(e) => setBookKey(e.target.value)}>
            <option value="">Sem livro: só conversa</option>
            {options.map((b) => (
              <option key={b.key} value={b.key}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        {bookKey ? (
          <div className="group-field-row">
            <label className="group-field">
              <span>Meta: até o capítulo</span>
              <input type="number" min={1} max={10000} value={goalChapter} onChange={(e) => setGoalChapter(e.target.value)} placeholder="Ex.: 5" />
            </label>
            <label className="group-field">
              <span>Até o dia</span>
              <input type="date" value={goalUntil} onChange={(e) => setGoalUntil(e.target.value)} />
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="group-sheet-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 3}>
            {busy ? "Salvando…" : group ? "Salvar" : "Criar grupo"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
