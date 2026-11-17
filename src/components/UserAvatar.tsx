import { PersonAvatar } from "./PersonAvatar";
import { type Cosmetics } from "../lib/shop";
import { type SupabaseUser } from "../lib/auth";
import { displayNameOf, metaString } from "../lib/userMeta";

/** Foto enviada, senão o avatar pronto, senão a inicial do nome sobre a cor da conta. */
export function UserAvatar({ user, className, cosmetics, animate }: { user: SupabaseUser; className: string; cosmetics?: Cosmetics | null; animate?: boolean }) {
  return (
    <PersonAvatar
      id={user.id}
      name={displayNameOf(user)}
      avatar={user.user_metadata?.avatar}
      photo={metaString(user, "photo")}
      className={className}
      cosmetics={cosmetics}
      animate={animate}
    />
  );
}
