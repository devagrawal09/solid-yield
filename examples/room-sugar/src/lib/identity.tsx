"use yield";
import {
  $effect,
  $signal,
  createContext,
  type Element,
  type Props,
  type Source
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
const IdentityContext = createContext<Source<Identity | null>, "IdentityCtx">(undefined, {
  name: "IdentityCtx"
});
export { IdentityContext as IdentityCtx };
export const IdentityProvider = function IdentityProvider(
  props: Props<{
    children: Element;
  }>
) {
  const [me, setMe] = $signal<Identity | null>(null);
  $effect(
    function () {},
    function () {
      if (!isServer) setMe(mint());
    }
  );
  return (
    <>
      {IdentityContext.provide({
        value: me,
        children: function () {
          return <>{props.children}</>;
        }
      })}
    </>
  );
};
export function useIdentity() {
  return IdentityContext();
}
