import type { Article, Site } from "./api";
export const extraArticles: Record<string, Pick<Article, "title" | "markdown" | "kind">> = {
  "post-latency": {
    title: "Latency budgets",
    markdown:
      '## Latency budgets\n\nEvery request spends time on transfer, parsing and rendering. Measure each part before changing the architecture.\n\n```math\nT = T_{network} + T_{parse} + T_{render}\n```\n\n## Implementations\n\n```ts\ninterface Budget { network: number; render: number }\n```\n\n```js\nexport const total = parts => parts.reduce((a, b) => a + b, 0);\n```\n\n```json\n{"cache": true, "maxAge": 3600}\n```\n\n```css\n.article { max-width: 70ch; line-height: 1.6; }\n```\n\n```html\n<article><h1>Field Notes</h1></article>\n```\n\n```bash\ncurl --fail https://example.test/content\n```\n\n```python\ndef total(parts):\n    return sum(parts)\n```\n\n```rust\nfn total(parts: &[u64]) -> u64 { parts.iter().sum() }\n```\n\n```go\nfunc total(a int, b int) int { return a + b }\n```\n\n## Operational notes\n\nKeep the published source and rendered output under the same content version. Invalidate both after an edit. [Read the guide](/docs/pipeline).\n',
    kind: "post"
  },
  "post-caching": {
    title: "Caching rendered content",
    markdown:
      '## Caching rendered content\n\nA cache should have an explicit key, lifetime and invalidation rule. Measure hit rate by content type.\n\n```math\nE[T] = p T_{hit} + (1-p)T_{miss}\n```\n\n## Implementations\n\n```ts\ninterface Budget { network: number; render: number }\n```\n\n```js\nexport const total = parts => parts.reduce((a, b) => a + b, 0);\n```\n\n```json\n{"cache": true, "maxAge": 3600}\n```\n\n```css\n.article { max-width: 70ch; line-height: 1.6; }\n```\n\n```html\n<article><h1>Field Notes</h1></article>\n```\n\n```bash\ncurl --fail https://example.test/content\n```\n\n```python\ndef total(parts):\n    return sum(parts)\n```\n\n```rust\nfn total(parts: &[u64]) -> u64 { parts.iter().sum() }\n```\n\n```go\nfunc total(a int, b int) int { return a + b }\n```\n\n## Operational notes\n\nKeep the published source and rendered output under the same content version. Invalidate both after an edit. [Read the guide](/docs/pipeline).\n',
    kind: "post"
  },
  "post-search": {
    title: "Ranking a small search index",
    markdown:
      '## Ranking a small search index\n\nA small search index can keep ranking rules legible. Start with exact terms, then add weights for titles and headings.\n\n```math\ns(q,d) = \\sum_{t \\in q} w_t f(t,d)\n```\n\n## Implementations\n\n```ts\ninterface Budget { network: number; render: number }\n```\n\n```js\nexport const total = parts => parts.reduce((a, b) => a + b, 0);\n```\n\n```json\n{"cache": true, "maxAge": 3600}\n```\n\n```css\n.article { max-width: 70ch; line-height: 1.6; }\n```\n\n```html\n<article><h1>Field Notes</h1></article>\n```\n\n```bash\ncurl --fail https://example.test/content\n```\n\n```python\ndef total(parts):\n    return sum(parts)\n```\n\n```rust\nfn total(parts: &[u64]) -> u64 { parts.iter().sum() }\n```\n\n```go\nfunc total(a int, b int) int { return a + b }\n```\n\n## Operational notes\n\nKeep the published source and rendered output under the same content version. Invalidate both after an edit. [Read the guide](/docs/pipeline).\n',
    kind: "post"
  },
  "post-growth": {
    title: "Estimating content growth",
    markdown:
      '## Estimating content growth\n\nShipping costs and per-page responses grow at different rates. A useful model keeps those costs separate.\n\n```math\nB(n) = B_0 + n B_{page}\n```\n\n## Implementations\n\n```ts\ninterface Budget { network: number; render: number }\n```\n\n```js\nexport const total = parts => parts.reduce((a, b) => a + b, 0);\n```\n\n```json\n{"cache": true, "maxAge": 3600}\n```\n\n```css\n.article { max-width: 70ch; line-height: 1.6; }\n```\n\n```html\n<article><h1>Field Notes</h1></article>\n```\n\n```bash\ncurl --fail https://example.test/content\n```\n\n```python\ndef total(parts):\n    return sum(parts)\n```\n\n```rust\nfn total(parts: &[u64]) -> u64 { parts.iter().sum() }\n```\n\n```go\nfunc total(a int, b int) int { return a + b }\n```\n\n## Operational notes\n\nKeep the published source and rendered output under the same content version. Invalidate both after an edit. [Read the guide](/docs/pipeline).\n',
    kind: "post"
  }
};
export const extraNavigation: Site["navigation"] = [
  {
    title: "Blog",
    links: [
      {
        title: "Latency budgets",
        href: "/docs/post-latency"
      },
      {
        title: "Caching rendered content",
        href: "/docs/post-caching"
      },
      {
        title: "Ranking a small search index",
        href: "/docs/post-search"
      },
      {
        title: "Estimating content growth",
        href: "/docs/post-growth"
      }
    ]
  }
];
