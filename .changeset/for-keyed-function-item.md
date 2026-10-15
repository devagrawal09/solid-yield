---
"solid-yield": patch
---

`For({ keyed: item => key })`: a row's item is now a path over the current item at its key. Solid hands such a row its item as an accessor, and the item had been read as a plain value, so `item.text` read a property of the accessor function.
