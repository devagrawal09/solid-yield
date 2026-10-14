// SLOTS (D-126). The date range owns its state shape, its initial
// value and its rules. It reads its state from a slot. If a parent binds the
// slot, the state is in the parent's store. If no parent binds it, the
// component makes a local store and operates alone.
import { $event, $memo, $slot, component, createSlot, For, view } from "solid-yield";
import { DAYS, dayClass, type Day } from "../shared";

export type DateRangeS = { checkIn: Day | null; checkOut: Day | null };
export const initDateRange = (): DateRangeS => ({ checkIn: null, checkOut: null });

export const DateRangeState = createSlot<DateRangeS, "DateRangeState">({ name: "DateRangeState" });

export const DateRange = component(function* DateRange() {
  const [range, setRange] = yield* $slot(DateRangeState, { init: initDateRange });
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
