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
  EVENT_MARK,
  bindEvent,
  blockName,
  holeOf,
  isGeneratorFunction,
  isRowBlock,
  renderView,
  rowArg,
  runRow
} from "./runtime.js";
export { For, Show, Switch, Match, Repeat, Loading, Errored } from "./flow.js";
export type { Reset } from "./flow.js";
export { render, hydrate } from "./render.js";
export { lazy } from "./lazy.js";
export { foreign, type ForeignCheck } from "./foreign.js";
export type { Element, ArrayElement, RenderedObject, TagType } from "./element.js";
export type { ViewYield, ViewReturn, NoJsxViewRule, ViewWrapperCheck } from "./runtime.js";
export type {
  AnyOp,
  Bind,
  BlockSetter,
  BlockStoreSetter,
  Bound,
  BoundEvent,
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
  MayWaitOf,
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
  StreamAttempt,
  TypedStore,
  View,
  ViewFails,
  ViewFn,
  ViewWrapped,
  ViewMayWait,
  ViewOp,
  ViewPending,
  Wait,
  Write,
  Yieldable
} from "./types.js";
