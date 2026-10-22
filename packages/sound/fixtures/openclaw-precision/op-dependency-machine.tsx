import { connect } from "@precision/machine";
export function App() {
  return <button onClick={() => { try { connect().get("layer"); } catch {} }}>connect</button>;
}
