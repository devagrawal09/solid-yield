import { AsyncLocalStorage } from "node:async_hooks";

export const requests = new AsyncLocalStorage<{ request: Request }>();
