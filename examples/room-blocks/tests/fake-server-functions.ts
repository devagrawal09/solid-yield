// A deterministic, in-process stand-in for `@solidjs/web/server-functions`
// (aliased in vitest.config.ts for both examples/room and this twin): the
// `"use server"` bodies run in the test, and `live` keeps the contract the
// apps rely on — each call is an iterable of values, `onstatus` reports
// "connected" per (re)connect and "reconnecting" per death, and a death
// (`dropAll()`, what the chaos route does) re-invokes the source rather than
// failing. An undeclared stream (`GET` over an async generator) dies with
// an error instead, as over the wire.
//
// The real transport (SSR, the document's answers adopted at hydration,
// event streams, morphs) is covered by the browser check.
type Status = "connected" | "reconnecting" | "closed";
interface Connection {
  drop(): void;
}

const open = new Set<Connection>();

/** Kill every open live / streamed call; returns how many there were. */
export function dropAll(): number {
  const all = [...open];
  open.clear();
  for (const c of all) c.drop();
  return all.length;
}

const DROPPED = Symbol("dropped");

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return v != null && typeof (v as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function";
}

/** One connection's values: a stream's, or a promise's answer (then held open). */
function connect(answer: unknown): AsyncIterator<unknown> {
  if (isAsyncIterable(answer)) return answer[Symbol.asyncIterator]();
  let sent = false;
  return {
    async next() {
      if (sent) return new Promise<IteratorResult<unknown>>(() => {});
      sent = true;
      return { done: false, value: await answer };
    },
    async return() {
      return { done: true, value: undefined };
    }
  };
}

export function live<A extends unknown[], R>(fn: (...args: A) => R) {
  return (...args: A) => {
    const iterable: AsyncIterable<unknown> & {
      onstatus?: (state: Status, error?: unknown) => void;
    } = {
      [Symbol.asyncIterator]() {
        let inner: AsyncIterator<unknown> | undefined;
        let stopped = false;
        let fresh = true;
        let wake: (() => void) | undefined;
        const connection: Connection = { drop: () => wake?.() };
        return {
          async next(): Promise<IteratorResult<unknown>> {
            while (!stopped) {
              if (!inner) {
                inner = connect(fn(...args));
                fresh = true;
              }
              open.add(connection);
              const dropped = new Promise<typeof DROPPED>(r => (wake = () => r(DROPPED)));
              const r = await Promise.race([inner.next(), dropped]);
              if (stopped) break;
              if (r === DROPPED) {
                void inner.return?.();
                inner = undefined;
                iterable.onstatus?.("reconnecting", new Error("connection dropped"));
                continue;
              }
              if (r.done) {
                open.delete(connection);
                iterable.onstatus?.("closed");
                return r;
              }
              if (fresh) {
                fresh = false;
                iterable.onstatus?.("connected");
              }
              return r;
            }
            return { done: true, value: undefined };
          },
          async return(): Promise<IteratorResult<unknown>> {
            stopped = true;
            open.delete(connection);
            wake?.();
            void inner?.return?.();
            iterable.onstatus?.("closed");
            return { done: true, value: undefined };
          }
        };
      }
    };
    return iterable;
  };
}

export function GET<A extends unknown[], R>(fn: (...args: A) => R) {
  return (...args: A): R => {
    const answer = fn(...args);
    if (!isAsyncIterable(answer)) return answer;
    // An undeclared stream: a death is an error.
    const source = answer;
    return {
      [Symbol.asyncIterator]() {
        const it = source[Symbol.asyncIterator]();
        let wake: (() => void) | undefined;
        const connection: Connection = { drop: () => wake?.() };
        return {
          async next() {
            open.add(connection);
            const dropped = new Promise<typeof DROPPED>(r => (wake = () => r(DROPPED)));
            const r = await Promise.race([it.next(), dropped]);
            if (r === DROPPED) {
              void it.return?.();
              throw new Error("The stream was cut off");
            }
            if (r.done) open.delete(connection);
            return r;
          },
          async return() {
            open.delete(connection);
            void it.return?.();
            return { done: true, value: undefined };
          }
        };
      }
    } as R;
  };
}
