import { render, type JSX } from "@solidjs/web";
import { render as renderYield } from "solid-yield";
import { firstDifference } from "yield-example-harness";
import App from "../src/app";
import { install, uninstall, root, runScript, steps } from "./script";
afterEach(uninstall);
it("matches the original DOM at every content and widget step", async () => {
  const path = new URL("../../originals/docs/src/app.tsx", import.meta.url).pathname;
  const Original: (props: {}) => JSX.Element = (await import(/* @vite-ignore */ path)).default;
  install();
  const disposeOriginal = render(() => Original({}), root());
  const original = await runScript();
  disposeOriginal();
  uninstall();
  install();
  const disposeTwin = renderYield(() => App({}), root());
  const twin = await runScript();
  disposeTwin();
  expect(firstDifference(steps, original, twin)).toBe(null);
  const at = (name: string) => original[steps.findIndex(s => s[0] === name)];
  expect(at("content loads")).toContain("Welcome to Field Notes");
  expect(at("comment list loads, avatars pending")).toContain("avatar-pending");
  expect(at("avatars load")).not.toContain("avatar-pending");
  expect(at("article loads")).toContain("<h1>Getting started</h1>");
  expect(location.pathname).toBe("/docs/missing");
  expect(at("toggle theme")).toContain('class="widget theme dark"');
  expect(at("search results")).toContain("Result: local");
  expect(at("like (optimistic)")).toContain("Like: 1");
  expect(at("second like (optimistic)")).toContain("Like: 2");
  expect(at("like rate limited")).toContain("rate-limited: One like per article: start");
  expect(at("like rate limited")).toContain("Like: 1");
  expect(at("newsletter in flight")).toContain("Subscribing…");
  expect(at("newsletter success")).toContain("Subscribed: reader@example.com");
  expect(at("newsletter typed error")).toContain("bad-email: Enter a valid email");
  expect(at("carousel next")).toContain("Image 2 of 2");
  expect(at("search typed error")).toContain("search-error: Search is unavailable");
  expect(at("not-found typed error")).toContain("not-found: No article: missing");
  const region = (name: string, selector: string) => {
    const page = new DOMParser().parseFromString(at(name), "text/html");
    return page.querySelector(selector)?.outerHTML;
  };
  for (const name of [
    "toggle theme",
    "search results",
    "like saved",
    "newsletter success",
    "newsletter typed error",
    "carousel next"
  ])
    expect(region(name, "main .reading")).toBe(region("article loads", "main .reading"));
  expect(region("carousel next", ".theme")).toBe(region("toggle theme", ".theme"));
}, 20_000);
