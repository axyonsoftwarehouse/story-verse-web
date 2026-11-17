import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { apiEnabled } from "../../lib/backend";
import { AVATARS, AvatarArt, findAvatar } from "../../avatars";
import { equipShopItem } from "../../lib/shop";
import { clearOwnShopCover } from "../shop/useOwnProfileExtras";
import { prepareImage, removeProfileImage, uploadProfileImage, type MediaKind } from "../../lib/profileMedia";
import { updateProfileData, type SupabaseSession, type SupabaseUser } from "../../lib/auth";
import { BIO_MAX, bioLength, bioProblem, normalizeBio } from "../../lib/profileBio";
import { displayNameOf, metaString } from "../../lib/userMeta";
import { UserAvatar } from "../../components/UserAvatar";

/** Rascunho de uma imagem do perfil: a salva, uma nova (ainda não enviada) ou removida. */
type ImageDraft = { url: string | null; blob: Blob | null };

/** Janela "Editar perfil": capa, foto, nome, biografia e avatar, com prévia e salvar na própria janela. */
export function EditProfileModal({
  session,
  onSaved,
  onClose,
}: {
  session: SupabaseSession;
  onSaved: (session: SupabaseSession) => void;
  onClose: () => void;
}) {
  const savedName = displayNameOf(session.user);
  const savedAvatar = findAvatar(session.user.user_metadata?.avatar)?.id ?? null;
  const savedPhoto = metaString(session.user, "photo");
  const savedCover = metaString(session.user, "cover");
  const savedBio = metaString(session.user, "bio") ?? "";
  const [name, setName] = useState(savedName);
  const [bio, setBio] = useState(savedBio);
  const [avatar, setAvatar] = useState<string | null>(savedAvatar);
  const [photo, setPhoto] = useState<ImageDraft>({ url: savedPhoto, blob: null });
  const [cover, setCover] = useState<ImageDraft>({ url: savedCover, blob: null });
  const [preparing, setPreparing] = useState<MediaKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim().slice(0, 60);
  const cleanBio = normalizeBio(bio);
  const bioError = bioProblem(cleanBio);
  const changed =
    trimmed !== savedName ||
    cleanBio !== savedBio ||
    avatar !== savedAvatar ||
    photo.blob !== null ||
    photo.url !== savedPhoto ||
    cover.blob !== null ||
    cover.url !== savedCover;
  const busy = saving || preparing !== null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  // Prévias locais (blob:) liberadas ao trocar ou fechar.
  useEffect(() => () => void (photo.blob && photo.url && URL.revokeObjectURL(photo.url)), [photo]);
  useEffect(() => () => void (cover.blob && cover.url && URL.revokeObjectURL(cover.url)), [cover]);

  async function pick(kind: MediaKind, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setPreparing(kind);
    try {
      const blob = await prepareImage(file, kind);
      const draft = { url: URL.createObjectURL(blob), blob };
      if (kind === "avatar") setPhoto(draft);
      else setCover(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
    } finally {
      setPreparing(null);
    }
  }

  /** Escolher avatar pronto (ou a inicial) tira a foto: a foto sempre tem prioridade. */
  function chooseAvatar(id: string | null) {
    setAvatar(id);
    setPhoto({ url: null, blob: null });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return setError("Informe um nome.");
    if (bioError) return setError(bioError);
    if (!changed) return onClose();
    setSaving(true);
    setError("");
    try {
      const imageUrl = async (kind: MediaKind, draft: ImageDraft, saved: string | null) => {
        if (draft.blob) return uploadProfileImage(session, kind, draft.blob);
        if (!draft.url && saved) await removeProfileImage(session, kind);
        return draft.url;
      };
      const photoUrl = await imageUrl("avatar", photo, savedPhoto);
      const coverUrl = await imageUrl("cover", cover, savedCover);
      const saved = await updateProfileData(session, {
        name: trimmed,
        avatar,
        photo: photoUrl,
        cover: coverUrl,
        bio: cleanBio,
      });
      // Capa enviada nova: a comprada sai de cena para a enviada aparecer (a pessoa pode reequipar a comprada na loja).
      if (apiEnabled && cover.blob) {
        try {
          await equipShopItem(session, "cover", null);
          clearOwnShopCover(session.user.id);
        } catch {
          /* o perfil já foi salvo; a capa comprada continua equipada */
        }
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  }

  const preview: SupabaseUser = {
    ...session.user,
    user_metadata: { ...session.user.user_metadata, name: trimmed || savedName, avatar, photo: photo.url },
  };
  const initialUser = { ...preview, user_metadata: { ...preview.user_metadata, avatar: null, photo: null } };
  const coverStyle = cover.url ? ({ backgroundImage: `url("${cover.url}")` } as React.CSSProperties) : undefined;
  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form
        className="auth-card edit-profile"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onSubmit={save}
      >
        <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar" disabled={saving}>
          {Icon.close}
        </button>
        <h2 id="edit-profile-title">Editar perfil</h2>

        <div className={`edit-cover ${cover.url ? "has-cover" : ""}`} style={coverStyle}>
          <div className="edit-cover-actions">
            <label className={`btn edit-media-btn ${busy ? "is-disabled" : ""}`}>
              {Icon.camera}
              {preparing === "cover" ? "Preparando…" : cover.url ? "Trocar capa" : "Adicionar capa"}
              <input type="file" accept="image/*" onChange={(e) => void pick("cover", e)} disabled={busy} />
            </label>
            {cover.url ? (
              <button type="button" className="btn edit-media-btn" onClick={() => setCover({ url: null, blob: null })} disabled={busy}>
                Remover
              </button>
            ) : null}
          </div>
          <div className="edit-profile-preview">
            <UserAvatar user={preview} className="profile-avatar" />
            <label className={`edit-photo-btn ${busy ? "is-disabled" : ""}`} title="Enviar foto de perfil">
              {preparing === "avatar" ? <span className="spinner" aria-hidden="true" /> : Icon.camera}
              <span className="sr-only">Enviar foto de perfil</span>
              <input type="file" accept="image/*" onChange={(e) => void pick("avatar", e)} disabled={busy} />
            </label>
          </div>
        </div>
        <div className="edit-photo-row">
          {photo.url ? (
            <button type="button" className="inline-link" onClick={() => setPhoto({ url: null, blob: null })} disabled={busy}>
              Remover foto de perfil
            </button>
          ) : (
            <span>Toque na câmera para enviar uma foto, ou escolha um avatar abaixo.</span>
          )}
        </div>

        <label className="edit-profile-name">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" disabled={saving} />
        </label>

        <label className="edit-profile-name edit-profile-bio">
          <span>Biografia</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={BIO_MAX * 2}
            placeholder="Conte um pouco sobre você e o que gosta de ler"
            aria-describedby="edit-profile-bio-count"
            aria-invalid={bioError ? true : undefined}
            disabled={saving}
          />
          <small id="edit-profile-bio-count" className={bioError ? "is-over" : undefined} aria-live="polite">
            {bioError ?? `${bioLength(cleanBio)}/${BIO_MAX}`}
          </small>
        </label>

        <span className="edit-profile-label">Avatar</span>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatares">
          <button
            type="button"
            role="radio"
            aria-checked={!photo.url && avatar === null}
            className={`avatar-choice ${!photo.url && avatar === null ? "is-on" : ""}`}
            onClick={() => chooseAvatar(null)}
            disabled={busy}
          >
            <UserAvatar user={initialUser} className="avatar-choice-art" />
            <span>Inicial</span>
          </button>
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={!photo.url && avatar === a.id}
              className={`avatar-choice ${!photo.url && avatar === a.id ? "is-on" : ""}`}
              onClick={() => chooseAvatar(a.id)}
              disabled={busy}
            >
              <span className="avatar-choice-art has-art" style={{ "--c": a.color } as React.CSSProperties} aria-hidden="true">
                <AvatarArt avatar={a} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div className="edit-profile-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !changed || Boolean(bioError)}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}