// LENS PROP (D-125). The date range owns its
// state shape, its initial value and its rules, as in ../after. It gets its
// lens as a prop, so the dependency shows at each call site. The prop is
// required: the module cannot choose between a given lens and a local
// store. A parent that wants a separate range makes a store for it.
import { $event, $memo, component, For, view, type Lens, type Props } from "solid-yield";
import { DAYS, dayClass, type Day } from "../shared";

export type DateRangeS = { checkIn: Day | null; checkOut: Day | null };
export const initDateRange = (): DateRangeS => ({ checkIn: null, checkOut: null });

export const DateRange = component(function* DateRange(
  props: Props<{ state: Lens<DateRangeS> }>
) {
  // a lens prop is given as it is, not as a path (D-125 amends D-042)
  const [range, setRange] = props.state;
  const clear = $event(function* () {
    yield* setRange(d => {
      d.checkIn = null;
      d.checkOut = null;
    });
  });
  return view(function* () {
    return (
      <fieldset class="dates">
        <legend>Dates</legend>
        <div class="days">
          {yield* For({
            each: DAYS,
            children: function* (day) {
              const pick = $event(function* () {
                const picked = yield* day;
                yield* setRange(d => {
                  if (d.checkIn === null || d.checkOut !== null || picked <= d.checkIn) {
                    d.checkIn = picked;
                    d.checkOut = null;
                  } else d.checkOut = picked;
                });
              });
              const cls = yield* $memo(function* () {
                return dayClass(yield* day, yield* range.checkIn, yield* range.checkOut);
              });
              return view(function* () {
                return (
                  <button class={yield* cls} onClick={yield* pick}>
                    {yield* day}
                  </button>
                );
              });
            }
          })}
        </div>
        <button class="clear" onClick={yield* clear}>
          Clear dates
        </button>
      </fieldset>
    );
  });
});
