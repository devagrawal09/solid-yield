import { createSignal, createMemo, createEffect, createContext, useContext, Loading, Errored } from 'solid-js';
import { render } from '@solidjs/web';
import { readServer } from './server';
const Identity = createContext<number>();
class Problem extends Error {}
function fail() { throw new Problem('failure'); }
function Child(props: { value: number }) {
  const identity = useContext(Identity);
  return <p>{props.value}{identity}</p>;
}
function App() {
  const [count, setCount] = createSignal(1);
  const value = createMemo(async () => {
    try { return await readServer(); } catch (e) { throw e; }
  });
  const twice = createMemo(() => count() * 2);
  createEffect(() => count(), n => { setCount(n); });
  setTimeout(() => setCount(2), 1);
  const save = async () => {
    await Promise.resolve();
    setCount(count() + 1);
  };
  return <Identity value={1}><Errored fallback={() => <p>failed</p>}><Loading fallback="wait">
    <button onClick={async () => { await save(); }}>{twice()}</button>
    <button onClick={() => { try { fail(); } catch (e) { throw e; } }}>Fail</button>
    <Child value={count()} /><p>{value()}</p>
  </Loading></Errored></Identity>;
}
render(() => <App />, document.body);
