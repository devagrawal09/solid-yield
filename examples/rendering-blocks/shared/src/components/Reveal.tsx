import { Reveal, type RevealOrder } from "solid-js";
import {
  $component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  Loading,
  Show,
  type Source,
  type Props,
  view
} from "solid-blocks";

function delayedValue<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

const CardBody = $component(function* CardBody(
  props: Props<{ title: string; value: Source<string, RevealError, true> }>
) {
  return view(function* () {
    return (
      <div class="reveal-card">
        <strong>{yield* props.title}</strong>
        <div>{yield* props.value}</div>
      </div>
    );
  });
});

/** A card\u0027s value failed: the color of its failure. */
export class RevealError extends Error {
  readonly kind = "reveal" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

const AsyncCard = $component(function* AsyncCard(props: Props<{ delay: number; title: string }>) {
  const value = yield* $memo(function* () {
    const delay = yield* props.delay;
    const title = yield* props.title;
    return yield* attempt(
      () => delayedValue(delay, `${title} resolved in ${delay}ms`),
      cause => new RevealError(cause)
    );
  });

  return view(function* () {
    return (
      // the Loading stays the Reveal's direct boundary; the card's failure is
      // handled inside it
      <>
        {
          yield* Loading({
            fallback: function* () {
              return <div class="loader">{yield* props.title} loading...</div>;
            },
            children: function* () {
              return (
                <>
                  {
                    yield* Errored({
                      fallback: err => <div class="error">{err().message}</div>,
                      children: function* () {
                        return <>{yield* CardBody({ title: props.title, value })}</>;
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

type Input = InputEvent & { currentTarget: HTMLInputElement };

const RevealPage = $component(function* RevealPage() {
  const [order, setOrder] = yield* $signal<RevealOrder>("sequential");
  const [collapsed, setCollapsed] = yield* $signal(true);
  const [seed, setSeed] = yield* $signal(1);

  const pick = (value: RevealOrder) =>
    $event(function* () {
      yield* setOrder(value);
    });
  const collapse = $event(function* (e: Input) {
    yield* setCollapsed(e.currentTarget.checked);
  });
  const restart = $event(function* () {
    yield* setSeed(s => s + 1);
  });

  return view(function* () {
    return (
      <>
        <h1>Reveal</h1>
        <p>
          Compare reveal ordering with different <code>order</code> modes and watch the nested group
          behave as a single composite slot inside its parent. Restart the run to replay SSR and
          hydration timings.
        </p>
        <p>
          <strong>Run:</strong> {yield* seed}
        </p>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            "align-items": "center",
            "margin-bottom": "1rem",
            "flex-wrap": "wrap"
          }}
        >
          <fieldset style={{ display: "flex", gap: "0.75rem", "align-items": "center" }}>
            <legend>order</legend>
            <label>
              <input
                type="radio"
                name="order"
                value="sequential"
                checked={(yield* order) === "sequential"}
                onInput={pick("sequential")}
              />{" "}
              sequential
            </label>
            <label>
              <input
                type="radio"
                name="order"
                value="together"
                checked={(yield* order) === "together"}
                onInput={pick("together")}
              />{" "}
              together
            </label>
            <label>
              <input
                type="radio"
                name="order"
                value="natural"
                checked={(yield* order) === "natural"}
                onInput={pick("natural")}
              />{" "}
              natural
            </label>
          </fieldset>
          <label title="Only applies when order is sequential">
            <input
              type="checkbox"
              checked={yield* collapsed}
              disabled={(yield* order) !== "sequential"}
              onInput={collapse}
            />{" "}
            collapsed <em>(sequential only)</em>
          </label>
          <button onClick={restart}>Restart run</button>
        </div>

        {
          yield* Show({
            when: seed,
            keyed: true,
            children: function* () {
              return (
                <>
                  <h2>Primary Group</h2>
                  <p>
                    Three siblings under a single <code>{`<Reveal order="${yield* order}">`}</code>.
                    Compare how they swap in as each resolves.
                  </p>
                  <Reveal order={yield* order} collapsed={yield* collapsed}>
                    <div class="reveal-grid">
                      {yield* AsyncCard({ title: "A", delay: 500 })}
                      {yield* AsyncCard({ title: "B", delay: 1100 })}
                      {yield* AsyncCard({ title: "C", delay: 1700 })}
                    </div>
                  </Reveal>

                  <h2>Nested Group</h2>
                  <p>
                    The outer group uses <code>order="{yield* order}"</code>. The inner group is
                    always <code>order="natural"</code> — it registers as a single composite slot to
                    the outer group and, once the outer releases it, each inner card reveals on its
                    own.
                  </p>
                  <Reveal order={yield* order} collapsed={yield* collapsed}>
                    <div class="reveal-grid">
                      {yield* AsyncCard({ title: "Outer-1", delay: 700 })}
                      <Reveal order="natural">
                        <div class="reveal-grid">
                          {yield* AsyncCard({ title: "Inner-1", delay: 900 })}
                          {yield* AsyncCard({ title: "Inner-2", delay: 1300 })}
                        </div>
                      </Reveal>
                      {yield* AsyncCard({ title: "Outer-2", delay: 1500 })}
                    </div>
                  </Reveal>
                </>
              );
            }
          })
        }
      </>
    );
  });
});

export default RevealPage;
