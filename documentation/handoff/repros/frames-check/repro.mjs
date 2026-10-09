import { createMemo, Loading } from 'solid-js';
import { ssrElement, renderToStream } from '@solidjs/web';
import { renderServerComponent } from '@solidjs/web/frames';
import { provideRequestEvent } from '@solidjs/web/storage';

async function frame() {
  'use server';
  return () => Loading({
    fallback: 'Loading',
    children: () => {
      const data = createMemo(() => new Promise(resolve =>
        setTimeout(() => resolve('hello'), 10)));
      const derived = createMemo(() => data().toUpperCase());
      return ssrElement('p', {}, () => derived());
    }
  });
}

await provideRequestEvent({ request: new Request('http://localhost/'), locals: {} }, async () => {
  const template = await frame();
  const render = process.argv.includes('--stream') ? renderToStream : renderServerComponent;
  const errors = [];
  const result = await render(template, { onError: error => errors.push(error.message) });
  console.log(JSON.stringify({ errors, result }, null, 2));
});
