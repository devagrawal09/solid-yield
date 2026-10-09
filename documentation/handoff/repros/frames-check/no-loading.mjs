import { createMemo } from 'solid-js';
import { ssrElement, renderToStream } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';

const controller = new AbortController();
const errors = [];
let calls = 0;
const template = () => () => {
  calls++;
  const data = createMemo(() => new Promise(resolve => setTimeout(() => resolve('hello'), 10)));
  return ssrElement('p', {}, () => data());
};
const render = process.argv.includes('--stream') ? renderToStream : renderServerComponent;
const result = await Promise.race([
  Promise.resolve(render(template, { signal: controller.signal, onError: error => errors.push(error.message) })).then(() => 'completed'),
  new Promise(resolve => setTimeout(() => resolve('not completed within 100 ms'), 100))
]);
controller.abort();
console.log(JSON.stringify({ result, calls, errors }, null, 2));
