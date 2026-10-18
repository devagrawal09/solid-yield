import { component, renderToString, view } from "solid-yield";
import { nativeC, type NativeProps } from "../../src/native-props.js";

it.each([undefined, 7])("renders an optional user symbol prop on the server (%s)", value => {
  const symbol = Symbol("user prop");
  const Page = nativeC(
    component(function* (props: NativeProps<{ [symbol]?: number }>) {
      return view(function* () {
        return <p>{(yield* props[symbol]) ?? "missing"}</p>;
      });
    })
  );
  const props = Object.freeze(value === undefined ? {} : { [symbol]: value });
  const html = renderToString(() => Page(props));
  expect(html.replace(/<!--[^>]*-->/g, "")).toContain(value === undefined ? "missing" : "7");
});

it("renders held foreign bags, primitive props and omitted props on the server", () => {
  const Page = nativeC(
    component(function* Page(
      props: NativeProps<{
        params: { id: string };
        location: { pathname: string };
        title: string;
        label?: string;
      }>
    ) {
      return view(function* () {
        return (
          <p>
            {yield* props.title}:{yield* props.params.id}:{yield* props.location.pathname}:
            {(yield* props.label) ?? "missing"}
          </p>
        );
      });
    })
  );
  const props = Object.freeze({
    params: Object.freeze({ id: "inc-101" }),
    location: Object.freeze({ pathname: "/incidents/inc-101" }),
    title: "Incident"
  });
  const html = renderToString(() => Page(props));
  expect(html.replace(/<!--[^>]*-->/g, "")).toContain(
    "Incident:inc-101:/incidents/inc-101:missing"
  );
});
