import { renderToString as nativeRender } from "solid-yield";
import { renderToString } from "@solidjs/web";
import { Counter } from "./Counter";
import { Counter as Original } from "./Original";
export const native = () => nativeRender(Counter);
export const original = () => renderToString(Original);
export { generateHydrationScript } from "@solidjs/web";
import { CatchAction } from "./CatchAction";
import { CatchAction as OriginalCatchAction } from "./OriginalCatchAction";
export const nativeAction = () => nativeRender(CatchAction);
export const originalAction = () => renderToString(OriginalCatchAction);

import { AsyncReads } from "./AsyncReads";
import { AsyncReads as OriginalAsyncReads } from "./OriginalAsyncReads";
export const nativeAsync = () => nativeRender(AsyncReads);
export const originalAsync = () => renderToString(OriginalAsyncReads);
