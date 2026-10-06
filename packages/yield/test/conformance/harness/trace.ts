/**
 * Trace recording for the semantic conformance harness (ported from the Solid
 * fork's `packages/web/test/conformance/harness/trace.ts`, D-039).
 *
 * A trace is an ordered list of plain strings — one externally observable
 * event each — so traces diff line by line and stay reviewable inline in
 * scenario files. Nothing here records object addresses, timings or runtime
 * internals: owners get logical labels, tasks get `label#n` flight names in
 * creation order, errors print as `Class(message)`.
 *
 * Event grammar (`<kind> <label>[ = <value>]`):
 *
 *   ## <step>                 step boundary written by the driver
 *   read <signal> = v         an instrumented signal read returned v
 *   read <signal> ! Err(m)    ... or threw (pending reads print `pending`)
 *   write <signal> = v        an instrumented setter committed v
 *   run <label>               a computation / component / handler body ran
 *   cleanup <label>           an `onCleanup` registered by `h.cleanup` ran
 *   owner <label> = <owner>   the owner current at that point, by label
 *   task <label#n> = input    a controlled task (deferred) started
 *   settle <label#n> = v      the driver resolved that flight
 *   reject <label#n> = Err    the driver rejected that flight
 *   value <label> = v         a value the scenario chose to observe
 *   caught <boundary> = Err   an error boundary received an error
 *   html = <markup>           rendered output at an explicit point
 *   <kind> ...                anything else a scenario logs via `h.log`
 */
import type * as SolidModule from "solid-js";
import { READ } from "solid-yield/internal";

type Solid = typeof SolidModule;
/** The library module the scenario's environment resolved (client, server). */
type Lib = typeof import("solid-yield");

/**
 * Typed failures shared by every source of a scenario (same class identity).
 * Each carries a literal `kind` (D-034), which the trace never prints.
 */
export class NotFound extends Error {
  override name = "NotFound";
  readonly kind = "not-found" as const;
}
export class Forbidden extends Error {
  override name = "Forbidden";
  readonly kind = "forbidden" as const;
}

export function format(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "function") return "[fn]";
  if (value instanceof Error) {
    if (value.name === "NotReadyError" || value.constructor?.name === "NotReadyError")
      return "pending";
    return `${value.name || value.constructor.name}(${value.message})`;
  }
  if (typeof value === "object" && value !== null) {
    if (typeof (value as Node).nodeType === "number") {
      return `<${((value as Element).localName ?? "#node").toLowerCase()}>`;
    }
    return JSON.stringify(value, (_key, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map(k => [k, v[k]])
          )
        : v
    );
  }
  return JSON.stringify(value);
}

interface Flight {
  name: string;
  settled: boolean;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

/**
 * One run's recorder: owns the trace, the owner labels and the controlled
 * task flights. The scenario source sees it through `probe()` (imported as
 * the `conformance` module); the driver sees it through `controller()`.
 */
export class Recorder {
  readonly events: string[] = [];
  private owners = new WeakMap<object, string>();
  private anonymous = 0;
  private flightCounts = new Map<string, number>();
  readonly flights = new Map<string, Flight>();

  push(kind: string, label: string, ...value: [] | [unknown]): void {
    this.events.push(value.length ? `${kind} ${label} = ${format(value[0])}` : `${kind} ${label}`);
  }

  raw(line: string): void {
    this.events.push(line);
  }

  ownerLabel(owner: object | null | undefined): string {
    if (!owner) return "none";
    let label = this.owners.get(owner);
    if (!label) this.owners.set(owner, (label = `anon#${++this.anonymous}`));
    return label;
  }

  nameOwner(owner: object | null | undefined, label: string): void {
    if (!owner) throw new Error(`[conformance] h.owner("${label}") called with no owner`);
    this.owners.set(owner, label);
  }

  startFlight(label: string, input: unknown[]): Promise<unknown> {
    const n = (this.flightCounts.get(label) ?? 0) + 1;
    this.flightCounts.set(label, n);
    const name = `${label}#${n}`;
    let resolve!: (v: unknown) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // A superseded flight that is later rejected must not surface as an
    // unhandled rejection of the harness itself; consumers still see it.
    promise.catch(() => {});
    this.flights.set(name, { name, settled: false, resolve, reject });
    this.push("task", name, ...(input.length ? [input.length === 1 ? input[0] : input] : []));
    return promise;
  }
}

/**
 * The instrumentation API a scenario source imports:
 *
 *   import { h } from "conformance";
 *
 * Everything is ordinary Solid underneath, so the same events appear for the
 * handwritten reference and the library source; only the reactive code
 * between them differs. Two helpers exist for the library dialect only:
 *
 * - `yield* h.$signal(label, init)` is `yield* $signal(init)` with traced
 *   reads and writes: the source it returns reads the library signal's
 *   accessor and records the value; its setter returns the library's receipt
 *   (a write happens at `yield* set(v)`, D-021) and records the committed
 *   value. It is a creation, so only a setup may delegate to it.
 * - `h.peek(source)` reads a library source once, for a trace label only (a
 *   row's setup naming its row: `h.peek(item.label)`). A setup never reads
 *   (D-042), so the harness reads outside routine code: in a plain computation
 *   under a detached, id-less root, which neither tracks the setup nor
 *   consumes a hydration id. Routine semantics never depend on it.
 */
export function probe(recorder: Recorder, solid: Solid, lib?: Lib) {
  const library = () => {
    if (!lib) throw new Error("[conformance] library helpers need the solid-yield module");
    return lib;
  };
  const h = {
    /** Instrumented `createSignal` (the reference source): reads and writes are traced. */
    signal<T>(label: string, initial: T, options?: Record<string, unknown>) {
      const [raw, set] = (solid.createSignal as any)(initial, options) as [() => T, (v: any) => T];
      const read = (() => {
        let value: T;
        try {
          value = raw();
        } catch (error) {
          recorder.raw(`read ${label} ! ${format(error)}`);
          throw error;
        }
        recorder.push("read", label, value);
        return value;
      }) as typeof raw;
      const write = (next: T | ((prev: T) => T)) =>
        set((prev: T) => {
          const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
          recorder.push("write", label, value);
          return value;
        });
      return [read, write] as const;
    },
    /** Instrumented `$signal` (the library source): `yield* h.$signal(label, init)`. */
    *$signal<T>(label: string, initial: T): Generator<any, [any, any], any> {
      const b = library();
      const [source, set] = (yield* b.$signal(initial)) as [any, (v: any) => any];
      const read: any = () => {
        let value: T;
        try {
          value = source();
        } catch (error) {
          recorder.raw(`read ${label} ! ${format(error)}`);
          throw error;
        }
        recorder.push("read", label, value);
        return value;
      };
      // a library source: the read the runtime performs, and its iterator
      read[READ] = read;
      read[Symbol.iterator] = source[Symbol.iterator];
      const write = (next: T | ((prev: T) => T)) =>
        set((prev: T) => {
          const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
          recorder.push("write", label, value);
          return value;
        });
      return [read, write];
    },
    /** Read a library source once, for a trace label (see above). */
    peek<T>(source: unknown): T {
      return solid.runWithOwner(null, () =>
        solid.createRoot(dispose => {
          try {
            const memo = solid.createMemo(
              () => (source as any)[Symbol.iterator]().next().value as T
            );
            return memo();
          } finally {
            dispose();
          }
        })
      );
    },
    /** Mark that a body executed. */
    run(label: string): void {
      recorder.push("run", label);
    },
    /** Register a traced `onCleanup` on the current owner. */
    cleanup(label: string): void {
      solid.onCleanup(() => recorder.push("cleanup", label));
    },
    /** Name the current owner; later `where()` calls print this label. */
    owner(label: string): void {
      recorder.nameOwner(solid.getOwner(), label);
    },
    /** Record which (labelled) owner is current right now. */
    where(label: string): void {
      recorder.raw(`owner ${label} = ${recorder.ownerLabel(solid.getOwner())}`);
    },
    /** Start a controlled task: a deferred the driver settles explicitly. */
    task<T = unknown>(label: string, ...input: unknown[]): Promise<T> {
      return recorder.startFlight(label, input) as Promise<T>;
    },
    /** Observe a value. */
    value(label: string, value: unknown): void {
      recorder.push("value", label, value);
    },
    /** An error boundary fallback received an error. */
    caught(label: string, error: unknown): void {
      recorder.push("caught", label, error);
    },
    log(kind: string, label: string, ...value: [] | [unknown]): void {
      recorder.push(kind, label, ...value);
    }
  };
  return h;
}

export type Probe = ReturnType<typeof probe>;

/** Settle every queued microtask (a zero-length macrotask turn, not a sleep). */
export function drain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/** Driver-side control over a run's controlled tasks. */
export function controller(recorder: Recorder) {
  function flight(name: string): Flight {
    const f = recorder.flights.get(name);
    if (!f) {
      throw new Error(
        `[conformance] no task flight "${name}" (started: ${[...recorder.flights.keys()].join(", ") || "none"})`
      );
    }
    if (f.settled) throw new Error(`[conformance] task flight "${name}" already settled`);
    f.settled = true;
    return f;
  }
  return {
    /** Resolve a flight by name (`load#2`); does not flush. */
    resolve(name: string, value?: unknown): void {
      const f = flight(name);
      recorder.push("settle", name, ...(value === undefined ? [] : [value]));
      f.resolve(value);
    },
    /** Reject a flight by name; does not flush. */
    reject(name: string, error: unknown): void {
      const f = flight(name);
      recorder.push("reject", name, error);
      f.reject(error);
    },
    /** Names of flights not yet settled, in start order. */
    pending(): string[] {
      return [...recorder.flights.values()].filter(f => !f.settled).map(f => f.name);
    }
  };
}
