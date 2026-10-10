# ref-in-show

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/ref-in-show`

Input: A `ref` on an element inside `<Show>`/`<For>` children (assignment form `ref={el}` with `let el`, callback form `ref={(e) => (el = e)}`, or a `let` declared in the row) is refused. The same ref at a component's top level lowers (control: move the element into its own component).

Expected: Lowers (valid Solid 2: `ref={el}` on a bare `let` is the documented single-ref form; Solid's own build and runtime accept all three).

Actual: `RefInShow.tsx:1:1 / RefCallbackInShow.tsx:1:1 / RefInForRow.tsx:1:1 error TS95000: [NATIVE_HANDLER] A property event handler needs a checked shared event-call contract.` - wrong code (it is a ref, not a handler) and no authored position (1:1). In the app: Toolbar, QuickNav, Search, Stats (x8), buildings/[id] (x2), TechnologySelector, TwitchQuiz.
