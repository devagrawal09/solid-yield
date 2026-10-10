import { marked } from "marked";

// opencode-web Markdown.tsx shape: an inline, non-reactive callback with a try/catch
// handed to a package at module level.
marked.setOptions({
  walkTokens: (token) => {
    try {
      token.raw = token.raw.trim();
    } catch (e) {
      console.error(e);
    }
  },
});

export function C(props: { content: string }) {
  const html = () => marked.parse(props.content) as string;
  return <div innerHTML={html()} />;
}
