import {
  $component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  Loading,
  type BlockSetter,
  type Path,
  type Reset,
  type Source,
  type Props,
  view
} from "solid-blocks";
import { ItemError } from "./errors";

interface Item {
  title: string;
}

function loadItem(id: string): Promise<Item> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id !== "1") {
        reject(new Error(`Item ${id} not found`));
        return;
      }

      resolve({ title: "Test Item" });
    }, 1500);
  });
}

/**
 * One item: its id is its own state until it is set, the prop's before (read
 * where the item is derived: a setup does not read, D-042), and
 * the load is an `attempt` that declares its failure (`ItemError`), so the
 * boundaries' types know what they handle.
 */
function* item(props: Props<{ id: string }>) {
  const [chosen, setId] = yield* $signal<string | undefined>(undefined);
  const item = yield* $memo(function* () {
    const current = (yield* chosen) ?? (yield* props.id);
    return yield* attempt(
      () => loadItem(current),
      cause => new ItemError(cause)
    );
  });
  return { item, setId };
}

const Title = $component(function* Title(props: Props<{ item: Source<Item, ItemError, true> }>) {
  return view(function* () {
    return <div>{yield* props.item.title}</div>;
  });
});

/**
 * The boundaries' fallback: a row (D-030), its error a path, so its view can
 * bind the retry event (D-072). Its parameters are annotated: TypeScript does
 * not infer a generator fallback's.
 */
function fallback(setId: BlockSetter<string | undefined>) {
  return function* (error: Path<ItemError>, reset: Reset) {
    const retry = $event(function* () {
      yield* setId("1");
      reset();
    });
    return view(function* () {
      return (
        <div>
          <div>ItemError: {String(yield* error)}</div>
          <button onClick={yield* retry}>Reset to valid item</button>
        </div>
      );
    });
  };
}

// A boundary tag hands on nothing it does not handle: the inner boundary of
// each pair is a call whose content is built inside it.
const InnerBoundaryItem = $component(function* InnerBoundaryItem(props: Props<{ id: string }>) {
  const { item: loaded, setId } = yield* item(props);
  return view(function* () {
    return (
      <>
        {
          yield* Loading({
            fallback: function* () {
              return <div>Item Loading...</div>;
            },
            children: function* () {
              return (
                <>
                  {
                    yield* Errored({
                      fallback: fallback(setId),
                      children: function* () {
                        return <>{yield* Title({ item: loaded })}</>;
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

const OuterBoundaryItem = $component(function* OuterBoundaryItem(props: Props<{ id: string }>) {
  const { item: loaded, setId } = yield* item(props);
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: fallback(setId),
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: function* () {
                        return <div>Item Loading...</div>;
                      },
                      children: function* () {
                        return <>{yield* Title({ item: loaded })}</>;
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

const ErrorStream = $component(function* ErrorStream() {
  return view(function* () {
    return (
      <>
        <h1>Loading + Errored Streaming</h1>
        <p>
          Reproduces both boundary shapes for streamed SSR + hydration, with reset buttons to
          confirm recovery after hydration.
        </p>
        <h2>Errored inside Loading</h2>
        <div>
          {yield* InnerBoundaryItem({ id: "1" })}
          {yield* InnerBoundaryItem({ id: "bad-item" })}
        </div>
        <h2>Errored outside Loading</h2>
        <div>
          {yield* OuterBoundaryItem({ id: "1" })}
          {yield* OuterBoundaryItem({ id: "bad-item" })}
        </div>
      </>
    );
  });
});

export default ErrorStream;
