import {
  $component,
  Errored,
  For,
  Loading,
  type Failure,
  type Source,
  type Props,
  view
} from "solid-yield";
import type { ProfileError } from "./errors";

export interface User {
  firstName: string;
  lastName: string;
}

// What a `<Loading>` covers is its own component: the facts list. Profile
// only forwards `info`, so both take its color from the caller (D-029).
const Facts = $component(function* Facts<E, P extends boolean>(
  props: Props<{ info: Source<string[], E, P> }>
) {
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: props.info,
            children: function* (fact) {
              return view(function* () {
                return <li>{yield* fact}</li>;
              });
            }
          })
        }
      </ul>
    );
  });
});

// Its Errored shows a failure's message: the forwarded failure is a Failure.
const Profile = $component(function* Profile<E extends Failure, P extends boolean>(
  props: Props<{
    info: Source<string[], E, P>;
    user: Source<User, ProfileError, true>;
  }>
) {
  return view(function* () {
    return (
      <>
        <h1>{yield* props.user.firstName}'s Profile</h1>
        <p>This section could be about you.</p>
        {
          yield* Errored({
            fallback: err => <span class="error">{err().message}</span>,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: function* () {
                        return <span class="loader">Loading Info...</span>;
                      },
                      children: function* () {
                        return <>{yield* Facts({ info: props.info })}</>;
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

export default Profile;
