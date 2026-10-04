/*
 * Generator blocks for Solid, as a library: strict generator syntax, its
 * types, and a runtime interpreter on Solid's public API. No blocks
 * compiler; the JSX transform's one block rule (`yield*` inside JSX becomes
 * `perform(…)`) makes JSX views fine-grained.
 *
 * See documentation/plans/blocks-library.md.
 */
export {
  $cleanup,
  $component,
  $effect,
  $event,
  $memo,
  $optimistic,
  $optimisticStore,
  $projection,
  $settled,
  $signal,
  $untrack,
  $store,
  attempt,
  constant,
  createContext,
  isComponent,
  isPendingOf,
  latestOf,
  perform,
  raise,
  readStore,
  refresh,
  until,
  view,
  type BlockContext
} from "./runtime.js";
/** @internal shared with the `h` entry (one runtime per app). */
export {
  READ,
  VIEW_MARK,
  COMPONENT_MARK,
  blockName,
  holeOf,
  isGeneratorFunction,
  isRowBlock,
  renderView,
  rowArg,
  runRow
} from "./runtime.js";
export { For, Show, Switch, Match, Repeat, Loading, Errored } from "./flow.js";
export { render, hydrate } from "./render.js";
export { lazy } from "./lazy.js";
export type { Element, ArrayElement, RenderedObject, TagType } from "./element.js";
export type { ViewYield, ViewReturn, NoJsxViewRule } from "./runtime.js";
export type {
  AnyOp,
  BlockSetter,
  BlockStoreSetter,
  ChildView,
  Cleanup,
  Component,
  ComponentView,
  ContextRead,
  Create,
  EffectOp,
  ErrorClass,
  EventCall,
  EventCallOp,
  EventHandler,
  ReadsPendingOf,
  WaitsOf,
  EventOp,
  FailsOf,
  Failure,
  KindCheck,
  NeedsKind,
  HView,
  HViewOp,
  HoleOp,
  MemoOp,
  Path,
  PendingOf,
  HoleProp,
  Props,
  PropsArgs,
  PropsInput,
  PropsOf,
  Raise,
  Read,
  ReadThrough,
  Receipt,
  RowBlock,
  RowFails,
  RowPending,
  SettledSource,
  SettledView,
  SetupOp,
  Source,
  SettledProp,
  TypedStore,
  View,
  ViewFails,
  ViewOp,
  ViewPending,
  Wait,
  Write,
  Yieldable
} from "./types.js";
