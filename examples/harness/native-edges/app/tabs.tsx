import { createContext, createMemo, createSignal, useContext, type Component } from "solid-js";

// F-S52: a context value declared with plain function types, given a memo, a
// setter and a routine; F-S45: a tuple, read through destructuring.
type TabsValue = [() => string, { select: (tab: string) => void; is: (tab: string) => boolean }];

const TabsContext = createContext<TabsValue>();

// F-S51: a component factory; its component closes over the page.
export function withTabs(Page: Component): Component<{ initial?: string }> {
  return (props = {}) => {
    const [chosen, select] = createSignal<string>();
    const tab = createMemo(() => chosen() ?? props.initial ?? "rows");
    const is = (name: string) => name === tab();
    return (
      <TabsContext value={[tab, { select, is }]}>
        <Page />
      </TabsContext>
    );
  };
}

export function useTabs() {
  const tabs = useContext(TabsContext);
  if (!tabs) throw new Error("no tabs");
  return tabs;
}

export function Tab(props: { name: string }) {
  const [, { select, is }] = useTabs();
  return (
    <button class={{ tab: true, chosen: is(props.name) }} onClick={() => select(props.name)}>
      {props.name}
    </button>
  );
}
