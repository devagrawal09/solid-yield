"use yield";
import {
  $event,
  $memo,
  $optimistic,
  $optimisticStore,
  $signal,
  attempt,
  Errored,
  For,
  latestOf,
  Loading,
  readStore,
  Show,
  until,
  type EventHandler,
  type Path,
  type Reset,
  type Source,
  type Props
} from "solid-yield";
import type { RouteSectionProps } from "@solidjs/router";
import { useIdentity } from "~/lib/identity";
import { ArchiveError, ChaosError, DeliveryError, SendError } from "~/lib/errors";
import {
  archive,
  presence,
  roomCard,
  send,
  summary,
  transcript,
  type Activity,
  type Identity,
  type Member,
  type Message,
  type Presence,
  type RoomCard
} from "~/lib/sources";
import StatusPill, { createWire, type Wire } from "~/components/status-pill";
import { LiveError } from "~/lib/errors";
const ROOMS = ["lobby", "design", "infra", "random"];
const Live = function Live(props: Props<RouteSectionProps<undefined>>) {
  const room = $memo(function () {
    const q = String(props.location.query.room || "lobby");
    return ROOMS.includes(q) ? q : "lobby";
  });
  return (
    <>
      {Errored({
        fallback: err => (
          <div class="room">
            <p class="muted post-error">The page failed: {describe(err())}</p>
          </div>
        ),
        children: function () {
          return <>{LivePage({ room })}</>;
        }
      })}
    </>
  );
};
export default Live;
const LivePage = function LivePage(
  props: Props<{
    room: string;
  }>
) {
  return (
    <div class="room">
      {Header({ room: props.room })}
      <div class="columns">
        <main class="main">{Chat({ room: props.room })}</main>
        <aside class="side">
          {Directory({ current: props.room })}
          {Card({ room: props.room })}
          {Summary({ room: props.room })}
          {Archive({ room: props.room })}
        </aside>
      </div>
    </div>
  );
};
const Header = function Header(
  props: Props<{
    room: string;
  }>
) {
  const me = useIdentity();
  const wire = createWire();
  const who = $memo(function () {
    const room2 = props.room;
    const me2 = me();
    return attempt(
      () => wire.watch(presence(room2, me2)),
      cause => new LiveError(cause)
    );
  });
  const joined = $memo(function () {
    const id = me()?.id;
    return id != null && who().members.some(m => m.id === id);
  });
  return (
    <header class="header">
      <div>
        <h1>#{props.room}</h1>
        <p class="muted">
          {Loading({
            fallback: "Joining…",
            children: function () {
              return <>{Joined({ joined, me })}</>;
            }
          })}{" "}
          Open another tab to be two people.
        </p>
      </div>
      <div class="presence">
        {Loading({
          fallback: function () {
            return <span class="muted">joining…</span>;
          },
          children: function () {
            return <>{Members({ who, me })}</>;
          }
        })}
        {StatusPill({ wire: wire, label: "presence" })}
        {Chaos()}
      </div>
    </header>
  );
};
const Joined = function Joined(
  props: Props<{
    joined: Source<boolean, LiveError, true>;
    me: Identity | null;
  }>
) {
  return (
    <>
      {Show({
        when: props.joined,
        fallback: "Not in the room yet — your connection is what joins.",
        children: function () {
          return (
            <>
              You are <b>{props.me.name}</b>, here while this tab's connection is open.
            </>
          );
        }
      })}
    </>
  );
};
const Members = function Members(
  props: Props<{
    who: Source<Presence, LiveError, true>;
    me: Identity | null;
  }>
) {
  return (
    <>
      <span class="count">{props.who.members.length}</span>
      <span class="muted"> here · connection #{props.who.connection}</span>
      <ul class="members">
        {For({
          each: props.who.members,
          children: function (m) {
            return <li class={m.id === props.me.id ? "me" : ""}>{m.name}</li>;
          }
        })}
      </ul>
    </>
  );
};
const Chaos = function Chaos() {
  const [last, setLast] = $signal("");
  const drop = $event(function () {
    let failure: ChaosError | undefined;
    const absorb = (cause: unknown) => {
      failure = new ChaosError(cause);
    };
    const res = attempt(() => fetch("/__chaos/drop", { method: "POST" }), absorb);
    const text = !res
      ? undefined
      : res.ok
        ? attempt(() => res.text(), absorb)
        : `no chaos route (${res.status}) — dev only`;
    setLast(text ?? String(failure));
  });
  return (
    <span class="chaos">
      <button type="button" onClick={drop}>
        Kill every connection
      </button>
      {Show({
        when: last,
        children: function () {
          return <span class="muted"> {last()}</span>;
        }
      })}
    </span>
  );
};
type Row = Message & {
  pending?: boolean;
};
const Chat = function Chat(
  props: Props<{
    room: string;
  }>
) {
  const me = useIdentity();
  const wire = createWire();
  const [store, setOptimistic] = $optimisticStore(
    function () {
      const room3 = props.room;
      return attempt(
        () => wire.watch(transcript(room3)),
        cause => new LiveError(cause)
      );
    },
    { messages: [] } as {
      messages: Row[];
    }
  );
  const [sending, setSending] = $optimistic(false);
  const [error, setError] = $signal<string | undefined>(undefined);
  const post = $event(function (text: string) {
    const current = me();
    if (!current) return;
    const room = props.room;
    const id = Math.random().toString(36).slice(2, 10);
    setError(undefined);
    setSending(true);
    setOptimistic(t => {
      t.messages.push({ id, from: current.name, text, at: Date.now(), pending: true });
    });
    let failure: SendError | DeliveryError | undefined;
    const sent = attempt(
      () => send(room, id, current.name, text).then(() => true as const),
      cause => {
        failure = new SendError(cause);
      }
    );
    if (sent)
      until(
        readStore(store, s => s.messages.some(m => m.id === id)),
        cause => {
          failure = new DeliveryError(cause);
        },
        { timeout: 10000 }
      );
    if (failure) setError(failure.message);
  });
  const transcriptRows = store.messages;
  return (
    <>
      {Transcript({ messages: transcriptRows, wire })}
      {Composer({ room: props.room, post: post, sending: sending, error: error })}
    </>
  );
};
const Transcript = function Transcript<E, P extends boolean>(
  props: Props<{
    messages: Source<Row[], E, P>;
    wire: Wire;
  }>
) {
  return (
    <section class="panel transcript">
      <div class="panel-head">
        <h2>Transcript</h2>
        {StatusPill({ wire: props.wire })}
      </div>
      {Loading({
        fallback: function () {
          return <p class="muted">loading…</p>;
        },
        children: function () {
          return <>{Messages({ messages: props.messages })}</>;
        }
      })}
    </section>
  );
};
const Messages = function Messages<E, P extends boolean>(
  props: Props<{
    messages: Source<Row[], E, P>;
  }>
) {
  const me = useIdentity();
  return (
    <ol class="messages">
      {For({
        each: props.messages,
        children: function (m) {
          return (
            <li
              class={{
                system: m.from === "system",
                mine: m.from === me()?.name,
                pending: !!m.pending
              }}
            >
              <span class="from">{m.from}</span>
              <span class="text">{m.text}</span>
              <time class="muted">{new Date(m.at).toLocaleTimeString()}</time>
            </li>
          );
        }
      })}
    </ol>
  );
};
type Submit = SubmitEvent & {
  currentTarget: HTMLFormElement;
};
type Input = InputEvent & {
  currentTarget: HTMLInputElement;
};
const Composer = function Composer(
  props: Props<{
    room: string;
    post: EventHandler<[text: string], never, void, boolean, true>;
    sending: boolean;
    error: string | undefined;
  }>
) {
  const me = useIdentity();
  const [text, setText] = $signal("");
  const shown = latestOf(text);
  const submit = $event(function (e: Submit) {
    e.preventDefault();
    const trimmed = text().trim();
    if (!trimmed) return;
    setText("");
    props.post(trimmed);
  });
  const input = $event(function (e: Input) {
    setText(e.currentTarget.value);
  });
  return (
    <form class="composer" onSubmit={submit}>
      <input
        value={shown()}
        onInput={input}
        placeholder={`Message #${props.room}`}
        disabled={me() === null}
        autocomplete="off"
      />
      <button type="submit" disabled={me() === null}>
        Send
      </button>
      {Show({
        when: props.sending,
        children: function () {
          return <span class="muted sending">sending…</span>;
        }
      })}
      {Show({
        when: props.error,
        children: function () {
          return (
            <span class="muted post-error" role="alert">
              {props.error}
            </span>
          );
        }
      })}
    </form>
  );
};
const Directory = function Directory(
  props: Props<{
    current: string;
  }>
) {
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Rooms</h2>
      </div>
      <ul class="directory">
        {For({
          each: ROOMS,
          children: function (name) {
            return <>{DirectoryEntry({ name: name, current: props.current })}</>;
          }
        })}
      </ul>
    </section>
  );
};
const DirectoryEntry = function DirectoryEntry(
  props: Props<{
    name: string;
    current: string;
  }>
) {
  const wire = createWire();
  const who = $memo(function () {
    const name2 = props.name;
    return attempt(
      () => wire.watch(presence(name2, null)),
      cause => new LiveError(cause)
    );
  });
  return (
    <li class={props.name === props.current ? "current" : ""}>
      <a href={`/live?room=${props.name}`}>#{props.name}</a>
      <span class="count-small">
        {Loading({
          fallback: "…",
          children: function () {
            return <>{Count({ who })}</>;
          }
        })}
      </span>
      <span class={`dot dot-${wire.status}`} title={wire.status} />
    </li>
  );
};
const Count = function Count(
  props: Props<{
    who: Source<Presence, LiveError, true>;
  }>
) {
  return <>{props.who.members.length}</>;
};
const Card = function Card(
  props: Props<{
    room: string;
  }>
) {
  const wire = createWire();
  const card: Source<RoomCard, LiveError, boolean> = $memo(function () {
    const room2 = props.room;
    return attempt(
      () => wire.watch(roomCard(room2)),
      cause => new LiveError(cause)
    );
  });
  const members = $memo(function () {
    const card2 = card();
    return attempt(
      () => card2.members,
      cause => new LiveError(cause)
    );
  });
  const activity = $memo(function () {
    const card3 = card();
    return attempt(
      () => card3.activity,
      cause => new LiveError(cause)
    );
  });
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Room card</h2>
        {StatusPill({ wire: wire })}
      </div>
      {Loading({
        on: props.room,
        fallback: function () {
          return <p class="muted">loading card…</p>;
        },
        children: function () {
          return <>{CardBody({ card, members, activity })}</>;
        }
      })}
    </section>
  );
};
const CardBody = function CardBody<E, P extends boolean>(
  props: Props<{
    card: Source<
      {
        topic: string;
        connection: number;
      },
      LiveError,
      true
    >;
    members: Source<Member[], E, P>;
    activity: Source<Activity, E, P>;
  }>
) {
  return (
    <>
      <p>
        <b>{props.card.topic}</b>
        <span class="muted"> · connection #{props.card.connection}</span>
      </p>
      <p>
        {Loading({
          fallback: function () {
            return <span class="muted">counting members…</span>;
          },
          children: function () {
            return <>{MemberCount({ members: props.members })}</>;
          }
        })}
      </p>
      <p>
        {Loading({
          fallback: function () {
            return <span class="muted">sampling activity…</span>;
          },
          children: function () {
            return <>{ActivityLine({ activity: props.activity })}</>;
          }
        })}
      </p>
    </>
  );
};
const MemberCount = function MemberCount<E, P extends boolean>(
  props: Props<{
    members: Source<Member[], E, P>;
  }>
) {
  const n = props.members.length;
  return (
    <>
      {n()} member{n() === 1 ? "" : "s"} when the card was cut
    </>
  );
};
const ActivityLine = function ActivityLine<E, P extends boolean>(
  props: Props<{
    activity: Source<Activity, E, P>;
  }>
) {
  const ticks = $memo(function () {
    const { of, tick } = props.activity;
    return Array.from({ length: of }, (_, i) => i < tick);
  });
  return (
    <>
      <span class="ticks">
        {For({
          each: ticks,
          children: function (on) {
            return <span class={on() ? "tick on" : "tick"} />;
          }
        })}
      </span>
      <span class="muted">
        {" "}
        {props.activity.posts} post{props.activity.posts === 1 ? "" : "s"} in the last minute
      </span>
    </>
  );
};
const Summary = function Summary(
  props: Props<{
    room: string;
  }>
) {
  const [attemptNo, setAttempt] = $signal(1);
  const regenerate = $event(function (reset: () => void) {
    setAttempt(a => a + 1);
    reset();
  });
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Summary</h2>
        <span class="muted">undeclared</span>
      </div>
      {Errored({
        fallback: function (err: Path<Error>, reset: Reset) {
          return (
            <div class="error">
              <p>The stream died: {describe(err())}</p>
              <button type="button" onClick={[regenerate(), reset]}>
                Regenerate
              </button>
            </div>
          );
        },
        children: function () {
          return (
            <>
              {Loading({
                fallback: function () {
                  return <p class="muted">summarizing…</p>;
                },
                children: function () {
                  return <>{SummaryText({ room: props.room, attempt: attemptNo })}</>;
                }
              })}
            </>
          );
        }
      })}
    </section>
  );
};
const SummaryText = function SummaryText(
  props: Props<{
    room: string;
    attempt: number;
  }>
) {
  const text = $memo(
    function () {
      const room4 = props.room;
      const attempt2 = props.attempt;
      return attempt(
        () => summary(room4, attempt2),
        cause => new LiveError(cause)
      );
    },
    { ssrSource: "client" }
  );
  return <p>{text()}</p>;
};
const Archive = function Archive(
  props: Props<{
    room: string;
  }>
) {
  const stats = $memo(function () {
    const room = props.room;
    return attempt(
      () => archive(room),
      cause => new ArchiveError(cause)
    );
  });
  return (
    <section class="panel">
      <div class="panel-head">
        <h2>Archive</h2>
        <span class="muted">slow, plain</span>
      </div>
      {Loading({
        on: props.room,
        fallback: function () {
          return <p class="muted">counting the archive (4s)…</p>;
        },
        children: function () {
          return <>{ArchiveCount({ stats })}</>;
        }
      })}
    </section>
  );
};
const ArchiveCount = function ArchiveCount(
  props: Props<{
    stats: Source<
      {
        room: string;
        total: number;
      },
      ArchiveError,
      true
    >;
  }>
) {
  return (
    <p>
      {props.stats.total} message{props.stats.total === 1 ? "" : "s"} ever in #{props.stats.room}
    </p>
  );
};
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export type { Path };
