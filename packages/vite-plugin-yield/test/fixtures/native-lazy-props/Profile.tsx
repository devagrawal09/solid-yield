import { For, Loading } from "solid-js";

export interface User {
  firstName: string;
}

function Profile(props: { info: string[]; user: User }) {
  return (
    <>
      <h1>{props.user.firstName}</h1>
      <Loading fallback="…">
        <ul>
          <For each={props.info}>{fact => <li>{fact}</li>}</For>
        </ul>
      </Loading>
    </>
  );
}

export default Profile;
