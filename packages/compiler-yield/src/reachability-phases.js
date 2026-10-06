// Audited against each tests/script.ts. e=event, s=settled/streamed source,
// c=foreign navigation materializes that component family, !=background work.
// Every phase is explicit, including idle and continuation phases.
const e = name => `e:${name}`;
const s = name => `s:${name}`;
const c = name => `c:${name}`;
export function phasePlan(twin) {
  if (twin === "docs-yield")
    return [
      [],
      [],
      [],
      [],
      [],
      [c("DocPage"), s("ArticleContent.article#2")],
      [s("ArticleContent.article#2")],
      [e("ThemeToggle.toggle")],
      [e("SearchBox.edit")],
      [s("SearchBox.results")],
      [e("LikeButton.add#2")],
      [e("LikeButton.add#2")],
      [e("LikeButton.add#2")],
      [e("LikeButton.add#2")],
      [e("NewsletterForm.edit")],
      [e("NewsletterForm.submit")],
      [e("NewsletterForm.submit")],
      [e("NewsletterForm.edit")],
      [e("NewsletterForm.submit")],
      [e("NewsletterForm.submit")],
      [e("ImageCarousel.next")],
      [e("SearchBox.edit")],
      [s("SearchBox.results")],
      [c("DocPage"), s("ArticleContent.article#2")],
      [s("ArticleContent.article#2")]
    ];
  if (twin.startsWith("todos-yield"))
    return [
      [],
      ["!effects"],
      [s("App.todos")],
      [e("Header.submit")],
      [e("Header.submit")],
      [e("TodoItem.toggle")],
      [e("TodoItem.toggle")],
      [e("App.onChange")],
      [e("App.onChange")],
      [e("App.onChange")],
      [e("MainSection.toggle")],
      [e("MainSection.toggle")],
      [e("MainSection.toggle")],
      [e("MainSection.toggle")],
      [e("TodoItem.toggle")],
      [e("TodoItem.toggle")],
      [e("TodoItem.retry")],
      [e("TodoItem.retry")],
      [e("Header.submit")],
      [e("Header.submit")],
      [e("TodoItem.retry")],
      [e("TodoItem.retry")],
      [e("TodoItem.toggle")],
      [e("TodoItem.toggle")],
      [e("Footer.clear")],
      [e("Footer.clear")],
      [e("TodoItem.remove")],
      [e("TodoItem.remove")]
    ];
  if (twin.startsWith("sierpinski-yield")) {
    const frames = [e("TriangleDemo.update"), s("Triangle.slowChildren")];
    const ticks = [...frames, e("TriangleDemo.tick")];
    return [
      [],
      ["!timers"],
      frames,
      ticks,
      frames,
      [e("Dot.onEnter")],
      [e("Dot.onEnter")],
      [e("Dot.onExit")],
      ticks,
      frames,
      ticks,
      frames
    ];
  }
  if (twin === "hackernews-spa-yield") {
    const feed = [s("Stories.page"), s("Stories.type"), s("Stories.stories")];
    return [
      [],
      feed,
      feed,
      feed,
      feed,
      feed,
      feed,
      [s("Story.story")],
      [e("Toggle.toggle")],
      [e("Toggle.toggle")],
      [e("Toggle.toggle")],
      [s("User.user")],
      feed,
      feed,
      [s("User.user")],
      feed
    ];
  }
  if (twin === "room-yield") {
    const streams = [
      s("Header.who"),
      s("Chat.store"),
      s("DirectoryEntry.who"),
      s("Card.card"),
      s("SummaryText.text"),
      "!reports"
    ];
    return [
      [],
      ["!effects"],
      streams,
      [s("Card.members")],
      [s("Card.activity"), s("SummaryText.text")],
      [e("Composer.input"), e("Composer.submit")],
      [s("Chat.store"), e("Chat.post")],
      [s("SummaryText.text"), s("Card.activity")],
      [e("Chaos.drop"), "!reports", s("SummaryText.text")],
      streams,
      [e("Summary.regenerate")],
      [s("SummaryText.text"), s("Archive.stats"), s("Card.activity")],
      [s("Live.room"), c("Live")],
      [...streams, s("Card.members"), s("Card.activity"), s("Archive.stats")]
    ];
  }
  if (twin === "effect-yield") {
    const search = [e("Typeahead.onInput"), e("App.append")],
      results = [s("Typeahead.results"), e("App.append")];
    const order = [e("Checkout.place"), e("App.append")];
    return [
      [],
      [],
      search,
      search,
      results,
      search,
      [],
      results,
      search,
      results,
      search,
      search,
      results,
      results,
      [e("Typeahead.reset"), e("App.append")],
      results,
      [e("LogPanel.clear")],
      [e("App.showCheckout")],
      [s("Checkout.orders")],
      [e("Checkout.increment")],
      [e("Checkout.decrement")],
      order,
      order,
      order,
      order,
      [s("Checkout.orders")],
      [e("Checkout.toggleDecline")],
      order,
      order,
      order,
      [e("Checkout.toggleDecline")],
      order,
      order,
      [e("Checkout.cancel"), e("Checkout.base"), e("App.append")],
      order,
      [e("App.showTypeahead")],
      []
    ];
  }
  if (twin === "rendering-yield") {
    const nav = [e("Link.navigate")],
      cards = [s("AsyncCard.value")];
    return [
      [],
      ["!effects", c("Home")],
      [e("Home.tick")],
      nav,
      [s("ProfilePage.user"), s("ProfilePage.info")],
      nav,
      [e("Settings.input")],
      [e("Settings.count")],
      [e("Settings.close")],
      [e("Settings.count")],
      [e("Settings.open")],
      [e("Settings.close")],
      nav,
      [s("Stream.memoItems"), s("Stream.cell")],
      [s("Stream.memoItems"), s("Stream.cell")],
      nav,
      [s("InnerBoundaryItem.item"), s("OuterBoundaryItem.item")],
      [e("InnerBoundaryItem.retry#2")],
      [e("OuterBoundaryItem.retry#2")],
      nav,
      cards,
      [e("RevealPage.event"), e("RevealPage.restart"), ...cards],
      cards,
      [e("RevealPage.event"), e("RevealPage.collapse"), e("RevealPage.restart"), ...cards],
      nav,
      [s("Skeleton.feed"), s("Skeleton.cell")],
      [e("Skeleton.refetch")],
      [s("Skeleton.feed"), s("Skeleton.cell")],
      nav,
      [e("Router.event")]
    ];
  }
  throw new Error(`No phase plan for ${twin}`);
}
export function selectPhase(g, spec, nameOf) {
  const seeds = new Set(),
    changed = new Set();
  for (const token of spec) {
    let found;
    if (token === "!effects") found = g.parts.filter(p => p.kind === "effect");
    else if (token === "!timers") found = g.parts.filter(p => p.kind === "timer");
    else if (token === "!reports") found = g.events.filter(p => p.binding?.name === "report");
    else {
      const [kind, target] = token.split(":");
      const [name, instance] = target.split("#");
      found = g.parts.filter(p => {
        if (kind === "c") {
          for (let f = p.owner; f; f = f.parent)
            if (f.name === name) return !["event", "bind", "timer"].includes(p.kind);
          return false;
        }
        return (
          nameOf(p).split("@")[0] === name &&
          (kind === "e" ? p.kind === "event" : ["cell", "memo"].includes(p.kind))
        );
      });
      if (instance) found = found.slice(Number(instance) - 1, Number(instance));
      if (kind === "s") for (const p of found) changed.add(p);
    }
    if (!found.length) throw new Error(`Unresolved phase token ${token}`);
    for (const p of found) seeds.add(p);
  }
  return g.reach([...seeds], [...changed]);
}

// Phases with an external interaction, not a continuation or timer advance.
export function interactionIndices(twin) {
  if (twin === "docs-yield") return [5, 7, 8, 10, 12, 14, 15, 17, 18, 20, 21, 23];
  if (twin === "effect-yield")
    return [2, 3, 5, 8, 10, 11, 14, 16, 17, 19, 20, 21, 26, 27, 30, 31, 33, 35];
  if (twin === "hackernews-spa-yield") return Array.from({ length: 14 }, (_, i) => i + 2);
  if (twin === "rendering-yield")
    return [3, 5, 6, 7, 8, 9, 10, 11, 12, 15, 17, 18, 19, 21, 23, 24, 26, 28, 29];
  if (twin === "room-yield") return [5, 8, 10, 12];
  if (twin.startsWith("sierpinski")) return [5, 6, 7];
  if (twin.startsWith("todos")) return [3, 5, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26];
  throw new Error(`No interactions for ${twin}`);
}
