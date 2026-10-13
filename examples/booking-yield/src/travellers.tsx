// A travellers list: a keyed For over the page's travellers. Each row is a
// module with two kinds of state:
// - row-owned: `expanded`, a store created in the row's setup (D-030). Solid
//   owns its lifetime: created with the row, dropped with it, nothing written
//   on disposal. It is private by design: the page cannot count it.
// - page-owned: the row's draft note, an entry of the page's `drafts` record,
//   reached through the lens pair with the key read where it is used.
import { $event, $store, component, For, view, type Props, type Source } from "solid-yield";
import { rowSlice, type Slice } from "./lib/lens";

export type Traveller = { id: string; name: string };
export type Drafts = Record<string, string>;

export const TravellerRow = component(function* TravellerRow(
  props: Props<{ id: Source<string>; name: Source<string>; drafts: Slice<Drafts> }>
) {
  const [ui, setUi] = yield* $store({ expanded: false });
  const draft = rowSlice(props.drafts, props.id, () => "");
  const toggle = $event(function* () {
    yield* setUi(u => {
      u.expanded = !u.expanded;
    });
  });
  const type = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    const value = e.currentTarget.value;
    yield* draft.set(() => value);
  });
  return view(function* () {
    return (
      <li class="traveller">
        <span class="name">{yield* props.name}</span>
        <button class="toggle" onClick={yield* toggle}>
          {(yield* ui.expanded) ? "expanded" : "collapsed"}
        </button>
        <input class="draft" value={yield* draft.read()} onInput={yield* type} />
      </li>
    );
  });
});

export const TravellerList = component(function* TravellerList(
  props: Props<{ travellers: Source<Traveller[]>; drafts: Slice<Drafts> }>
) {
  return view(function* () {
    return (
      <ul class="travellers">
        {
          yield* For({
            each: props.travellers,
            keyed: (t: Traveller) => t.id,
            children: function* (t) {
              return view(function* () {
                return <>{yield* TravellerRow({ id: t.id, name: t.name, drafts: props.drafts })}</>;
              });
            }
          })
        }
      </ul>
    );
  });
});
