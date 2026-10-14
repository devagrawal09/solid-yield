export const dashboardTarget = {
  twin: "originals/dashboard",
  entry: "stream",
  kind: "entry",
  urls: ["/overview", "/incidents/inc-101", "/incidents/missing"],
  interactions: { "/overview": "dashboard notes" }
};

export const isDashboard = name => name === "originals/dashboard";
export const expectsDashboardRejection = (name, url) =>
  isDashboard(name) && url === "/incidents/missing";
export function serializedDashboardError(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].some(
    ([, body]) => /new Error\("No incident: missing"\)/.test(body) && /kind:"not-found"/.test(body)
  );
}
export function dashboardContentError(html, url) {
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  const required =
    url === "/overview"
      ? [
          "Operations desk",
          "16,000",
          "99.75%",
          "series-chart",
          "chart-line",
          "Queue backlog",
          "Ada Chen",
          "Shift notes"
        ]
      : url === "/incidents/inc-101"
        ? ["Queue backlog", "Workers are draining", "inc-101", "Back to overview"]
        : ["Operations desk"];
  const missing = required.find(text => !html.includes(text));
  return missing ? `dashboard content missing: ${missing}` : null;
}
