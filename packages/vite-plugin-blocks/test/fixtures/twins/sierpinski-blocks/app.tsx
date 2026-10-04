// The Sierpinski triangle stress test from examples/sierpinski, written with
// @solidjs/blocks (JSX flavor). Same markup, same timing, same behavior.
//
// What the library's rules change in the source (see the README):
// - A setup does not read (D-042) and a view does not branch (D-032): the
//   leaf-or-branch choice the original makes from its destructured props is
//   a `Switch` call over holes, and the positions are read in the holes that
//   create the children (the props never change, so each runs once).
// - `Loading({ children: function* () { return <div class="container">…</div>; } })`: a view
//   that reads a pending child is pending itself, so the container moves
//   into its own component and the boundary receives it as a pending view.
// - Timer and frame callbacks are `$event`s.
import {
  $cleanup,
  $component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  Loading,
  Match,
  Switch,
  type Component,
  type Props,
  type Source,
  view
} from "@solidjs/blocks";
import { onCleanup } from "solid-js";

// `children` is the seconds a dot shows: Container passes them settled, a
// triangle passes its own idle-time memo down — pending, failing with an
// IdleError — so the prop declares that coloring (D-068).
type TriangleProps = {
  x: number;
  y: number;
  s: number;
  children: Source<number, IdleError, true>;
};

/** The idle-time work failed: the color of a slow child's failure. */
export class IdleError extends Error {
  readonly kind = "idle" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

const TARGET = 25;

export const TriangleDemo = $component(function* TriangleDemo() {
  const [elapsed, setElapsed] = yield* $signal(0);
  const [seconds, setSeconds] = yield* $signal(0);
  const scale = yield* $memo(function* () {
    const e = ((yield* elapsed) / 1000) % 10;
    return 1 + (e > 5 ? 10 - e : e) / 10;
  });
  const start = Date.now();
  const tick = $event(function* () {
    yield* setSeconds(s => (s % 10) + 1);
  });
  const t = setInterval(tick, 1000);

  let f: number;
  const update = $event(function* (_time: number) {
    yield* setElapsed(Date.now() - start);
    f = requestAnimationFrame(update);
  });
  f = requestAnimationFrame(update);

  yield* $cleanup(() => {
    clearInterval(t);
    cancelAnimationFrame(f);
  });

  return view(function* () {
    // the slow children wait on idle time, which may fail
    return (
      <>
        {
          yield* Errored({
            fallback: err => `Failed: ${err().message}`,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: "Loading...",
                      children: function* () {
                        return <>{yield* Container({ scale, seconds })}</>;
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

const Container = $component(function* Container(props: Props<{ scale: number; seconds: number }>) {
  return view(function* () {
    return (
      <div
        class="container"
        style={{
          transform: "scaleX(" + (yield* props.scale) / 2.1 + ") scaleY(0.7) translateZ(0.1px)"
        }}
      >
        {yield* Triangle({ x: 0, y: 0, s: 1000, children: props.seconds })}
      </div>
    );
  });
});

// A recursive component needs its type spelled out (TypeScript cannot infer
// a const its own initializer references): a triangle may be pending — its
// branches read an async memo. Its setup is left unnamed: a named setup
// (`function* Triangle`) would shadow the component inside its own body.
const Triangle: Component<TriangleProps, true, IdleError> = $component(function* (
  props: Props<TriangleProps>
) {
  // Created here, computed only when a branch reads it (`lazy`): a leaf
  // never starts the idle-time work.
  const slowChildren = yield* $memo(
    function* () {
      const seconds = yield* props.children;
      return yield* attempt(
        () =>
          new Promise<number>(res => {
            const t = requestIdleCallback(() => {
              const e = performance.now() + 0.8;
              while (performance.now() < e) {}
              res(seconds);
            });
            onCleanup(() => cancelIdleCallback(t));
          }),
        cause => new IdleError(cause)
      );
    },
    { lazy: true }
  );

  // The original destructures its position once (`let { x, y, s } = props`)
  // and returns the leaf or the branch. A setup does not read (D-042) and a
  // view does not branch (D-032): the choice is a `Switch` call over holes, and
  // the children's positions are read where they are created — in the holes
  // (the props never change, so each hole runs once).
  return view(function* () {
    return (
      <>
        {
          yield* Switch({
            children: function* () {
              return (
                <>
                  {
                    yield* Match({
                      when: function* () {
                        return (yield* props.s) <= TARGET;
                      },
                      children: function* () {
                        return (
                          <>
                            {
                              // the dot reads the (possibly pending) seconds passed down: its
                              // view propagates into this one
                              yield* Dot({
                                x: function* () {
                                  return (yield* props.x) - TARGET / 2;
                                },
                                y: function* () {
                                  return (yield* props.y) - TARGET / 2;
                                },
                                s: TARGET,
                                children: props.children
                              })
                            }
                          </>
                        );
                      }
                    })
                  }
                  {
                    yield* Match({
                      when: function* () {
                        return (yield* props.s) > TARGET;
                      },
                      children: function* () {
                        return (
                          <>
                            {
                              yield* Triangle({
                                x: props.x,
                                y: function* () {
                                  return (yield* props.y) - (yield* props.s) / 4;
                                },
                                s: function* () {
                                  return (yield* props.s) / 2;
                                },
                                children: slowChildren
                              })
                            }
                            {
                              yield* Triangle({
                                x: function* () {
                                  return (yield* props.x) - (yield* props.s) / 2;
                                },
                                y: function* () {
                                  return (yield* props.y) + (yield* props.s) / 4;
                                },
                                s: function* () {
                                  return (yield* props.s) / 2;
                                },
                                children: slowChildren
                              })
                            }
                            {
                              yield* Triangle({
                                x: function* () {
                                  return (yield* props.x) + (yield* props.s) / 2;
                                },
                                y: function* () {
                                  return (yield* props.y) + (yield* props.s) / 4;
                                },
                                s: function* () {
                                  return (yield* props.s) / 2;
                                },
                                children: slowChildren
                              })
                            }
                          </>
                        );
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

const Dot = $component(function* Dot(props: Props<TriangleProps>) {
  const [hover, setHover] = yield* $signal(false);
  const onEnter = $event(function* () {
    yield* setHover(true);
  });
  const onExit = $event(function* () {
    yield* setHover(false);
  });

  return view(function* () {
    return (
      <div
        class="dot"
        style={{
          width: (yield* props.s) + "px",
          height: (yield* props.s) + "px",
          left: (yield* props.x) + "px",
          top: (yield* props.y) + "px",
          "border-radius": (yield* props.s) / 2 + "px",
          "line-height": (yield* props.s) + "px",
          background: (yield* hover) ? "#ff0" : "#61dafb"
        }}
        onMouseEnter={onEnter}
        onMouseLeave={onExit}
      >
        {(yield* hover) ? "**" + (yield* props.children) + "**" : yield* props.children}
      </div>
    );
  });
});
