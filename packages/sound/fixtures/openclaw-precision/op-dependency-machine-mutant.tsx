import { connect } from "@precision/machine";
export function App() {
  return <button onClick={() => { connect().get("layer"); }}>connect</button>;
}
