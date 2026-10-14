import { createMemo, createSignal, For } from "solid-js";
import { getSeries, type Metric, type Sample } from "./api";
import { useFilters, teamLabels } from "./filters";
import { Panel } from "./panel";

// All coordinates are derived from the response and shared filters. There is
// no canvas state, DOM measurement, or chart package hiding the computation.
export function chartGeometry(samples: Sample[]) {
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const totals = new Map<number, number>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.value) || !Number.isFinite(sample.hour)) continue;
    totals.set(sample.hour, (totals.get(sample.hour) ?? 0) + sample.value);
  }
  const values = [...totals].sort(([a], [b]) => a - b);
  const minHour = values[0]?.[0] ?? 0;
  const maxHour = values.at(-1)?.[0] ?? minHour + 1;
  const highest = Math.max(1, ...values.map(([, value]) => value));
  // Round up to readable grid lines (1, 2, or 5 times a power of ten).
  const roughStep = highest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
  const ceiling = Math.ceil(highest / step) * step;
  const x = (hour: number) =>
    padding.left + ((hour - minHour) / Math.max(1, maxHour - minHour)) * plotWidth;
  const y = (value: number) => padding.top + plotHeight - (value / ceiling) * plotHeight;
  const points = values.map(([hour, value]) => ({ hour, value, x: x(hour), y: y(value) }));
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const baseline = padding.top + plotHeight;
  const area = points.length
    ? `${line} L${points.at(-1)!.x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`
    : "";
  const ticks = Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) => ({
    value: index * step,
    y: y(index * step)
  }));
  const labels = points.filter(
    (_, index) => index === 0 || index === points.length - 1 || index % 3 === 0
  );
  return { width, height, padding, plotWidth, baseline, points, line, area, ticks, labels };
}

export function SeriesPanel() {
  const filters = useFilters();
  const [metric, setMetric] = createSignal<Metric>("requests");
  const series = createMemo(() => getSeries(metric(), filters.range()));
  const geometry = createMemo(() => {
    const selected = series().filter(
      sample => filters.team() === "all" || sample.team === filters.team()
    );
    if (metric() === "requests") return chartGeometry(selected);
    // Latency is an average across teams at each timestamp, not a sum.
    const teamCount = filters.team() === "all" ? 2 : 1;
    return chartGeometry(selected.map(sample => ({ ...sample, value: sample.value / teamCount })));
  });
  return (
    <Panel title="Traffic and latency" name="series">
      <label>
        Metric
        <select
          aria-label="Metric"
          value={metric()}
          onChange={e => setMetric(e.currentTarget.value as Metric)}
        >
          <option value="requests">Requests</option>
          <option value="latency">Latency</option>
        </select>
      </label>
      <p>
        {teamLabels[filters.team()]} ·{" "}
        {metric() === "requests" ? "requests per bucket" : "mean latency (ms)"}
      </p>
      <svg
        class="series-chart"
        viewBox={`0 0 ${geometry().width} ${geometry().height}`}
        role="img"
        aria-label={`${metric()} for ${teamLabels[filters.team()]}`}
      >
        <title>{metric() === "requests" ? "Request volume" : "Response latency"}</title>
        <For each={geometry().ticks}>
          {tick => (
            <g class="grid-line">
              <line
                x1={geometry().padding.left}
                x2={geometry().width - geometry().padding.right}
                y1={tick.y}
                y2={tick.y}
              />
              <text x={geometry().padding.left - 8} y={tick.y + 4} text-anchor="end">
                {tick.value}
              </text>
            </g>
          )}
        </For>
        <path class="chart-area" d={geometry().area} />
        <path class="chart-line" d={geometry().line} />
        <For each={geometry().points}>
          {point => (
            <circle cx={point.x} cy={point.y} r="3">
              <title>
                {point.hour}h: {point.value.toFixed(0)}
              </title>
            </circle>
          )}
        </For>
        <For each={geometry().labels}>
          {point => (
            <text x={point.x} y={geometry().baseline + 24} text-anchor="middle">
              {point.hour}h
            </text>
          )}
        </For>
      </svg>
      <p class="chart-caption">{geometry().points.length} samples · scaled from zero</p>
    </Panel>
  );
}
