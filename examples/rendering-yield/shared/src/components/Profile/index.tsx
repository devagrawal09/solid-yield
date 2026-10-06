import { $component, $memo, attempt, lazy, view } from "solid-yield";
import type { User } from "./Profile";
import { ProfileError } from "./errors";

const Profile = lazy(() => import("./Profile"));

// this component lazy loads data and code in parallel
export default $component(function* ProfilePage() {
  const user = yield* $memo(function* () {
    // simulate data loading
    console.log("LOAD USER");
    return yield* attempt(
      () =>
        new Promise<User>(resolve => {
          setTimeout(() => resolve({ firstName: "Jon", lastName: "Snow" }), 400);
        }),
      cause => new ProfileError(cause)
    );
  });

  const info = yield* $memo(function* () {
    yield* user;
    // simulate cascading data loading
    console.log("LOAD INFO");
    return yield* attempt(
      () =>
        new Promise<string[]>(resolve => {
          setTimeout(
            () =>
              resolve([
                "Something Interesting",
                "Something else you might care about",
                "Or maybe not"
              ]),
            400
          );
        }),
      cause => new ProfileError(cause)
    );
  });

  return view(function* () {
    // Profile reads the user outside its own boundary: it is pending, so it
    // is rendered in call form, and this page is pending too.
    return <>{yield* Profile({ user, info })}</>;
  });
});
