// The routes (examples/rendering's App, as a yield component). The pages are `lazy()`
// chunks, as in the original (the library's `lazy`: pending while its chunk
// loads, failing with a `ChunkError` when it does not load, D-100, and colored
// as the page's `component`): a page may be pending (Profile) or fail (Stream's
// stream, any page's chunk). The pages are rendered in call form
// (`{yield* Profile()}`), which hands their pending / failures on. Pending is
// the root's, as in the original: each entry wraps the app in a `Loading` at
// the root (D-099; without a fallback, as the original's CSR and streaming
// entries show nothing until it settles; the string entry's has the
// original's fallback). A failure, a `ChunkError` too (the original has no
// `Errored` around its pages), reaches the root and is re-thrown there
// (D-033), as in the original: the entries use the library's renderers, the
// root edge, not a foreign hand-off.
import { component, isPendingOf, lazy, Match, Switch, view } from "solid-yield";
import { Link, RouteHOC, useRouter } from "../router";
import Profile from "./Profile";

// vite-plugin-solid-yield gives these calls the module URL that
// @solidjs/vite-plugin's own pass writes only for `lazy` from "solid-js" (D-047).
const Home = lazy(() => import("./Home"));
const Settings = lazy(() => import("./Settings"));
const Stream = lazy(() => import("./Stream"));
const ErrorStream = lazy(() => import("./ErrorStream"));
const RevealPage = lazy(() => import("./Reveal"));
const Skeleton = lazy(() => import("./Skeleton"));

const App = RouteHOC(
  component(function* Routes() {
    const { location, matches } = yield* useRouter();
    const pending = isPendingOf(location);

    return view(function* () {
      return (
        <>
          <ul class="inline">
            <li class={{ selected: yield* matches("index") }}>
              {
                yield* Link({
                  path: "",
                  children: function* () {
                    return <>Home</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("profile") }}>
              {
                yield* Link({
                  path: "profile",
                  children: function* () {
                    return <>Profile</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("settings") }}>
              {
                yield* Link({
                  path: "settings",
                  children: function* () {
                    return <>Settings</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("stream") }}>
              {
                yield* Link({
                  path: "stream",
                  children: function* () {
                    return <>Stream</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("error-stream") }}>
              {
                yield* Link({
                  path: "error-stream",
                  children: function* () {
                    return <>Error Stream</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("reveal") }}>
              {
                yield* Link({
                  path: "reveal",
                  children: function* () {
                    return <>Reveal</>;
                  }
                })
              }
            </li>
            <li class={{ selected: yield* matches("skeleton") }}>
              {
                yield* Link({
                  path: "skeleton",
                  children: function* () {
                    return <>Skeleton</>;
                  }
                })
              }
            </li>
          </ul>
          <div class={["tab", { pending: yield* pending }]}>
            {
              yield* Switch({
                children: function* () {
                  return (
                    <>
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("index");
                          },
                          children: function* () {
                            return <>{yield* Home()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("profile");
                          },
                          children: function* () {
                            return <>{yield* Profile()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("settings");
                          },
                          children: function* () {
                            return <>{yield* Settings()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("stream");
                          },
                          children: function* () {
                            return <>{yield* Stream()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("error-stream");
                          },
                          children: function* () {
                            return <>{yield* ErrorStream()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("reveal");
                          },
                          children: function* () {
                            return <>{yield* RevealPage()}</>;
                          }
                        })
                      }
                      {
                        yield* Match({
                          when: function* () {
                            return yield* matches("skeleton");
                          },
                          children: function* () {
                            return <>{yield* Skeleton()}</>;
                          }
                        })
                      }
                    </>
                  );
                }
              })
            }
          </div>
        </>
      );
    });
  })
);

export default App;
