// The HN SPA twin driven through jsdom (client-only, fixture data — see
// vitest.config.ts): the feeds and their pagination, story
// rows (link / ask / job shapes), a story page with its comment tree and the
// collapse toggles, a user page, and client navigation between them.
import App from "../src/app";
import { click, install, mount, settle, uninstall, type Mounted } from "./script";

let app: Mounted;
afterEach(() => {
  app?.dispose();
  uninstall();
});

async function open(path: string) {
  install(path);
  app = mount(App);
  expect(app.root.querySelector(".news-list-nav")?.textContent).toBe("Loading...");
  await settle();
}

const $ = (sel: string) => app.root.querySelector<HTMLElement>(sel);
const $$ = (sel: string) => [...app.root.querySelectorAll<HTMLElement>(sel)];
const titles = () => $$(".news-item .title > a").map(a => a.textContent);

describe("hackernews-spa with solid-yield", () => {
  it("renders the top feed with 30 rows and paging controls", async () => {
    await open("/");
    expect($$(".news-item")).toHaveLength(30);
    expect(titles().slice(0, 2)).toEqual(["top story 1", "top story 2"]);
    expect($(".news-list-nav span.page-link.disabled")?.textContent).toBe("< prev");
    expect($(".news-list-nav > span:not(.page-link)")?.textContent).toBe("page 1");
    expect($('a[aria-label="Next Page"]')?.getAttribute("href")).toBe("/top?page=2");
    // A link story: score, external title, host, meta with author and comments.
    const first = $$(".news-item")[0];
    expect(first.querySelector(".score")?.textContent).toBe("999");
    expect(first.querySelector(".title a")?.getAttribute("href")).toBe("https://example.com/top/1");
    expect(first.querySelector(".host")?.textContent).toBe(" (example.com)");
    expect(first.querySelector(".meta")?.textContent).toBe("by user1 1 hours ago | 2 comments");
    expect(first.querySelector(".label")).toBeNull();
    // No url: the title links to the story page; no comments: "discuss".
    const fourth = $$(".news-item")[3];
    expect(fourth.querySelector(".title a")?.getAttribute("href")).toBe("/stories/top-4");
    expect($$(".news-item")[2].querySelector(".meta a:last-child")?.textContent).toBe("discuss");
  });

  it("pages forward and back; the last page has no 'more'", async () => {
    await open("/");
    await click(app, 'a[aria-label="Next Page"]');
    expect(location.search).toBe("?page=2");
    expect($$(".news-item")).toHaveLength(12);
    expect(titles()[0]).toBe("top story 31");
    expect($(".news-list-nav > span:not(.page-link)")?.textContent).toBe("page 2");
    expect($(".news-list-nav span.page-link.disabled")?.textContent).toBe("more >");
    await click(app, 'a[aria-label="Previous Page"]');
    expect(titles()[0]).toBe("top story 1");
  });

  it("switches feeds from the nav, with job and ask row shapes", async () => {
    await open("/");
    await click(app, 'a[href="/job"]');
    expect(location.pathname).toBe("/job");
    const job = $$(".news-item")[0];
    expect(job.querySelector(".meta")?.textContent).toBe("1 hours ago");
    expect(job.querySelector(".label")?.textContent).toBe("job");
    await click(app, 'a[href="/ask"]');
    expect($$(".news-item")[2].querySelector(".label")?.textContent).toBe("ask");
    expect($$(".news-item")[0].querySelector(".label")).toBeNull();
  });

  it("renders a story page and its comment tree; toggles collapse and expand", async () => {
    await open("/stories/abc");
    expect($("h1")?.textContent).toBe("Story abc");
    expect($(".host")?.textContent).toBe("(example.com)");
    expect($(".meta")?.textContent).toBe("42 points | by user1 3 hours ago");
    expect($(".item-view-comments-header")?.textContent).toBe("4 comments");
    expect($$(".comment .by a").map(a => a.textContent)).toEqual(["alice", "bob", "carol", "dave"]);
    expect($(".comment .text")?.innerHTML).toBe("<p>First <i>comment</i></p>");
    const toggle = $(".toggle")!;
    expect(toggle.className).toBe("toggle open");
    expect(toggle.textContent).toBe("[-]");
    await click(app, ".toggle a");
    expect(toggle.className).toBe("toggle");
    expect(toggle.textContent).toBe("[+] comments collapsed");
    expect((toggle.nextElementSibling as HTMLElement).style.display).toBe("none");
    await click(app, ".toggle a");
    expect((toggle.nextElementSibling as HTMLElement).style.display).toBe("block");
  });

  it("navigates from a comment to its author's page", async () => {
    await open("/stories/abc");
    await click(app, '.comment .by a[href="/users/alice"]');
    expect(location.pathname).toBe("/users/alice");
    expect($("h1")?.textContent).toBe("User : alice");
    expect($$(".meta li").map(li => li.textContent)).toEqual([
      "Created: 1700000000",
      "Karma: 1234"
    ]);
    expect($(".links a")?.getAttribute("href")).toBe(
      "https://news.ycombinator.com/submitted?id=alice"
    );
  });

  it("shows a user's about when there is one", async () => {
    await open("/users/user1");
    expect($(".about")?.innerHTML).toBe("<p>About <b>me</b></p>");
  });

  it("serves the big cached thread from the capture", async () => {
    await open("/stories/30186326");
    expect($("h1")?.textContent).toBe("Facebook loses users for the first time");
    expect($$(".comment").length).toBeGreaterThan(1000);
  });
});
