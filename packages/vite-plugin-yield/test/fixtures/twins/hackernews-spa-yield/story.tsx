import { $component, Show, type Props, view } from "solid-yield";
import type { StoryDefinition } from "../types";

const Story = $component(function* Story(props: Props<{ story: StoryDefinition }>) {
  return view(function* () {
    return (
      <li class="news-item">
        <span class="score">{yield* props.story.points}</span>
        <span class="title">
          {
            yield* Show({
              when: props.story.url,
              fallback: function* () {
                return <a href={`/stories/${yield* props.story.id}`}>{yield* props.story.title}</a>;
              },
              children: function* () {
                return (
                  <>
                    <a href={yield* props.story.url} target="_blank" rel="noreferrer">
                      {yield* props.story.title}
                    </a>
                    <span class="host"> ({yield* props.story.domain})</span>
                  </>
                );
              }
            })
          }
        </span>
        <br />
        <span class="meta">
          {
            yield* Show({
              when: function* () {
                return (yield* props.story.type) !== "job";
              },
              fallback: function* () {
                return (
                  <a href={`/stories/${yield* props.story.id}`}>{yield* props.story.time_ago}</a>
                );
              },
              children: function* () {
                return (
                  <>
                    by <a href={`/users/${yield* props.story.user}`}>{yield* props.story.user}</a>{" "}
                    {yield* props.story.time_ago} |{" "}
                    <a href={`/stories/${yield* props.story.id}`}>
                      {(yield* props.story.comments_count)
                        ? `${yield* props.story.comments_count} comments`
                        : "discuss"}
                    </a>
                  </>
                );
              }
            })
          }
        </span>
        {
          yield* Show({
            when: function* () {
              return (yield* props.story.type) !== "link";
            },
            children: function* () {
              return (
                <>
                  {" "}
                  <span class="label">{yield* props.story.type}</span>
                </>
              );
            }
          })
        }
      </li>
    );
  });
});

export default Story;
