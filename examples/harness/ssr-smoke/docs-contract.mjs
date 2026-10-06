// An async rejection after the shell is flushed is delivered to the client.
export function expectsDocsRejection(twin, entry, url) {
  return /(?:^|\/)docs(?:-yield)?$/.test(twin) && entry === "stream" && url === "/docs/missing";
}

export function serializedDocsError(html) {
  // Require an Error in an inline script, not text in server markup.
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].some(
    ([, body]) => /new Error\("No article: missing"\)/.test(body) && /kind:"not-found"/.test(body)
  );
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
