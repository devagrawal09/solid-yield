import { component, view } from "solid-yield";
import { nativeC, type NativeProps } from "../src/native-props.js";
import type { Path, Source, PROPS } from "../src/types.js";
const symbol = Symbol("user prop");
type ProtocolProps = NativeProps<{ [Symbol.toStringTag]: string; [symbol]: number }>;
declare const protocolProps: ProtocolProps;
declare const declaredProps: Parameters<NonNullable<ProtocolProps[typeof PROPS]>>[0];

const Page = nativeC(
  component(function* (
    props: NativeProps<{ params: { id: string }; label?: string; [symbol]?: number }>
  ) {
    return view(function* () {
      const id: string = yield* props.params.id;
      const label: string | undefined = yield* props.label;
      const value: number | undefined = yield* props[symbol];
      return (
        <p>
          {id}
          {label}
          {value}
        </p>
      );
    });
  })
);

if (false) {
  const omittedProtocol: NativeProps<{ [Symbol.toStringTag]?: string }> = {};
  const optionalProtocol: string | undefined = omittedProtocol[Symbol.toStringTag];
  // @ts-expect-error An optional protocol field remains possibly undefined.
  const requiredProtocol: string = omittedProtocol[Symbol.toStringTag];
  const rawProtocol: string = protocolProps[Symbol.toStringTag];
  const userPath: Path<number> = protocolProps[symbol];
  const declaredProtocol: string = declaredProps[Symbol.toStringTag];
  const declaredUser: Source<number> = declaredProps[symbol];
  Page({ params: { id: "inc-101" } });
  Page({ params: { id: "inc-101" }, label: "Incident" });
  Page({ params: { id: "inc-101" }, [symbol]: 7 });
  // @ts-expect-error User symbol props retain their value type.
  Page({ params: { id: "inc-101" }, [symbol]: "wrong" });
  // @ts-expect-error A foreign caller must still supply required props.
  Page({});
  // @ts-expect-error The facade retains the original prop's value type.
  Page({ params: { id: 101 } });
}
