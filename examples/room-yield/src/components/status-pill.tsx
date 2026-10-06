// Wire state for the UI (examples/room's status pill, as yield components). `live`
// erases deaths from the value stream on purpose, so `onstatus` on the
// returned iterable is the only place to learn them. `watch(src)` wires that
// hook to `$signal`s through an `$event` (the transport calls it later);
// <StatusPill> shows them.
//
// The hook is set only in the browser: the server half's call is a promise
// of the branded iterable (in process there is no wire).
import { component, $event, $signal, type Source, type Props, view } from "solid-yield";
import { isServer } from "@solidjs/web";
import type { LiveSource, LiveSourceStatus } from "@solidjs/web/server-functions";

export type Status = LiveSourceStatus | "connecting";

export interface Wire {
  status: Source<Status>;
  deaths: Source<number>;
  error: Source<unknown>;
}

/** `const wire = yield* createWire()` in a setup. */
export function* createWire() {
  const [status, setStatus] = yield* $signal<Status>("connecting");
  const [deaths, setDeaths] = yield* $signal(0);
  const [error, setError] = yield* $signal<unknown>(undefined);
  let current: object | undefined;
  const report = $event(function* (update: {
    token: object;
    state: LiveSourceStatus;
    error: unknown;
  }) {
    if (current !== update.token) return;
    yield* setStatus(update.state);
    if (update.state === "reconnecting") {
      yield* setDeaths(n => n + 1);
      yield* setError(update.error);
    }
  });
  return {
    status,
    deaths,
    error,
    // Called from inside a memo, so it must not write itself — the hook
    // fires later, from the transport. The token keeps the pill on the
    // CURRENT iterable (a room switch hands the memo a new one).
    watch<T>(src: LiveSource<T>): LiveSource<T> {
      if (!isServer) {
        const token = (current = {});
        src.onstatus = (state, err) => report({ token, state, error: err });
      }
      return src;
    }
  };
}

export type WireControl =
  ReturnType<typeof createWire> extends Generator<unknown, infer W> ? W : never;

const StatusPill = component(function* StatusPill(props: Props<{ wire: Wire; label?: string }>) {
  const deaths = props.wire.deaths;
  return view(function* () {
    return (
      <span
        class={`pill pill-${yield* props.wire.status}`}
        title={describe(yield* props.wire.error)}
      >
        <span class="dot" />
        {(yield* props.label) ? `${yield* props.label} · ` : ""}
        {yield* props.wire.status}
        {(yield* deaths) > 0
          ? ` (${yield* deaths} reconnect${(yield* deaths) === 1 ? "" : "s"})`
          : ""}
      </span>
    );
  });
});
export default StatusPill;

function describe(error: unknown): string {
  if (error == null) return "";
  return error instanceof Error ? error.message : String(error);
}
