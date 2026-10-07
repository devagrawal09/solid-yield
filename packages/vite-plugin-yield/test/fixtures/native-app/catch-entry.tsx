import { renderToString as nativeRender } from "solid-yield";
import { renderToString } from "@solidjs/web";
import { Catch } from "./Catch";
import { Catch as Original } from "./OriginalCatch";
export const native = () => nativeRender(Catch);
export const original = () => renderToString(Original);
