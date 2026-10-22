# Shared context fixture manifest

29 strict native cases and 12 in-subset mutants. Empty expectations are negative controls.
All sources: fixtures/context-sources.mjs. Expectations: fixtures/context.mjs.

| fixture | errors | warnings | origin / parent |
|---|---|---|---|
| context-plain-object | none | none | native context case |
| context-default | none | none | native context case |
| context-missing-provider | CONTEXT_PROVIDER_MISSING | none | native context case |
| context-provider-over-default | ERROR_OUTSIDE_ERRORED_BOUNDARY | none | native context case |
| context-signal-view | none | none | native context case |
| context-signal-setup | STRICT_READ_UNTRACKED | none | native context case |
| context-factory-memo | none | none | native context case |
| context-helper-alias | none | none | native context case |
| context-method-view | none | none | native context case |
| context-method-setup | STRICT_READ_UNTRACKED | none | native context case |
| context-async-covered | none | none | native context case |
| context-async-uncovered | ASYNC_OUTSIDE_LOADING_BOUNDARY | none | native context case |
| context-async-setup | PENDING_ASYNC_UNTRACKED_READ | none | native context case |
| context-pending-handler | none | PENDING_ASYNC_IN_HANDLER | native context case |
| context-failing-memo-covered | none | none | native context case |
| context-failing-handler | UNHANDLED_HANDLER_FAILURE | none | native context case |
| context-promise-caught | none | none | native context case |
| context-promise-uncaught | UNHANDLED_HANDLER_FAILURE | none | native context case |
| context-optional-api-caught | none | none | native context case |
| context-optional-api-uncaught | UNHANDLED_HANDLER_FAILURE | none | native context case |
| context-injected-sync | UNHANDLED_HANDLER_FAILURE | none | native context case |
| context-nested-shadow | none | none | native context case |
| context-provider-identity | none | none | native context case |
| context-module-escape | ERROR_OUTSIDE_ERRORED_BOUNDARY, ASYNC_OUTSIDE_LOADING_BOUNDARY | UNANALYZED_BOUNDARY | native context case |
| context-unknown-escape | ERROR_OUTSIDE_ERRORED_BOUNDARY, ASYNC_OUTSIDE_LOADING_BOUNDARY | UNANALYZED_BOUNDARY | native context case |
| context-prop-child-boundaries | none | none | native context case |
| context-prop-caller-boundaries | none | none | native context case |
| context-prop-uncovered | ERROR_OUTSIDE_ERRORED_BOUNDARY, ASYNC_OUTSIDE_LOADING_BOUNDARY | none | native context case |
| context-method-write-handler | none | none | native context case |
| m-context-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | none | cases/context-async-covered |
| m-context-errored-removed | ERROR_OUTSIDE_ERRORED_BOUNDARY | none | cases/context-failing-memo-covered |
| m-context-catch-removed | UNHANDLED_HANDLER_FAILURE | none | cases/context-promise-caught |
| m-context-optional-catch-removed | UNHANDLED_HANDLER_FAILURE | none | cases/context-optional-api-caught |
| m-context-provider-removed | CONTEXT_PROVIDER_MISSING | none | cases/context-plain-object |
| m-context-default-removed | CONTEXT_PROVIDER_MISSING | none | cases/context-default |
| m-context-shadow-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | none | cases/context-nested-shadow |
| m-context-alias-setup | STRICT_READ_UNTRACKED | none | cases/context-helper-alias |
| m-context-method-write-memo | REACTIVE_WRITE_IN_OWNED_SCOPE | none | cases/context-method-write-handler |
| m-context-prop-child-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | none | cases/context-prop-child-boundaries |
| m-context-prop-child-errored-removed | ERROR_OUTSIDE_ERRORED_BOUNDARY | none | cases/context-prop-child-boundaries |
| m-context-read-to-handler | none | PENDING_ASYNC_IN_HANDLER | cases/context-async-covered |
