import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { lowerNativeProject } from "../src/native.js";

// F-S48: an anonymous default-exported component is named after its file.
const lower = (source, name = "fixtures/default-components/Profile.tsx") => {
  const file = resolve(import.meta.dirname, name);
  const result = lowerNativeProject(new Map([[file, source]]));
  expect(result.diagnostics).toEqual([]);
  return result.files.get(file);
};

describe("native anonymous default components (F-S48)", { timeout: 60_000 }, () => {
  it("names an arrow with a block body after its file", () => {
    const code = lower(`import {createSignal} from 'solid-js';
export default () => { const [n] = createSignal(1); return <p>{n()}</p>; };`);
    expect(code).toContain("const Profile = component(function* Profile()");
    expect(code).toContain("export default Profile;");
  });

  it("names an arrow with an expression body and props", () => {
    const code = lower(`export default (props: {label: string}) => <p>{props.label}</p>;`);
    expect(code).toContain("const Profile = component(function* Profile(props");
    expect(code).toContain("yield* props.label");
  });

  it("names an anonymous function declaration", () => {
    const code = lower(`export default function () { return <p>hi</p>; }`);
    expect(code).toContain("const Profile = component(function* Profile()");
  });

  it("takes an index file's directory name", () => {
    const code = lower(
      `export default () => <p>hi</p>;`,
      "fixtures/default-components/settings-page/index.tsx"
    );
    expect(code).toContain("const Settingspage = component(");
  });

  it("does not take a name the file already binds", () => {
    const code = lower(`import Profile from './Profile.view';
export default () => <section><Profile/></section>;`);
    expect(code).toContain("const ProfileDefault = component(function* ProfileDefault()");
  });

  it("leaves a default export that is not a component", () => {
    const code = lower(`export default (n: number) => n + 1;`);
    expect(code).toContain("export default (n: number) => n + 1;");
  });
});
