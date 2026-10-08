import { flush } from "solid-js";
import { expect, vi } from "vitest";
import { normalize, type Step } from "../src/index";

export const root = () => document.getElementById("root")!;
const query = <T extends Element = HTMLElement>(selector: string) => {
  const element = root().querySelector<T>(selector);
  if (!element) throw new Error("Missing dashboard element: " + selector);
  return element;
};
export function install() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  history.replaceState(null, "", "/overview");
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
}
export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
  localStorage.clear();
}
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
};
const click = (selector: string) => {
  query(selector).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  );
  flush();
};
const select = (label: string, value: string) => {
  const element = query<HTMLSelectElement>(`select[aria-label="${label}"]`);
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
  flush();
};
const notes = (value: string) => {
  const element = query<HTMLTextAreaElement>("textarea");
  element.value = value;
  element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  flush();
};
const row = (id: string) => `[data-incident="${id}"]`;

export const steps: Step[] = [
  ["overview pending", () => flush()],
  ["roster loads", () => advance(35)],
  ["summary loads", () => advance(10)],
  ["series loads", () => advance(20)],
  ["incidents load", () => advance(30)],
  ["change range to 7d", () => select("Date range", "7d")],
  ["7d panels settle", () => advance(100)],
  ["select platform", () => select("Team", "platform")],
  ["select support", () => select("Team", "support")],
  ["select all teams", () => select("Team", "all")],
  ["sort title ascending", () => click("th:first-child button")],
  ["sort title descending", () => click("th:first-child button")],
  ["sort severity ascending", () => click("th:nth-child(3) button")],
  ["acknowledge optimistic success", () => click(`${row("inc-101")} button`)],
  ["acknowledge saved", () => advance(200)],
  ["acknowledge optimistic failure", () => click(`${row("inc-102")} button`)],
  ["acknowledge rolls back", () => advance(110)],
  ["change metric to latency", () => select("Metric", "latency")],
  ["latency series settles", () => advance(70)],
  ["type shift notes", () => notes("Watch the queue")],
  ["edit shift notes", () => notes("Watch the queue after deploy")],
  ["interval tick", () => advance(30_000 - (Date.now() - Date.parse("2026-10-08T12:00:00Z")))],
  ["interval summary settles", () => advance(50)],
  ["navigate to detail", () => click(`${row("inc-101")} a`)],
  ["detail loads", () => advance(80)],
  ["navigate to missing detail", () => click('.detail a[href="/incidents/missing"]')],
  ["not-found boundary", () => advance(80)],
  ["back to overview", () => click('.route-error a[href="/overview"]')],
  ["overview restores notes", () => advance(100)],
  [
    "30d panels settle",
    async () => {
      select("Date range", "30d");
      await advance(100);
    }
  ]
];

// Content assertions are independent of the app's derivation functions.
const contains = (selector: string, text: string) =>
  expect(query(selector).textContent).toContain(text);
const countRows = (count: number) =>
  expect(root().querySelectorAll("tbody tr[data-incident]")).toHaveLength(count);
const firstRow = (id: string) => expect(query("tbody tr").getAttribute("data-incident")).toBe(id);
const acknowledged = (id: string, value: boolean) =>
  contains(`${row(id)} .ack-status`, value ? "Acknowledged" : "Open");
export const checks: Record<string, () => void> = {
  "overview pending": () => contains(".summary", "Loading service summary"),
  "roster loads": () => contains(".roster", "Ada Chen"),
  "summary loads": () => {
    contains('[data-kpi="requests"]', "16,000");
    contains('[data-kpi="success"]', "99.75%");
    contains('[data-kpi="latency"]', "200 ms");
  },
  "series loads": () => {
    expect(query(".chart-line").getAttribute("d")).toMatch(/^M60\.00,/);
    expect(root().querySelectorAll("svg circle")).toHaveLength(12);
  },
  "incidents load": () => countRows(2),
  "change range to 7d": () =>
    expect(query<HTMLSelectElement>('select[aria-label="Date range"]').value).toBe("7d"),
  "7d panels settle": () => {
    contains('[data-kpi="requests"]', "112,000");
    countRows(3);
    contains("svg", "154h");
  },
  "select platform": () => {
    contains('[data-kpi="requests"]', "84,000");
    countRows(2);
    expect(query(".roster").textContent).not.toContain("Sam Okafor");
    expect(query("svg").getAttribute("aria-label")).toBe("requests for Platform");
  },
  "select support": () => {
    contains('[data-kpi="requests"]', "28,000");
    countRows(1);
    expect(query(".roster").textContent).not.toContain("Ada Chen");
    contains(".notes", "Support");
  },
  "select all teams": () => {
    countRows(3);
    contains(".roster", "Sam Okafor");
  },
  "sort title ascending": () => firstRow("inc-102"),
  "sort title descending": () => firstRow("inc-101"),
  "sort severity ascending": () => firstRow("inc-102"),
  "acknowledge optimistic success": () => {
    acknowledged("inc-101", true);
    contains(row("inc-101"), "Saving…");
  },
  "acknowledge saved": () => {
    acknowledged("inc-101", true);
    expect(query(`${row("inc-101")} button`).hasAttribute("disabled")).toBe(true);
    expect(query(row("inc-101")).textContent).not.toContain("Saving…");
  },
  "acknowledge optimistic failure": () => {
    acknowledged("inc-102", true);
    contains(row("inc-102"), "Saving…");
  },
  "acknowledge rolls back": () => {
    acknowledged("inc-102", false);
    contains(".ack-error", "ack-failed: Provider confirmation required");
    expect(query(`${row("inc-102")} button`).hasAttribute("disabled")).toBe(false);
  },
  "change metric to latency": () =>
    expect(query<HTMLSelectElement>('select[aria-label="Metric"]').value).toBe("latency"),
  "latency series settles": () => {
    expect(query("svg").getAttribute("aria-label")).toBe("latency for All teams");
    contains("svg title", "Response latency");
  },
  "type shift notes": () => {
    contains(".note-count", "15 characters");
    expect(localStorage.getItem("operations-desk-notes")).toBe("Watch the queue");
  },
  "edit shift notes": () =>
    expect(localStorage.getItem("operations-desk-notes")).toBe("Watch the queue after deploy"),
  "interval tick": () => contains(".summary", "112,000"),
  "interval summary settles": () => {
    expect(Number(query(".updated").getAttribute("data-updated"))).toBeGreaterThanOrEqual(
      Date.parse("2026-10-08T12:00:30Z")
    );
    contains(".roster", "Ada Chen");
  },
  "navigate to detail": () => expect(location.pathname).toBe("/incidents/inc-101"),
  "detail loads": () => {
    contains(".detail h2", "Queue backlog");
    contains(".detail", "Acknowledged");
    contains(".detail", "Workers are draining");
  },
  "navigate to missing detail": () => contains(".detail", "Queue backlog"),
  "not-found boundary": () => {
    contains(".not-found", "not-found: No incident: missing");
    expect(location.pathname).toBe("/incidents/missing");
  },
  "back to overview": () => expect(location.pathname).toBe("/overview"),
  "overview restores notes": () => {
    expect(query<HTMLTextAreaElement>("textarea").value).toBe("Watch the queue after deploy");
    contains('[data-kpi="requests"]', "112,000");
  },
  "30d panels settle": () => {
    countRows(4);
    contains('[data-kpi="requests"]', "480,000");
  }
};

export async function runScript() {
  const snapshots: string[] = [];
  for (const [name, run] of steps) {
    await run();
    checks[name]();
    snapshots.push(normalize(root().innerHTML));
  }
  return snapshots;
}
