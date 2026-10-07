import { renderToString as nativeRender } from "solid-yield";
import { renderToString } from "@solidjs/web";
import { FailureView } from "./FailureView";
import { FailureView as Original } from "./OriginalFailureView";
export const native = () => nativeRender(FailureView);
export const original = () => renderToString(Original);
