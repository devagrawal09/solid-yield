vi.mock("@solidjs/web", async importOriginal => {
  const actual = await importOriginal<typeof import("@solidjs/web")>();
  const { requests } = await import("./request-context");
  return { ...actual, getRequestEvent: () => requests.getStore() };
});
