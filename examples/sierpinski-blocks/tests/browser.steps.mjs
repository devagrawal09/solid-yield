// Browser script for scripts/example-blocks/browser.mjs (CSR build, real
// clocks: Playwright's fake clock would freeze `performance.now()` and hang
// the app's busy-wait). The live values — the frame-driven scale and the
// seconds counter — are normalized away; structure, styles and hover state
// are compared.
export const mode = "static";
export const root = "body";
export const normalize = html =>
  html
    .replace(/scaleX\([\d.]+\)/g, "scaleX(#)")
    .replace(/>(\*\*)?\d+(\*\*)?<\/div>/g, (_, a = "", b = "") => `>${a}#${b}</div>`);

const dot = n => `.dot >> nth=${n}`;

export const steps = [
  [
    "load and resolve every branch",
    async (page, { base }) => {
      await page.goto(base + "/");
      await page.waitForFunction(() => document.querySelectorAll(".dot").length === 729);
    }
  ],
  [
    "hover a dot",
    async page => {
      await page.hover(dot(100), { force: true });
      await page.waitForFunction(() => document.body.innerHTML.includes("**"));
    }
  ],
  [
    "move to another dot",
    async page => {
      await page.hover(dot(600), { force: true });
      await page.waitForTimeout(100);
    }
  ],
  [
    "leave the triangle",
    async page => {
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => !document.body.innerHTML.includes("**"));
    }
  ],
  [
    "seconds tick",
    async page => {
      await page.waitForTimeout(1500);
    }
  ]
];
