// Who this TAB is (examples/room's identity, as yield components). Identity is per tab
// (sessionStorage) so two tabs of the same browser are two members.
//
// It is a `$signal` provided through context, starting `null` — the value
// the server renders with — and minted by an `$effect` (an empty compute: its
// effect phase runs once, after the first render, D-101) on the client, so the null→identity change flows through the
// graph: the composer enables, presence re-invokes and this tab joins.
import {
  component,
  $effect,
  $signal,
  createContext,
  type Element,
  type Props,
  type Source,
  view
} from "solid-yield";
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
 * Required (D-098): outside an `IdentityProvider` there is no identity, as
 * in the original (which throws there): a reader's component requires
 * `IdentityCtx`, and `NO_PROVIDER` is the run-time half. Its readers are the
 * room's components, below the router, which renders them as a foreign
 * hand-off; `foreign(Live, { provided: [IdentityCtx] })` (D-102) states that
 * this provider sits above the router. The provided value is a source of
 * `Identity | null`: its `null` is the identity the server renders with and
 * the client has until it mints one — no longer also "no provider".
 */
const IdentityContext = createContext<Source<Identity | null>, "IdentityCtx">();
export { IdentityContext as IdentityCtx };

/** Holds this tab's identity for the tree below; mints it on the client once mounted. */
export const IdentityProvider = component(function* IdentityProvider(
  props: Props<{ children: Element }>
) {
  const [me, setMe] = yield* $signal<Identity | null>(null);
  yield* $effect(
    function* () {},
    function* () {
      if (!isServer) yield* setMe(mint());
    }
  );
  return view(function* () {
    return (
      <>
        {
          yield* IdentityContext.provide({
            value: me,
            children: function* () {
              return <>{yield* props.children}</>;
            }
          })
        }
      </>
    );
  });
});

/** This tab's identity — `null` on the server and until the client mints it; read like a prop (a path). */
export function* useIdentity() {
  return yield* IdentityContext;
}
