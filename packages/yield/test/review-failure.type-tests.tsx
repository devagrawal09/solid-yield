import {
  $memo,
  attempt,
  component,
  view,
  Errored,
  Loading,
  lazy,
  foreign,
  type View,
  type Path,
  createContext,
  type Props,
  type Reset
} from "solid-yield";
class TransportError extends Error {
  readonly kind = "transport" as const;
}
async function* watchRoom() {
  yield ["hello"];
  throw new Error("drop");
}
const LiveRoom = component(function* LiveRoom() {
  const messages = yield* $memo(function* () {
    return yield* attempt(
      () => watchRoom(),
      cause => new TransportError(String(cause))
    );
  });
  return view(function* () {
    return <p>{(yield* messages).join(",")}</p>;
  });
});
const IdentityCtx = createContext<string, "ReviewIdentity">();
const RoomPage = component(function* RoomPage(props: Props<{ roomId: string }>) {
  const identity = yield* IdentityCtx;
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            catch: [TransportError],
            fallback: function* (error: Path<TransportError>, _reset: Reset) {
              return view(function* () {
                return <p>{yield* error.message}</p>;
              });
            },
            children: function* () {
              return (
                <section>
                  {yield* props.roomId}
                  {yield* identity}
                  {yield* LiveRoom()}
                </section>
              );
            }
          })
        }
      </>
    );
  });
});
const LazyRoom = lazy(() => Promise.resolve({ default: RoomPage }));
import { ChunkError } from "solid-yield";
const RoomRoute = component(function* RoomRoute(props: Props<{ params: { id: string } }>) {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            catch: [ChunkError],
            fallback: (err, reset) => <button onClick={reset}>{err().message}</button>,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      children: function* () {
                        return <>{yield* LazyRoom({ roomId: props.params.id })}</>;
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
foreign(RoomRoute, { provided: [IdentityCtx] });
type Failure<C> = C extends (...args: any[]) => View<any, infer E, any, any> ? E : never;
type NoAny<T> = 0 extends 1 & T ? false : true;
type Expect<T extends true> = T;
type _live = Expect<NoAny<Failure<typeof LiveRoom>>>;
type _page = Expect<NoAny<Failure<typeof RoomPage>>>;
type _lazy = Expect<NoAny<Failure<typeof LazyRoom>>>;
type _route = Expect<NoAny<Failure<typeof RoomRoute>>>;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _streamFailure = Expect<Equal<Failure<typeof LiveRoom>, TransportError>>;
type _caughtStream = Expect<Equal<Failure<typeof RoomPage>, never>>;
type _chunkOnly = Expect<Equal<Failure<typeof LazyRoom>, ChunkError>>;
type _caughtChunk = Expect<Equal<Failure<typeof RoomRoute>, never>>;
