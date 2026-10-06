// The examples of documentation/getting-started.md's "Flow controls and
// events" and "Events, transactions and in-flight state". Type-checked
// (test-types), linted with the twins' lint (test:conformance's lint step)
// and run (reference.spec.tsx): edit the two together.
import {
  component,
  $event,
  $memo,
  $optimistic,
  $signal,
  attempt,
  Errored,
  For,
  Loading,
  Match,
  Show,
  Switch,
  view,
  type Handler,
  type Props,
  type Source
} from "solid-yield";

export type Theme = "light" | "dark";
export type Note = { id: number; title: string };
export class BadTitle extends Error {
  readonly kind = "bad-title" as const;
}
export class LoadFailed extends Error {
  readonly kind = "load-failed" as const;
}

// --- For: a child that takes a value is a row; a row returns view(…) ------------------------
export const NoteList = component(function* NoteList(
  props: Props<{ notes: Source<Note[], LoadFailed, true> }>
) {
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: props.notes,
            fallback: function* () {
              return <li class="empty">no notes</li>;
            },
            children: function* (note) {
              return view(function* () {
                return <li class="note">{yield* note.title}</li>;
              });
            }
          })
        }
      </ul>
    );
  });
});

// --- an event prop: Handler<[Theme]> ---------------------------------------------------------
export const ThemePicker = component(function* ThemePicker(
  props: Props<{ theme: Source<Theme>; onPick: Handler<[Theme]> }>
) {
  const pickDark = $event(function* () {
    // a handler in a prop is read, then called: `yield* (yield* props.onPick)(…)`
    yield* (yield* props.onPick)("dark");
  });
  return view(function* () {
    return (
      <button class="theme" onClick={yield* pickDark}>
        {yield* props.theme}
      </button>
    );
  });
});

// --- a form: value= plus onInput, onSubmit with preventDefault, in-flight state ---------------
/** A stand-in for a server: saving takes 20 ms; a title under 3 characters is refused. */
export function saveTitle(title: string): Promise<string> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (title.length < 3 ? reject(new Error("too short")) : resolve(title)), 20)
  );
}

export const Editor = component(function* Editor() {
  const [title, setTitle] = yield* $signal("");
  const [saved, setSaved] = yield* $signal<string | null>(null);
  const [failure, setFailure] = yield* $signal<BadTitle | null>(null);
  // an $event's writes are held until it settles: a $signal set to true here
  // would never show. An $optimistic shows its value at once, and reverts
  // when the event settles.
  const [saving, setSaving] = yield* $optimistic(false);
  const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setTitle(e.currentTarget.value);
  });
  const save = $event(function* (e: SubmitEvent) {
    e.preventDefault(); // synchronous: the body runs up to its first wait inside the dispatch
    yield* setSaving(true);
    const current = yield* title;
    const result = yield* attempt(
      () => saveTitle(current),
      // absorbed: the handler writes the failure and returns nothing
      function* (cause) {
        yield* setFailure(new BadTitle(cause instanceof Error ? cause.message : String(cause)));
      }
    );
    if (result !== undefined) {
      yield* setSaved(result);
      yield* setFailure(null);
    }
  });
  return view(function* () {
    return (
      <form class="editor" onSubmit={yield* save}>
        <input name="title" value={yield* title} onInput={yield* edit} />
        <button type="submit" disabled={yield* saving}>
          {(yield* saving) ? "Saving…" : "Save"}
        </button>
        {
          // Show with a value: the child takes it, so it is a row, and returns view(…)
          yield* Show({
            when: failure,
            children: function* (f) {
              return view(function* () {
                return <p class="failure">{yield* f.message}</p>;
              });
            }
          })
        }
        {
          // Show with a condition: the child takes nothing, a lazy view
          yield* Show({
            when: function* () {
              return (yield* saved) !== null;
            },
            fallback: "not saved yet",
            children: function* () {
              return <p class="saved">saved: {yield* saved}</p>;
            }
          })
        }
      </form>
    );
  });
});

// --- Switch / Match ---------------------------------------------------------------------------
export const Status = component(function* Status(
  props: Props<{ status: Source<"idle" | "saving" | "saved"> }>
) {
  return view(function* () {
    return (
      <>
        {
          yield* Switch({
            fallback: function* () {
              return <p class="status">idle</p>;
            },
            children: function* () {
              return (
                <>
                  {
                    yield* Match({
                      when: function* () {
                        return (yield* props.status) === "saving";
                      },
                      children: function* () {
                        return <p class="status">saving…</p>;
                      }
                    })
                  }
                  {
                    yield* Match({
                      when: function* () {
                        return (yield* props.status) === "saved";
                      },
                      children: function* () {
                        return <p class="status">saved</p>;
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

// --- Loading and Errored around async data ---------------------------------------------------
/** A stand-in for a server: folder "inbox" has notes, any other folder fails. */
export function fetchNotes(folder: string): Promise<Note[]> {
  return new Promise((resolve, reject) =>
    setTimeout(
      () =>
        folder === "inbox"
          ? resolve([
              { id: 1, title: "milk" },
              { id: 2, title: "eggs" }
            ])
          : reject(new Error(`no folder ${folder}`)),
      10
    )
  );
}

export const Folder = component(function* Folder(props: Props<{ folder: string }>) {
  const notes = yield* $memo(function* () {
    const folder = yield* props.folder;
    return yield* attempt(
      () => fetchNotes(folder),
      cause => new LoadFailed(cause instanceof Error ? cause.message : String(cause))
    );
  });
  return view(function* () {
    return (
      <section>
        {
          yield* Errored({
            catch: [LoadFailed],
            // a render function: the error (an accessor) and a reset
            fallback: (err, reset) => (
              <p class="load-failed">
                {err().message} <button onClick={reset}>retry</button>
              </p>
            ),
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: function* () {
                        return <p class="loading">loading…</p>;
                      },
                      children: function* () {
                        return <>{yield* NoteList({ notes })}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </section>
    );
  });
});

// --- the page the spec renders ----------------------------------------------------------------
export const Page = component(function* Page() {
  const [theme, setTheme] = yield* $signal<Theme>("light");
  const pick = $event(function* (t: Theme) {
    yield* setTheme(t);
  });
  const [status] = yield* $signal<"idle" | "saving" | "saved">("saved");
  return view(function* () {
    return (
      <main>
        {yield* ThemePicker({ theme, onPick: pick })}
        {yield* Editor()}
        {yield* Status({ status })}
        {yield* Folder({ folder: "inbox" })}
        {yield* Folder({ folder: "trash" })}
      </main>
    );
  });
});
