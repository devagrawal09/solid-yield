// `node --import` hook for the production servers in the browser check:
// answers the HN API hosts from the fixtures (no network in the sandbox),
// passes every other request through. Loaded for the original and the twin
// alike, so both render the same data.
import { answer } from "./hn-data.mjs";

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const data = answer(url);
  if (data === null) return realFetch(input, init);
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" }
  });
};
