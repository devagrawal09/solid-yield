# C: oxc — design

C is an independent JavaScript checker. It does not load TypeScript. Oxc parses source and declaration files; oxc-resolver follows files, package exports and pnpm links.

## Graph and execution model

The module graph owns parsed ASTs, lexical scopes, bindings and exports. Imports resolve to bindings, not text names. A Solid intrinsic is identified only after its import/export chain reaches a Solid package. Type-only declarations are read separately: function returns, Promise returns, optional parameters, interfaces and aliases supply shapes, never inferred types or user failure guarantees.

The reactive graph is invocation-specific. Nodes include component activations, local cells, source accessors, function closures, objects, contexts, providers, prop thunks, reads, writes, detached handlers and rendered obligations. An activation has an environment, owner, scope (setup/tracking/handler/effect), provider stack, boundary stack and failure sink. Local cells are allocated per invocation. Branches fork environments; their results join. Closures keep cells rather than looking up the final name in a global table.

Example: `const C=createContext(); function App(){ const [n,set]=createSignal(0); return <C value={{n}}><Child/></C> } function Child(){ const s=useContext(C); return <b>{s.n()}</b> }` lowers to a context identity, an App activation, source/getter/setter nodes, provider(C, object(n)), Child activation under that provider, and a tracking read of the source. No setup read occurs while passing the object or copying the getter. Replacing the final JSX with `const x=s.n()` records a setup read and reports STRICT_READ_UNTRACKED there.

## Analyses

An AST interpreter builds and consumes this graph together. Function calls instantiate environments; memo computes run in a capture scope and produce source summaries (pending and failures). Reads route through their scope. JSX traversal preserves the exact provider/boundary path. Child prop expressions are deferred thunks: their obligations are applied at the consuming child read, with the caller expression related. Handler failures and promise rejections use separate sinks; catch chains and try/catch consume only the applicable sink. Root traversal emits uncovered obligations. Exported unrendered components retain informational obligations.

Platform contracts are receiver-based: unshadowed Math, JSON, Promise, console, DOM globals and known arrays/strings. A project method with the same name never acquires a platform guarantee.

## Partial checks and limits

Unsupported operations emit UNANALYZED_BOUNDARY and return a value that can be pending and fail with unknown. Unknown function annotations never promise failure-freedom. Inference requests not answered by syntax or annotations are recorded as `inferenceNeeded` entries with locations and reasons. Recursion/depth limits also widen rather than silently stop. Module-scope context escape and unknown identity-losing calls widen service members.

No fixture paths, names or expected results participate in analysis. Parsed modules can be cached across checks; update replaces a file and rechecks the graph. Diagnostics always point into original source. The shared Vite wrapper ships original code unchanged.

## Replacing TypeScript capabilities

| Capability | C replacement |
|---|---|
| Parser | oxc-parser ESTree AST |
| Module resolution | oxc-resolver, explicit source/declaration extensions and export conditions |
| Symbols | lexical environments and import/export binding links |
| Solid API identity | resolved package export identities |
| Default library facts | explicit global-receiver contracts |
| Declared types | annotation-only AST shape reader |
| Inference | expression evaluation where modeled, otherwise recorded worst case |
| Incremental program | cached parsed modules and fresh invocation graph |
