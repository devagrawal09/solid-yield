import { renderToString as nativeRender } from "solid-yield";
import { renderToString } from "@solidjs/web";
import { Counter } from "./Counter";
import { Counter as Original } from "./Original";
export const native = () => nativeRender(Counter);
export const original = () => renderToString(Original);
export { generateHydrationScript } from "@solidjs/web";
