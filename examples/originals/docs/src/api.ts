import { extraArticles, extraNavigation } from "./level-data";
import overviewMarkdown from "./articles/overview.md?raw";
import startMarkdown from "./articles/start.md?raw";
import widgetsMarkdown from "./articles/widgets.md?raw";
import pipelineMarkdown from "./articles/pipeline.md?raw";
import routingMarkdown from "./articles/routing.md?raw";
import testingMarkdown from "./articles/testing.md?raw";
import { NotFound, SearchError, RateLimited, BadEmail } from "./errors";
export interface Link {
  title: string;
  href: string;
}
export interface Article {
  kind?: "post" | "api" | "changelog";
  slug: string;
  title: string;
  summary: string;
  markdown: string;
  published: string;
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
      ...extraNavigation,
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
          { title: "Missing page", href: "/docs/missing" },
          { title: "A typed content pipeline", href: "/docs/pipeline" },
          { title: "Routes and links", href: "/docs/routing" },
          { title: "Testing content pages", href: "/docs/testing" },
          { title: "Overview article", href: "/docs/overview" }
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
  const articles: Record<string, Pick<Article, "title" | "markdown" | "kind">> = {
    ...extraArticles,
    overview: { title: "Welcome to Field Notes", markdown: overviewMarkdown },
    start: { title: "Getting started", markdown: startMarkdown },
    widgets: { title: "Independent widgets", markdown: widgetsMarkdown },
    pipeline: { title: "A typed content pipeline", markdown: pipelineMarkdown },
    routing: { title: "Routes and links", markdown: routingMarkdown },
    testing: { title: "Testing content pages", markdown: testingMarkdown }
  };
  if (!Object.hasOwn(articles, slug)) throw new NotFound("No article: " + slug);
  return {
    slug,
    ...articles[slug],
    summary: "Content first, with a few small tools beside it.",
    published: "2026-10-01T12:00:00Z",
    related: [
      { title: "Getting started", href: "/docs/start" },
      { title: "Independent widgets", href: "/docs/widgets" },
      { title: "A typed content pipeline", href: "/docs/pipeline" }
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
