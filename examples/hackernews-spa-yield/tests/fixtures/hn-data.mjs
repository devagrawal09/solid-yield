// Deterministic HN API fixtures: the sandbox the checks run in has no
// network, and the live API is not deterministic anyway. Shared by the jsdom
// tests (as the `hn` server module's data) and the browser check (as a
// `fetch` stub the production servers are started with).

const FEEDS = { news: "top", newest: "new", show: "show", ask: "ask", jobs: "job" };

/** One feed page: 30 stories on page 1, 12 on page 2, none after. */
export function feed(type, page) {
  const count = page === 1 ? 30 : page === 2 ? 12 : 0;
  return Array.from({ length: count }, (_, i) => {
    const n = (page - 1) * 30 + i + 1;
    const kind = type === "job" ? "job" : type === "ask" && n % 3 === 0 ? "ask" : "link";
    const hasUrl = kind !== "ask" && n % 4 !== 0;
    return {
      id: `${type}-${n}`,
      points: String(1000 - n),
      url: hasUrl ? `https://example.com/${type}/${n}` : `item?id=${type}-${n}`,
      title: `${type} story ${n}`,
      domain: hasUrl ? "example.com" : "",
      type: kind,
      time_ago: `${n} hours ago`,
      user: `user${n % 5}`,
      comments_count: n % 3 === 0 ? 0 : n * 2,
      comments: []
    };
  }).map(story => (story.url.startsWith("item?") ? { ...story, url: "" } : story));
}

export function item(id) {
  const comment = (user, content, comments = []) => ({
    user,
    time_ago: "1 hour",
    content,
    comments
  });
  return {
    id,
    points: "42",
    url: `https://example.com/item/${id}`,
    title: `Story ${id}`,
    domain: "example.com",
    type: "link",
    time_ago: "3 hours",
    user: "user1",
    comments_count: 4,
    comments: [
      comment("alice", "<p>First <i>comment</i></p>", [
        comment("bob", "<p>A reply</p>", [comment("carol", "<p>Deeper</p>")])
      ]),
      comment("dave", "<p>No replies here</p>")
    ]
  };
}

export function user(id) {
  return {
    id,
    created: "1700000000",
    karma: 1234,
    about: id === "user1" ? "<p>About <b>me</b></p>" : ""
  };
}

/** `fetch`'s answer for an HN API URL, or null when the URL is not one. */
export function answer(url) {
  const u = new URL(url);
  if (u.hostname === "node-hnapi.herokuapp.com") {
    const [, head, id] = u.pathname.split("/");
    if (head === "item") return item(id);
    if (head in FEEDS) return feed(FEEDS[head], Number(u.searchParams.get("page")) || 1);
  }
  if (u.hostname === "hacker-news.firebaseio.com") {
    const m = /\/v0\/user\/(.+)\.json$/.exec(u.pathname);
    if (m) return user(m[1]);
  }
  return null;
}
