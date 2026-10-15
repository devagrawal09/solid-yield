// An async rejection after the shell is flushed is delivered to the client.
export function expectsDocsRejection(twin, entry, url) {
  return (
    /(?:^|\/)docs(?:-yield)?$/.test(twin) &&
    entry === "stream" &&
    (url === "/docs/missing" || (/docs-yield$/.test(twin) && url === "/docs/sibling"))
  );
}

export function serializedDocsError(html, twin = "docs", url = "/docs/missing") {
  // Require an Error in an inline script, not text in server markup.
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].some(([, body]) => {
    const sibling = url === "/docs/sibling";
    const message = sibling
      ? /new Error\("Article unavailable: sibling"\)/
      : /new Error\("No article: missing"\)/;
    const kind = sibling ? /kind:"article-unavailable"/ : /kind:"not-found"/;
    const wire = sibling ? /docs\/ArticleUnavailable/ : /docs\/NotFound/;
    return (
      message.test(body) &&
      kind.test(body) &&
      (!/docs-yield$/.test(twin) || (wire.test(body) && /resource:"article"/.test(body)))
    );
  });
}

export function unexpectedRenderLog(message, expectedRejection) {
  // Accept only Solid's diagnostic for this explicitly tested client delivery.
  const codes = message.match(/\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\]/g) ?? [];
  return !(
    expectedRejection &&
    codes.length > 0 &&
    codes.every(code => code === "[SSR_RENDER_ERROR_CONTAINED]")
  );
}
