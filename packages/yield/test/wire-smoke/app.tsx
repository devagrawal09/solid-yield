import { $event, attempt, component, Errored, view, type Props } from "solid-yield";
import { NotFound, Sibling } from "./classes.js";
export const App = component(function* App(props: Props<{ invoke: () => Promise<unknown> }>) {
  const click = $event(function* () {
    const invoke = yield* props.invoke;
    return yield* attempt(invoke, error => error as NotFound | Sibling);
  });
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            catch: [Sibling],
            fallback: error => (
              <p
                class="sibling"
                data-instance={String(error() instanceof Sibling)}
                data-kind={error().kind}
              >
                {error().message}
              </p>
            ),
            children: function* () {
              return (
                <>
                  {
                    yield* Errored({
                      catch: [NotFound],
                      fallback: error => (
                        <p
                          class="missing"
                          data-instance={String(error() instanceof NotFound)}
                          data-kind={error().kind}
                          data-detail={error().detail}
                        >
                          {error().message}
                        </p>
                      ),
                      children: function* () {
                        return <button onClick={yield* click}>Call RPC</button>;
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
