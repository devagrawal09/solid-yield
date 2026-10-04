// In-page fiber event log — the demo's "network tab". Writes happen from
// inside Effect programs (Effect.sync / finalizers), which run on Effect's
// scheduler outside any Solid transaction, so each entry is its own small
// `$event` and commits immediately even while a checkout is in flight.
//
// The log is block state: `createLog()` (in the app's setup) creates the
// store and its writers, and registers the writer `log()` hands entries to.
import { $cleanup, $event, $store } from "@solidjs/blocks";

export type LogKind = "start" | "success" | "retry" | "interrupt" | "compensate" | "error";

export interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  message: string;
}

let nextId = 0;
const start = performance.now();
let sink: ((entry: LogEntry) => unknown) | undefined;

/** The log's store and its `clear` handler, for a setup: `const log = yield* createLog()`. */
export function* createLog() {
  const [entries, setEntries] = yield* $store<LogEntry[]>([]);
  const append = $event(function* (entry: LogEntry) {
    yield* setEntries(list => {
      list.push(entry);
      if (list.length > 100) list.splice(0, list.length - 100);
    });
  });
  const clear = $event(function* () {
    yield* setEntries(list => {
      list.length = 0;
    });
  });
  sink = append;
  yield* $cleanup(() => {
    if (sink === append) sink = undefined;
  });
  return { entries, clear };
}

export type Log = ReturnType<typeof createLog> extends Generator<unknown, infer L> ? L : never;

/** Log an entry (from Effect programs): handed to the app's log, if mounted. */
export function log(kind: LogKind, message: string) {
  const time = ((performance.now() - start) / 1000).toFixed(2) + "s";
  sink?.({ id: nextId++, time, kind, message });
}
