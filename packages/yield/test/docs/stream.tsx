import {
  $event,
  $memo,
  $signal,
  attempt,
  component,
  Errored,
  Loading,
  view,
  type Path,
  type Props,
  type Reset
} from "solid-yield";
class TransportError extends Error {
  readonly kind = "transport" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export type Message = { text: string };
// Your transport must return a fresh iterator for each call.
export function roomWith(watchRoom: (id: string) => AsyncIterable<Message[]>) {
  return component(function* Room(props: Props<{ roomId: string }>) {
    const [attemptNumber, setAttempt] = yield* $signal(0);
    let current: { number: number; id: string; stream: AsyncIterable<Message[]> } | undefined;
    const messages = yield* $memo(function* () {
      const number = yield* attemptNumber;
      const id = yield* props.roomId;
      return yield* attempt(
        () => {
          // Reset may re-read this memo before the event's writes commit.
          // Keep one iterator per attempt, including those extra reads.
          if (!current || current.number !== number || current.id !== id) {
            current = { number, id, stream: watchRoom(id) };
          }
          return current.stream;
        },
        cause => new TransportError(cause)
      );
    });
    return view(function* () {
      return (
        <>
          {
            yield* Errored({
              catch: [TransportError],
              fallback: function* (error: Path<TransportError>, reset: Reset) {
                const reconnect = $event(function* () {
                  yield* setAttempt(n => n + 1);
                  reset();
                });
                return view(function* () {
                  return (
                    <section>
                      <p>{yield* error.message}</p>
                      <button onClick={yield* reconnect}>Reconnect</button>
                    </section>
                  );
                });
              },
              children: function* () {
                return (
                  <>
                    {
                      yield* Loading({
                        fallback: "Connecting…",
                        children: function* () {
                          return <p>{(yield* messages).map(message => message.text).join("; ")}</p>;
                        }
                      })
                    }
                  </>
                );
              }
            })
          }
        </>
      );
    });
  });
}
