import { flush } from "solid-js";
import { normalize, executedBytesCheckpoint, type Step } from "yield-example-harness";
export const root = () => document.getElementById("root")!;
const $ = <T extends Element = HTMLElement>(selector: string) => root().querySelector<T>(selector)!;
export function install() {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  history.replaceState(null, "", "/");
  document.body.innerHTML = '<div id="root"></div>';
}
export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
}
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
};
const click = (selector: string) => {
  $(selector).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  );
  flush();
};
const input = (selector: string, value: string) => {
  const el = $<HTMLInputElement>(selector);
  el.value = value;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  flush();
};
const submit = () => {
  $(".newsletter").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
  flush();
};
export const steps: Step[] = [
  ["load / (pending)", () => flush()],
  ["content loads", () => advance(70)],
  ["comment list loads, avatars pending", () => advance(60)],
  ["avatars load", () => advance(200)],
  ["navigate to /docs/start", () => click('nav a[href="/docs/start"]')],
  ["article loads", () => advance(100)],
  ["toggle theme", () => click(".theme button")],
  ["search starts", () => input(".search input", "local")],
  ["search results", () => advance(100)],
  ["like (optimistic)", () => click(".like button")],
  ["like saved", () => advance(100)],
  ["second like (optimistic)", () => click(".like button")],
  ["like rate limited", () => advance(100)],
  ["newsletter good email", () => input(".newsletter input", "reader@example.com")],
  ["newsletter in flight", submit],
  ["newsletter success", () => advance(100)],
  ["newsletter bad email", () => input(".newsletter input", "bad")],
  ["bad newsletter in flight", submit],
  ["newsletter typed error", () => advance(100)],
  ["carousel next", () => click(".carousel button")],
  ["search failure starts", () => input(".search input", "fail")],
  ["search typed error", () => advance(100)],
  ["navigate to failing slug", () => click('nav a[href="/docs/missing"]')],
  ["not-found typed error", () => advance(100)],
  ["navigate to code-heavy article", () => click('nav a[href="/docs/pipeline"]')],
  ["code-heavy article loads", () => advance(150)],
  [
    "check table of contents",
    () => {
      const link = $<HTMLAnchorElement>('main .on-this-page a[href="#pipeline-model-the-article"]');
      if (!link || !document.getElementById(link.hash.slice(1)))
        throw new Error("Missing TOC target");
      document.getElementById(link.hash.slice(1))!.scrollIntoView = () => {};
      click('main .on-this-page a[href="#pipeline-model-the-article"]');
    }
  ],
  [
    "check highlighted token",
    () => {
      const token = $("main .markdown .language-ts .hljs-keyword");
      if (token?.textContent !== "interface")
        throw new Error("Missing highlighted TypeScript token");
      if (!$("main .markdown table")) throw new Error("Missing Markdown table");
      if ($("main time")?.textContent !== "October 1, 2026")
        throw new Error("Unexpected article date");
    }
  ]
];
export async function runScript() {
  const out: string[] = [];
  for (const [name, run] of steps) {
    await run();
    executedBytesCheckpoint(name);
    out.push(normalize(root().innerHTML));
  }
  return out;
}

// Keep the first 28 checkpoints intact. The same 12 further checkpoints browse
// all enabled content types; smaller levels substitute a docs page.
const blogSlug = __DOCS_LEVEL__ === "S" ? "routing" : "post-latency";
const apiSlug = __DOCS_LEVEL__ === "L" ? "api" : "testing";
const changelogSlug = __DOCS_LEVEL__ === "L" ? "changelog" : "overview";
const navigate = (slug: string) => {
  // Follow a real authored link; related docs are also available in the nav.
  click(`nav a[href="/docs/${slug}"]`);
};
steps.push(
  ["session: docs to blog", () => navigate(blogSlug)],
  ["session: blog settles", () => advance(200)],
  [
    "session: check math",
    () => {
      if (__DOCS_LEVEL__ !== "S" && !$("main .katex")) throw new Error("Missing rendered math");
      if (!$("main .hljs-keyword")) throw new Error("Missing highlighted example");
    }
  ],
  ["session: blog to api", () => navigate(apiSlug)],
  ["session: api settles", () => advance(200)],
  [
    "session: check api link",
    () => {
      if (__DOCS_LEVEL__ !== "L") return;
      const link = $<HTMLAnchorElement>("main .api-entry-link");
      if (!link || !$(link.hash) || root().querySelectorAll("main .api-entry").length !== 20)
        throw new Error("Missing API reference or cross-link target");
      if (!$("main .api-reference table") || !$("main .api-reference .hljs-keyword"))
        throw new Error("Missing API table or generated validation example");
    }
  ],
  ["session: api to changelog", () => navigate(changelogSlug)],
  ["session: changelog settles", () => advance(200)],
  [
    "session: check diff",
    () => {
      if (__DOCS_LEVEL__ !== "L") return;
      if (root().querySelectorAll("main .release").length !== 8 || !$("main .d2h-ins"))
        throw new Error("Missing release or inserted diff line");
    }
  ],
  ["session: return to docs", () => navigate("pipeline")],
  ["session: docs settles", () => advance(200)],
  [
    "session: check docs token",
    () => {
      if ($("main .language-ts .hljs-keyword")?.textContent !== "interface")
        throw new Error("Missing highlighted token after session");
    }
  ]
);
