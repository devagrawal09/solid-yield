import { createMemo, Loading } from 'solid-js';
import { ssrElement } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';

const errors = [];
const result = await renderServerComponent(() => Loading({
  fallback: 'Loading',
  children: () => {
    const data = createMemo(() => Promise.resolve('hello'));
    return ssrElement('p', {}, () => data());
  }
}), { onError: error => errors.push(error.message) });
console.log(JSON.stringify({ errors, result }, null, 2));
