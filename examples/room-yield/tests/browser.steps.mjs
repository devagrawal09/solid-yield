// Browser script for scripts/example-blocks/browser.mjs: both production
// servers (`node server.js` over `vite build` output). `/` streams the live
// server component into the document, hydrates, and connects; `/live` reads
// the room over live data sources. Each step waits for what it started to
// land, so the compared DOM is settled. What differs between two runs by
// nature is normalized away: the tab's random identity, clock times, and the
// server's render / connection counters. The composer's draft (a property,
// not markup) is recorded with the DOM.
export const mode = "server";

const NAME =
  /\b(quick|quiet|bright|brave|calm|keen|warm|wry)-(otter|heron|lynx|finch|badger|gecko|tapir|wren)\b/g;
export const normalize = html =>
  html
    .replace(NAME, "NAME")
    .replace(/\d{1,2}:\d{2}:\d{2}\s?[AP]M/g, "TIME")
    .replace(/(render|connection) #(<!--[^>]*-->)?\d+/g, "$1 #N")
    // frames' own markers: the frame id digests the call (the tab's identity)
    .replace(/\s(data-fid|data-sc|data-occ)="[^"]*"/g, "");


export const snapshot = page =>
  page.evaluate(() => {
    const room = document.querySelector(".room");
    const input = document.querySelector(".composer input");
    return (room?.outerHTML ?? "<missing .room>") + (input ? `\n[draft: ${input.value}]` : "");
  });

const text = (page, value) =>
  page.waitForFunction(v => document.querySelector(".room")?.textContent.includes(v), value, {
    timeout: 20000
  });
const quiet = page => page.waitForTimeout(500);

export const steps = [
  [
    // Over the production harness (HTTP/1.1: six connections per origin) the
    // /live page's seven live sources do not connect in headless Chromium —
    // the original's as well as the twin's — so this compares the streamed
    // document: every source's first value, the boundaries' fallbacks.
    "load /live (SSR, stream mode): the document",
    async (page, { base }) => {
      await page.goto(base + "/live?room=lobby");
      await page.waitForSelector(".transcript .messages li");
      await page.waitForTimeout(1500);
    }
  ]
];
