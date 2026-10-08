import { frameTransformDirectResult } from "@solidjs/web/frames";
import { encodeHostedRegion } from "./solid-adapter.js";

export function hostedRegionResult(value, context) {
  return encodeHostedRegion(value, context, frameTransformDirectResult);
}
