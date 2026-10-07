"use yield";
import { $event, $signal, type Source, type Props } from "solid-yield";
import { isServer } from "@solidjs/web";
import type { LiveSource, LiveSourceStatus } from "@solidjs/web/server-functions";
export type Status = LiveSourceStatus | "connecting";
export interface Wire {
  status: Source<Status>;
  deaths: Source<number>;
  error: Source<unknown>;
}
export function createWire() {
  const [status, setStatus] = $signal<Status>("connecting");
  const [deaths, setDeaths] = $signal(0);
  const [error, setError] = $signal<unknown>(undefined);
  let current: object | undefined;
  const report = $event(function (update: {
    token: object;
    state: LiveSourceStatus;
    error: unknown;
  }) {
    if (current !== update.token) return;
    setStatus(update.state);
    if (update.state === "reconnecting") {
      setDeaths(n => n + 1);
      setError(update.error);
    }
  });
  return {
    status,
    deaths,
    error,
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
const StatusPill = function StatusPill(
  props: Props<{
    wire: Wire;
    label?: string;
  }>
) {
  const deaths = props.wire.deaths;
  return (
    <span class={`pill pill-${props.wire.status}`} title={describe(props.wire.error)}>
      <span class="dot" />
      {props.label ? `${props.label} · ` : ""}
      {props.wire.status}
      {deaths() > 0 ? ` (${deaths()} reconnect${deaths() === 1 ? "" : "s"})` : ""}
    </span>
  );
};
export default StatusPill;
function describe(error: unknown): string {
  if (error == null) return "";
  return error instanceof Error ? error.message : String(error);
}
