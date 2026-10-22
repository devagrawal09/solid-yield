import { placement } from "@precision/machine";
export function App() {
  return <button onClick={() => { try { placement("bottom-start"); } catch {} }}>place</button>;
}
