// Who this TAB is (examples/room's identity, as blocks). Identity is per tab
// (sessionStorage) so two tabs of the same browser are two members.
//
// It is a `$signal` provided through context, starting `null` — the value
// the server renders with — and minted by a `$settled` once the app has
// settled on the client, so the null→identity change flows through the
// graph: the composer enables, presence re-invokes and this tab joins.
import {
  $component,
  $settled,
  $signal,
  constant,
  createContext,
  type Element,
  type Props,
  view
} from "@solidjs/blocks";
import { isServer } from "@solidjs/web";
import type { Identity } from "./sources";

const ADJECTIVES = ["quick", "quiet", "bright", "brave", "calm", "keen", "warm", "wry"];
const ANIMALS = ["otter", "heron", "lynx", "finch", "badger", "gecko", "tapir", "wren"];

function mint(): Identity {
  const key = "room:me";
  const stored = sessionStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
  const identity = {
    id: Math.random().toString(36).slice(2, 10),
    name: `${pick(ADJECTIVES)}-${pick(ANIMALS)}`
  };
  sessionStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

/**
 * Outside an `IdentityProvider` there is no identity (the original throws; a
 * setup does not fail, so the default is "nobody": a constant source, D-060).
 */
const IdentityContext = createContext(constant<Identity | null>(null));

/** Holds this tab's identity for the tree below; mints it on the client once settled. */
export const IdentityProvider = $component(function* IdentityProvider(
  props: Props<{ children: Element }>
) {
  const [me, setMe] = yield* $signal<Identity | null>(null);
  yield* $settled(function* () {
    if (!isServer) yield* setMe(mint());
  });
  return view(function* () {
    return <IdentityContext value={me}>{yield* props.children}</IdentityContext>;
  });
});

/** This tab's identity — `null` on the server and until the client mints it. */
export function* useIdentity() {
  return yield* IdentityContext;
}
