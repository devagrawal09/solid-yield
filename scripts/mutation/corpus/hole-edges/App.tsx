import {
  createContext,
  createMemo,
  createSignal,
  createStore,
  Errored,
  For,
  useContext
} from "solid-js";
// A call that may fail, made in a JSX hole: its failure is the hole's, taken
// by the Errored above (nativeHole). Values typed `any`: their members are
// unchecked, as TypeScript leaves them; a method of `any` is outside code.
function money(cents: number) {
  if (!Number.isFinite(cents)) throw new RangeError("not an amount");
  return (cents / 100).toFixed(2);
}
const Settings = createContext<any>({ currency: "EUR" });
export function Ledger() {
  const [rows, setRows] = createStore<any>({ items: [{ label: "tea", cents: 350 }] });
  const [user] = createSignal<any>({ name: "ada" });
  const settings = useContext(Settings);
  const total = createMemo(() =>
    rows.items.reduce((sum: number, item: any) => sum + item.cents, 0)
  );
  return (
    <section class={settings.currency}>
      <h2>{user().name}</h2>
      <Errored fallback={err => <p>bad amount: {String(err())}</p>}>
        <p>{money(total())}</p>
        <ul>
          <For each={rows.items}>
            {item => (
              <li>
                {item.label}: {money(item.cents)}
              </li>
            )}
          </For>
        </ul>
      </Errored>
      <button
        onClick={() =>
          setRows(s => {
            s.items.push({ label: "cake", cents: 420 });
          })
        }
      >
        add
      </button>
    </section>
  );
}
