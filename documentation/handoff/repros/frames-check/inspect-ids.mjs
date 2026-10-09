import { createMemo, getOwner, Loading } from 'solid-js';
import { ssrElement } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';

let calls = 0;
const ids = [];
const errors = [];
await renderServerComponent(() => Loading({
  fallback: 'Loading',
  children: () => {
    calls++;
    let owner;
    const data = createMemo(() => {
      owner = getOwner();
      return Promise.resolve('hello');
    });
    if (calls <= 3 || calls >= 10000) ids.push({ call: calls, id: owner.id, parentCount: owner._parent?._childCount });
    return ssrElement('p', {}, () => data());
  }
}), { onError: error => errors.push(error.message) });
console.log(JSON.stringify({ calls, ids, errors }, null, 2));
