import { Failure } from "solid-yield";
// The Sierpinski triangle stress test from examples/sierpinski, written with
// solid-yield, no-JSX flavor: views are built with `h`. Same markup,
// same timing, same behavior as the original and the JSX twin
// (examples/sierpinski-yield).
//
// In `h` a view never reads: every dynamic value is a hole (a source, or a
// bare `function* () { … }`), so each view runs once and each hole is its
// own computation. Components are given to `h` (`h(Triangle, { … })`)
// and created where the output is materialized; `h([a, b, c])` is a
// fragment. A setup does not read (D-042): the positions the original
// destructures are lazy memos over the props, the leaf-or-branch choice a
// `Show` over a hole; timer and frame callbacks are `$event`s.
import {
  $cleanup,
  component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  Loading,
  Show,
  type Component,
  type Props,
  type Source,
  view
} from "solid-yield";
import { h } from "solid-yield/h";
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
export class IdleError extends Failure("idle") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

const TARGET = 25;

export const TriangleDemo = component(function* TriangleDemo() {
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
    return h(
      Errored,
      { fallback: err => `Failed: ${String(err())}` },
      h(Loading, { fallback: "Loading..." }, h(Container, { scale, seconds }))
    );
  });
});

const Container = component(function* Container(props: Props<{ scale: number; seconds: number }>) {
  return view(function* () {
    return h(
      "div",
      {
        class: "container",
        style: function* () {
          return {
            transform: "scaleX(" + (yield* props.scale) / 2.1 + ") scaleY(0.7) translateZ(0.1px)"
          };
        }
      },
      h(Triangle, { x: 0, y: 0, s: 1000, children: props.seconds })
    );
  });
});

// A recursive component needs its type spelled out (TypeScript cannot infer
// a const its own initializer references): a triangle may be pending — its
// branches read an async memo. Its setup is left unnamed: a named setup
// (`function* Triangle`) would shadow the component inside its own body.
const Triangle: Component<TriangleProps, true, IdleError> = component(function* (
  props: Props<TriangleProps>
) {
  // The original destructures its position once (`let { x, y, s } = props`)
  // and returns the leaf or the branch. A setup does not read (D-042) and a
  // view does not branch (D-032): the children's positions are memos over
  // the props, and the choice is a `Show` over a hole. Every memo is `lazy`:
  // computed only when the arm that reads it renders (a leaf never starts
  // the idle-time work).
  const dotX = yield* $memo(
    function* () {
      return (yield* props.x) - TARGET / 2;
    },
    { lazy: true }
  );
  const dotY = yield* $memo(
    function* () {
      return (yield* props.y) - TARGET / 2;
    },
    { lazy: true }
  );
  const half = yield* $memo(
    function* () {
      return (yield* props.s) / 2;
    },
    { lazy: true }
  );
  const top = yield* $memo(
    function* () {
      return (yield* props.y) - (yield* props.s) / 4;
    },
    { lazy: true }
  );
  const bottom = yield* $memo(
    function* () {
      return (yield* props.y) + (yield* props.s) / 4;
    },
    { lazy: true }
  );
  const left = yield* $memo(
    function* () {
      return (yield* props.x) - (yield* props.s) / 2;
    },
    { lazy: true }
  );
  const right = yield* $memo(
    function* () {
      return (yield* props.x) + (yield* props.s) / 2;
    },
    { lazy: true }
  );

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

  return view(function* () {
    return Show({
      when: function* () {
        return (yield* props.s) <= TARGET;
      },
      children: h(Dot, { x: dotX, y: dotY, s: TARGET, children: props.children }),
      fallback: h([
        h(Triangle, { x: props.x, y: top, s: half, children: slowChildren }),
        h(Triangle, { x: left, y: bottom, s: half, children: slowChildren }),
        h(Triangle, { x: right, y: bottom, s: half, children: slowChildren })
      ])
    });
  });
});

const Dot = component(function* Dot(props: Props<TriangleProps>) {
  const [hover, setHover] = yield* $signal(false);
  const onEnter = $event(function* () {
    yield* setHover(true);
  });
  const onExit = $event(function* () {
    yield* setHover(false);
  });

  return view(function* () {
    return h(
      "div",
      {
        class: "dot",
        style: function* () {
          return {
            width: (yield* props.s) + "px",
            height: (yield* props.s) + "px",
            left: (yield* props.x) + "px",
            top: (yield* props.y) + "px",
            "border-radius": (yield* props.s) / 2 + "px",
            "line-height": (yield* props.s) + "px",
            background: (yield* hover) ? "#ff0" : "#61dafb"
          };
        },
        onMouseEnter: onEnter,
        onMouseLeave: onExit
      },
      function* () {
        return (yield* hover) ? "**" + (yield* props.children) + "**" : yield* props.children;
      }
    );
  });
});
