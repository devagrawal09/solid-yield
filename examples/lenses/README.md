# Lenses example

This example shows the problem that lenses and state slots solve (D-116, D-117). It is the same booking page, written three times:

- `src/before/`: without lenses. The page lifts the state of its modules.
- `src/lens-prop/`: lens props. The page gives each module a lens on one store as a prop.
- `src/after/`: slots and `compose`. Each module reads its state from a slot, and `compose` binds each slot to a lens on one store.

The three pages show the same markup and obey the same rules. The tests run the same clicks on each page and expect the same results.

## The page

A booking has two modules and a total:

- **DateRange**: pick a check-in day and a check-out day. A third pick starts a new range.
- **Guests**: adults and children. A booking has a maximum of 6 guests and a minimum of 1 adult.
- **Total**: nights × guests × 50. The total must read the state of both modules.

The page also has a "Reset booking" button and a second date range ("compare another range") that is not part of the booking.

## The problem

The total must read the dates and the guests. Thus, without lenses, the page must own that state. The best pattern without lenses keeps the rules in the module file, in a helper (`createDateRange`, `createGuests`). But the page must still call each helper, hold its result, and give each field and each handler to the component as a prop.

## Comparison

| Item | Before (no lenses) | Lens props | Slots and `compose` |
| --- | --- | --- | --- |
| Props that the page gives to the modules | 11 (4 + 3 + 4) | 3 (one lens for each call) | 0 |
| Handler calls with a double yield | 3 | 0 | 0 |
| Helper calls that the page must make | 3 | 0 | 0 |
| A date range that is not part of the booking | The page calls the helper again and gives 4 more props | The page makes one more store and gives it as the lens | `yield* DateRange()`: the module uses a local store |
| "Reset booking" | Calls one reset event of each module | One write to the container | One write to the container (`Booking.init()`) |
| Add a field to DateRange | Change the helper, the props, and each call site | Change the module only | Change the module only |
| Where you see the dependency | At each call site (each prop) | At each call site (one prop) | In the component type (`R`), and in the schema |
| A missing binding | Type error at the call site | Type error at the call site | `[NO_PROVIDER]` type error at the root |
| Extra code in the page | None | None | One `compose` schema and one `provide` |
| A module far below the page | Each component between them passes each prop | Each component between them passes the lens | No change: the slot goes through the tree |

Summary:

- **Lens props and slots solve the same problem.** In both, the module keeps its state shape and its rules, and the page holds one store. Both remove the double yields and the per-field props.
- **Lens props are more explicit.** Each call site shows the lens that the module gets, and the page needs no providers. Use them for a module that the parent calls directly.
- **Slots are better for deep trees and for standalone modules.** A slot does not need props on each component between the page and the module. The `init` form also lets a module operate alone. A lens prop has no local fallback.

## Commands

Run these commands in this directory:

```sh
pnpm dev        # open the three pages side by side
pnpm test       # the same clicks on each page
pnpm typecheck  # includes the [NO_PROVIDER] check and the required lens prop check
pnpm lint       # eslint-plugin-solid-yield, as the twins run it
```

This directory is not a twin. Its name does not end in `-yield`, so the gate (`pnpm gate`) does not run it.
