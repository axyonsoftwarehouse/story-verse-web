import { useEffect, useState } from "react";
import { apiEnabled } from "../../lib/backend";
import { profileCoverUrl } from "../../lib/shop";
import { getPerson, type PersonProfile } from "../../lib/social";

export type OwnProfileExtras = Pick<PersonProfile, "cosmetics" | "shop_cover" | "badge_shelf">;
type State = { loaded: boolean; extras: OwnProfileExtras | null };

/** Último resultado por conta: reabrir o perfil não pisca a capa enquanto busca de novo. */
const cache = new Map<string, OwnProfileExtras>();

/**
 * Enfeites da loja do próprio perfil (moldura, insígnia, cor, capa comprada e estante), do mesmo
 * perfil público que os outros veem. `loaded` fica falso só enquanto a primeira busca não volta.
 * Sem a API, ou se a busca falhar, fica sem enfeites (o perfil volta a ser como antes).
 */
export function useOwnProfileExtras(userId: string): State {
  const [state, setState] = useState<State>(() => ({ loaded: !apiEnabled || cache.has(userId), extras: cache.get(userId) ?? null }));
  useEffect(() => {
    if (!apiEnabled) return;
    let alive = true;
    getPerson(userId)
      .then((p) => {
        const extras: OwnProfileExtras = { cosmetics: p.cosmetics, shop_cover: p.shop_cover, badge_shelf: p.badge_shelf };
        cache.set(userId, extras);
        if (alive) setState({ loaded: true, extras });
      })
      .catch(() => {
        if (alive) setState((cur) => ({ ...cur, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  return state;
}

/**
 * Capa do próprio perfil. Enquanto os enfeites carregam não mostra imagem nenhuma (nem a enviada,
 * que poderia piscar antes da comprada), mas guarda o espaço da capa se já existe uma enviada.
 */
export function ownProfileCover(state: State, uploaded: string | null): { url: string | null; reserve: boolean } {
  if (!state.loaded) return { url: null, reserve: Boolean(profileCoverUrl(null, uploaded)) };
  const url = profileCoverUrl(state.extras?.shop_cover, uploaded);
  return { url, reserve: Boolean(url) };
}
