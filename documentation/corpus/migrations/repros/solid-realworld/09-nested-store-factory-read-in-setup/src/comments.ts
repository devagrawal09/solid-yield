import { action, createMemo, createSignal, refresh } from "solid-js";

async function load(slug: string) {
  return [slug];
}

export function createComments() {
  const [slug, setSlug] = createSignal<string | undefined>(undefined);
  const comments = createMemo(() => {
    const s = slug();
    return s ? load(s) : [];
  });
  const actions = {
    loadComments: action(function* (next: string, reload?: boolean) {
      if (reload) refresh(comments);
      else setSlug(next);
    })
  };
  return { comments, actions };
}
