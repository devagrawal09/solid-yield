// Browser script for scripts/example-blocks/browser.mjs: both production
// servers (`node server.js` over `vite build` output), started with a
// `fetch` stub answering the HN API from fixtures (no network here). Every
// route is loaded by SSR (document request) and reached by client
// navigation; the big cached thread (30186326) is served from the capture.
export const mode = "server";
export const serverImport = "tests/fixtures/hn-fetch.mjs";
export const root = "body";

const settle = page => page.waitForTimeout(250);
const go =
  path =>
  async (page, { base }) => {
    await page.goto(base + path);
    await page.waitForLoadState("networkidle");
    await settle(page);
  };
const click = selector => async page => {
  await page.click(selector);
  await page.waitForLoadState("networkidle");
  await settle(page);
};

export const steps = [
  ["SSR /", go("/")],
  ["next page (client nav)", click('a[aria-label="Next Page"]')],
  ["previous page", click('a[aria-label="Previous Page"]')],
  ["New feed", click('a[href="/new"]')],
  ["Ask feed", click('a[href="/ask"]')],
  ["Jobs feed", click('a[href="/job"]')],
  ["a story (client nav)", click('a[href="/stories/job-3"]')],
  ["collapse a thread", click(".toggle a")],
  ["expand it again", click(".toggle a")],
  ["a user (client nav)", click('.comment .by a[href="/users/alice"]')],
  ["SSR a user with an about", go("/users/user1")],
  ["SSR /show?page=2", go("/show?page=2")],
  ["back to top (client nav)", click('a[href="/"]')]
];

// `--variant thread`: the big cached thread, loaded first in a fresh page.
// Loaded after other pages of the same origin (the client entry cached), the
// `async` entry script runs while the 600KB document is still being parsed
// and hydration walks a partial DOM ("Cannot read properties of null
// (reading 'nextSibling')" in Comment / Toggle) — the original's as well as
// the twin's, every time: a core / start issue, reported, not the twin's.
export const variants = {
  thread: {
    steps: [
      ["SSR the big cached thread", go("/stories/30186326")],
      ["collapse its first toggle", click(".toggle a")],
      ["expand it again", click(".toggle a")],
      ["its author (client nav)", click('.item-view-header .meta a[href="/users/lxm"]')]
    ]
  }
};
