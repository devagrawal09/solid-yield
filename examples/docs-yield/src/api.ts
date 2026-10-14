import { NotFound, SearchError, RateLimited, BadEmail, ArticleUnavailable } from "./errors";
export interface Link {
  title: string;
  href: string;
}
export interface Chapter {
  id: string;
  title: string;
  intro: string;
  detail: string;
  code: string;
}
export interface Article {
  slug: string;
  title: string;
  summary: string;
  chapters: Chapter[];
  related: Link[];
}
export interface Site {
  title: string;
  intro: string;
  navigation: { title: string; links: Link[] }[];
  footer: string;
  links: Link[];
}
export interface Comment {
  id: string;
  name: string;
  text: string;
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// A deterministic, in-process fake server API. Directives give C1 the declared
// server provenance; no RPC transform or network is needed by this example.
export async function getSite(): Promise<Site> {
  "use server";
  await delay(30);
  return {
    title: "Field Notes",
    intro: "Practical notes for building small, readable applications.",
    navigation: [
      {
        title: "Learn",
        links: [
          { title: "Overview", href: "/" },
          { title: "Getting started", href: "/docs/start" }
        ]
      },
      {
        title: "Reference",
        links: [
          { title: "Independent widgets", href: "/docs/widgets" },
          { title: "Missing page", href: "/docs/missing" }
        ]
      }
    ],
    footer: "Written for readers. Updated October 2026.",
    links: [
      { title: "Start here", href: "/docs/start" },
      { title: "Widget reference", href: "/docs/widgets" }
    ]
  };
}
export async function getArticle(slug: string): Promise<Article> {
  "use server";
  await delay(60);
  if (slug === "sibling") throw new ArticleUnavailable("Article unavailable: sibling");
  if (!["overview", "start", "widgets"].includes(slug)) throw new NotFound("No article: " + slug);
  return {
    slug,
    title:
      slug === "overview"
        ? "Welcome to Field Notes"
        : slug === "start"
          ? "Getting started"
          : "Independent widgets",
    summary: "Content first, with a few small tools beside it.",
    chapters: Array.from({ length: 8 }, (_, i) => ({
      id: "section-" + i,
      title: [
        "Read the page",
        "Choose a route",
        "Keep state local",
        "Load an answer",
        "Handle a failure",
        "Use a small boundary",
        "Check the result",
        "Continue reading"
      ][i],
      intro: "A page can carry useful information before its controls start.",
      detail:
        "Each tool owns its state. Reading this chapter needs no shared browser state or background work.",
      code: 'const chapter = await getArticle("start"); // section ' + (i + 1)
    })),
    related: [
      { title: "Getting started", href: "/docs/start" },
      { title: "Independent widgets", href: "/docs/widgets" }
    ]
  };
}
// These widget APIs intentionally have client async lifetime (U in C1).
export async function search(query: string): Promise<Link[]> {
  await delay(80);
  if (query === "fail") throw new SearchError("Search is unavailable");
  return query ? [{ title: "Result: " + query, href: "/docs/widgets" }] : [];
}
export async function like(slug: string, next: number): Promise<number> {
  await delay(80);
  if (next > 1) throw new RateLimited("One like per article: " + slug);
  return next;
}
export async function subscribe(email: string): Promise<string> {
  await delay(80);
  if (!/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(email)) throw new BadEmail("Enter a valid email");
  return "Subscribed: " + email;
}
export async function comments(): Promise<Comment[]> {
  await delay(120);
  return [
    { id: "ada", name: "Ada", text: "The content is easy to follow." },
    { id: "lin", name: "Lin", text: "Small tools are enough." }
  ];
}
export async function avatar(id: string): Promise<string> {
  await delay(180);
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text y="18">' +
        id[0].toUpperCase() +
        "</text></svg>"
    )
  );
}
