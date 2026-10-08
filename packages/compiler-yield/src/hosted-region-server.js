import { frameTransformDirectResult } from "@solidjs/web/frames";

// rc.13 has a public stream/slot encoder, but no document-slot encoder apart
// from this helper. Keep its slot records and hydration scopes; replace only
// its fixed outer template with the root selected by the bounded R lowering.
// This is a pinned output-shape adapter, not a new option on Solid's API.
export function hostedRegionResult(value, context) {
  if (typeof value !== "function") return value;
  const root = value.regionRoot;
  if (root !== "main" && root !== "section") throw new Error("Unknown R host root");
  const encoded = frameTransformDirectResult(value, context);
  return Object.assign(props => {
    const nodes = encoded(props);
    if (
      !Array.isArray(nodes) ||
      nodes.length !== 3 ||
      !nodes[0]?.t?.startsWith('<solid-frame data-fid="') ||
      nodes[2]?.t !== "</solid-frame>"
    )
      throw new Error("R document encoder shape changed; re-prove existing-element hosts");
    return [
      {
        t: nodes[0].t
          .replace("<solid-frame", `<${root}`)
          .replace(' style="display:contents"', root === "section" ? ' class="reading-guide"' : "")
      },
      nodes[1],
      { t: `</${root}>` }
    ];
  }, encoded);
}
