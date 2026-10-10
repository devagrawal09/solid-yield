import { createContext, createSignal, useContext, type Component } from "solid-js";
type RouterValue = [
  () => string,
  { setLocation: (value: string) => void; matches: (match: string) => boolean }
];
const RouterContext = createContext<RouterValue>();
export function RouteHOC(Comp: Component): Component<{ url?: string }> {
  return (props = {}) => {
    const [location, setLocation] = createSignal("index");
    const matches = (match: string) => match === location();
    window.onpopstate = () => setLocation(window.location.pathname.slice(1) || "index");
    return (
      <RouterContext value={[location, { setLocation, matches }]}>
        <Comp />
      </RouterContext>
    );
  };
}
export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error("no router");
  return router;
}
