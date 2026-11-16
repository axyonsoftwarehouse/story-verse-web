import type { StoryCharacter } from "../data/types";

export function shortNameOf(c: StoryCharacter): string {
  return c.shortName ?? c.name;
}
