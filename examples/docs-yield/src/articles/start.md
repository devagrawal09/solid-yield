## Plan the page

This guide builds a local development setup. Start with the reader's question and keep the answer close to the example. A useful article has a short introduction, a working example, a description of failure cases, and links to the next task. Readers should be able to copy a small example without first learning the whole application.

The content lives in Markdown so an editor can review a change as ordinary text. Headings describe tasks, links explain their destination, and fenced blocks declare their language. The renderer derives navigation from the same headings it prints, so the page and its table of contents cannot drift apart.

- Give every article a stable slug and a descriptive title.
- Keep publication dates explicit so builds are repeatable.
- Return article data from one loader and derive the display from that result.
- Keep likes, search and subscriptions independent of the article body.

Read the [getting started guide](/docs/start) before changing a project. The [widget reference](/docs/widgets) explains how controls keep their own state.

## Install the tools

Use a small project directory and install only the languages your examples need. The following commands create a workspace, install the renderer, and run the checks. A fresh checkout should produce the same output without a global language registry or a background download.

```sh
mkdir field-notes
cd field-notes
pnpm init
pnpm add marked highlight.js
pnpm run build
```

Record dependencies in the lockfile. A language grammar is code too: loading every grammar would add work for readers who only need three languages. Check the shipped output after adding a new formatter instead of assuming that an unused import disappears.

## Model the article

Keep transport data plain. The loader can read a file, query a service, or reject an unknown slug. None of those choices requires the article template to own browser state. This type describes the data that crosses the boundary, including the Markdown source rather than a prebuilt component.

```ts
interface Article {
  slug: string;
  title: string;
  markdown: string;
  published: string;
}

export async function loadArticle(slug: string): Promise<Article> {
  const article = await repository.find(slug);
  if (!article) throw new Error(`Unknown article: ${slug}`);
  return article;
}
```

A derived result should depend only on this input. Avoid reading the current clock or the visitor's locale inside the formatter. Use an explicit locale and UTC when formatting a stored date so the server and browser agree on the text.

### Derive the display

Transform data once when the selected article changes. Keep the table of contents beside the rendered HTML in the derived value. Heading identifiers should be stable, scoped to the article, and disambiguated when two headings use the same title.

```js
export function summarize(article) {
  const words = article.markdown.trim().split(/\s+/);
  return {
    title: article.title,
    minutes: Math.max(1, Math.ceil(words.length / 220)),
    href: `/docs/${article.slug}`
  };
}
```

| Input | Derived output | Changes when |
| --- | --- | --- |
| Markdown headings | Table of contents | The article changes |
| Fenced source code | Highlighted tokens | The article changes |
| Publication date | Readable date | The stored date changes |
| Like count | Button label | The reader clicks |

## Check the result

Open the page directly, then navigate to it from another article. Both paths should show the same heading, highlighted code, list and table. Follow a table-of-contents link and check that its target exists. A useful check also visits a missing slug, since success alone does not prove that the nearest error boundary still receives a failure.

```ts
const expectedSlug = "start";
const result = summarize(await loadArticle(expectedSlug));
if (result.href !== `/docs/${expectedSlug}`) {
  throw new Error("The article link changed");
}
console.log(result.title, result.minutes);
```

Keep the pending state visible while a new article loads. When a page already has useful content, preserving it during a refetch avoids a blank reading area. Controls beside the text should retain their state for as long as their route owner survives.

## Continue reading

For a local development setup, measure the full path: initial load, the first successful navigation, repeated navigation, and a typed failure. Count client code separately from response data. Sending HTML can remove a renderer from the browser while increasing the bytes returned for each article; both changes belong in the result.

Continue with [the typed pipeline](/docs/pipeline), [route design](/docs/routing), or [content testing](/docs/testing). Review changes with someone who has not seen the implementation and ask whether each example answers a concrete question.
