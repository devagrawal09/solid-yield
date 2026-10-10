import { createMemo, lazy } from "solid-js";
import type { User } from "./Profile";

const Profile = lazy(() => import("./Profile"));

export default () => {
  const user = createMemo<User>(
    () => new Promise<User>(resolve => setTimeout(() => resolve({ firstName: "Jon" }), 10))
  );
  const info = createMemo<string[]>(
    () => new Promise<string[]>(resolve => setTimeout(() => resolve(["a"]), 10))
  );
  return <Profile user={user()} info={info()} />;
};
