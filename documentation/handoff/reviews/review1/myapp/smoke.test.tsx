// @vitest-environment jsdom
import { test, expect } from "vitest";
import { flush } from "solid-js";
import { render } from "@solidjs/web";
import { App } from "./src/App";
test("renders", async () => {
  const d = document.createElement("div"); document.body.append(d);
  render(() => <App />, d);
  await new Promise(r => setTimeout(r, 200)); flush();
  console.log(d.innerHTML);
  expect(d.querySelectorAll("li").length).toBe(2);
});
