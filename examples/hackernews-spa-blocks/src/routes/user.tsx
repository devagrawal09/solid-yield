import { type RouteParams, type RoutePreloadFuncArgs, type RouteProps } from "@solidjs/router";
import { $component, $memo, attempt, Show, type Props, view } from "@solidjs/blocks";
import { getUser } from "~/lib/api";
import { ApiError } from "~/lib/errors";

type Path = "/users/:id";

export const preload = ({ params }: RoutePreloadFuncArgs<RouteParams<Path>>) => {
  void getUser(params.id);
};

const User = $component(function* User(props: Props<RouteProps<Path>>) {
  const user = yield* $memo(function* () {
    const id2 = yield* props.params.id;
    return yield* attempt(
      () => getUser(id2),
      cause => new ApiError(cause)
    );
  });
  return view(function* () {
    return (
      <div class="user-view">
        <h1>User : {(yield* user).id}</h1>
        <ul class="meta">
          <li>
            <span class="label">Created:</span> {(yield* user).created}
          </li>
          <li>
            <span class="label">Karma:</span> {(yield* user).karma}
          </li>
          {
            yield* Show({
              when: function* () {
                return (yield* user).about;
              },
              children: function* () {
                return <li innerHTML={(yield* user).about} class="about" />;
              }
            })
          }
        </ul>
        <p class="links">
          <a href={`https://news.ycombinator.com/submitted?id=${(yield* user).id}`}>submissions</a>{" "}
          | <a href={`https://news.ycombinator.com/threads?id=${(yield* user).id}`}>comments</a>
        </p>
      </div>
    );
  });
});

export default User;
