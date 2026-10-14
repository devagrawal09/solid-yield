import { AckFailed, NotFound } from "./errors";

export type Range = "24h" | "7d" | "30d";
export type Team = "platform" | "support";
export type Metric = "requests" | "latency";
export interface TeamSummary {
  team: Team;
  requests: number;
  errors: number;
  latency: number;
  previousRequests: number;
}
export interface Summary {
  teams: TeamSummary[];
  updatedAt: number;
}
export interface Sample {
  hour: number;
  team: Team;
  value: number;
}
export interface Incident {
  id: string;
  title: string;
  team: Team;
  severity: number;
  ageHours: number;
  acknowledged: boolean;
  description: string;
}
export interface Member {
  id: string;
  name: string;
  team: Team;
  role: string;
  onCall: boolean;
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const days = (range: Range) => ({ "24h": 1, "7d": 7, "30d": 30 })[range];
const incidents: Incident[] = [
  {
    id: "inc-101",
    title: "Queue backlog",
    team: "platform",
    severity: 2,
    ageHours: 3,
    acknowledged: false,
    description: "Workers are draining a delayed import queue. Add capacity if lag keeps rising."
  },
  {
    id: "inc-102",
    title: "Billing webhook",
    team: "support",
    severity: 1,
    ageHours: 8,
    acknowledged: false,
    description:
      "The billing provider has not confirmed delivery. Acknowledge after provider confirmation."
  },
  {
    id: "inc-103",
    title: "Cache miss spike",
    team: "platform",
    severity: 3,
    ageHours: 40,
    acknowledged: false,
    description: "Cache warming after a regional deploy increased origin traffic."
  },
  {
    id: "inc-104",
    title: "Slow exports",
    team: "support",
    severity: 2,
    ageHours: 240,
    acknowledged: true,
    description: "Large exports are taking longer than the normal processing window."
  }
];

// In-process fake server: deterministic data, short delays, no external service.
export async function getSummary(range: Range): Promise<Summary> {
  "use server";
  await delay(40);
  const multiplier = days(range);
  return {
    teams: [
      {
        team: "platform",
        requests: 12000 * multiplier,
        errors: 24 * multiplier,
        latency: 180,
        previousRequests: 10000 * multiplier
      },
      {
        team: "support",
        requests: 4000 * multiplier,
        errors: 16 * multiplier,
        latency: 260,
        previousRequests: 3800 * multiplier
      }
    ],
    updatedAt: Date.now()
  };
}

export async function getSeries(metric: Metric, range: Range): Promise<Sample[]> {
  "use server";
  await delay(60);
  return (["platform", "support"] as Team[]).flatMap((team, teamIndex) =>
    Array.from({ length: 12 }, (_, index) => ({
      hour: index * days(range) * 2,
      team,
      value:
        metric === "requests"
          ? ((500 + index * 37 + ((index * 7) % 5) * 40) * days(range)) / (teamIndex + 1)
          : 150 + teamIndex * 70 + ((index * 11) % 7) * 9
    }))
  );
}

export async function getIncidents(range: Range): Promise<Incident[]> {
  "use server";
  await delay(80);
  return incidents.filter(row => row.ageHours <= days(range) * 24).map(row => ({ ...row }));
}

export async function getTeam(): Promise<Member[]> {
  "use server";
  await delay(30);
  return [
    { id: "ada", name: "Ada Chen", team: "platform", role: "Infrastructure", onCall: true },
    { id: "lin", name: "Lin Patel", team: "platform", role: "Reliability", onCall: false },
    { id: "sam", name: "Sam Okafor", team: "support", role: "Customer operations", onCall: true }
  ];
}

export async function acknowledge(id: string): Promise<void> {
  "use server";
  await delay(100);
  const row = incidents.find(row => row.id === id);
  if (!row) throw new NotFound("No incident: " + id);
  if (id === "inc-102") throw new AckFailed("Provider confirmation required");
  row.acknowledged = true;
}

export async function getIncident(id: string): Promise<Incident> {
  "use server";
  await delay(70);
  const row = incidents.find(row => row.id === id);
  if (!row) throw new NotFound("No incident: " + id);
  return { ...row };
}
