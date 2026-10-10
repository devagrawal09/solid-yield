import { createComments } from "./comments";

// A store factory composed from a smaller factory (solid-realworld's createConduit shape).
export function createConduit() {
  const { comments, actions } = createComments();
  const store = { comments };
  const conduit: [typeof store, typeof actions] = [store, actions];
  return conduit;
}
