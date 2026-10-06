// Browser script for scripts/example-blocks/browser.mjs (CSR build). The
// fake clock and a scripted `Math.random` make Effect's latencies, retries
// and the log's timestamps identical for both apps.
export const mode = "static";
export const clock = true;
export const root = "#root";

export async function init(page) {
  await page.addInitScript(() => {
    window.__random = 0.9;
    Math.random = () => window.__random;
  });
}

const run = ms => page => page.clock.runFor(ms);
const type = text => async page => {
  await page.fill('input[type="search"]', text);
  await page.clock.runFor(1);
};
const click = (name, opts = {}) => async page => {
  await page.getByRole("button", { name, ...opts }).first().click();
  await page.clock.runFor(1);
};

export const steps = [
  [
    "load",
    async (page, { base }) => {
      await page.goto(base + "/");
      await page.waitForSelector(".app");
    }
  ],
  ["type s", type("s")],
  ["type so (supersedes s)", type("so")],
  ["so lands", run(1000)],
  ["type sol", type("sol")],
  ["halfway (stale)", run(300)],
  ["sol lands", run(1000)],
  ["type zzz", type("zzz")],
  ["zzz lands", run(1000)],
  [
    "flaky network",
    async page => {
      await page.evaluate(() => (window.__random = 0.1));
      await type("vite")(page);
    }
  ],
  ["retries give up", run(6000)],
  [
    "try again",
    async page => {
      await page.evaluate(() => (window.__random = 0.9));
      await click("Try again")(page);
    }
  ],
  ["vite lands", run(1000)],
  ["clear the log", click("Clear")],
  ["checkout tab", click(/^Checkout/)],
  ["orders load", run(400)],
  ["increment", async page => {
    await page.locator(".cart-row").nth(0).locator("button").nth(1).click();
    await page.clock.runFor(1);
  }],
  ["place order", click(/^Place order/)],
  ["charging", run(1000)],
  ["finalizing", run(2600)],
  ["done", run(1200)],
  ["decline", async page => {
    await page.check(".decline-toggle input");
    await page.clock.runFor(1);
  }],
  ["place declined", click(/^Place order/)],
  ["declined", run(4600)],
  ["undecline + place", async page => {
    await page.uncheck(".decline-toggle input");
    await click(/^Place order/)(page);
  }],
  ["mid-charge", run(2000)],
  ["cancel", click("Cancel checkout")],
  ["compensated", run(1500)],
  ["typeahead tab", click(/^Typeahead/)]
];
