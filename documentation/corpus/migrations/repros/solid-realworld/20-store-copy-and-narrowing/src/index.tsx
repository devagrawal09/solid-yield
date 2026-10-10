import { render } from "@solidjs/web";
import { Editor } from "./App";

function Root() {
  return <Editor slug="a" />;
}
render(() => <Root />, document.body);
