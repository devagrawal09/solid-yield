import { $component, For, Show, type Component, type Props, view } from "solid-yield";
import type { CommentDefinition } from "~/types";
import Toggle from "./toggle";

// Recursive: the type is stated (a component's type is inferred from its
// view, which renders this component), and the setup is unnamed (a name
// would shadow the component inside it).
const Comment: Component<{ comment: CommentDefinition }, false, never> = $component(function* (
  props: Props<{ comment: CommentDefinition }>
) {
  return view(function* () {
    return (
      <li class="comment">
        <div class="by">
          <a href={`/users/${yield* props.comment.user}`}>{yield* props.comment.user}</a>{" "}
          {yield* props.comment.time_ago} ago
        </div>
        <div class="text" innerHTML={yield* props.comment.content} />
        {
          yield* Show({
            when: props.comment.comments.length,
            children: function* () {
              return (
                <>
                  {
                    yield* Toggle({
                      children: function* () {
                        return (
                          <>
                            {
                              yield* For({
                                each: props.comment.comments,
                                children: function* (comment) {
                                  return view(function* () {
                                    return <>{yield* Comment({ comment: comment })}</>;
                                  });
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
            }
          })
        }
      </li>
    );
  });
});

export default Comment;
