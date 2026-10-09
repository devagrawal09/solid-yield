import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<div id="app"></div>');
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement']) globalThis[name] = window[name];
const { createMemo, createSignal, createRenderEffect, Errored, Loading, Show, latest, isPending, flush } = await import('solid-js');
const { render } = await import('@solidjs/web');
let search;
let reject;
let fallbackCalls = 0;
const dispose = render(() => {
  const [query, setQuery] = createSignal(false);
  search = setQuery;
  const results = createMemo(() => query() ? {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise((_, fail) => { reject = fail; }),
        return: async () => ({ done: true })
      };
    }
  } : []);
  return Show({
    get when() { return query(); },
    children: () => Errored({
      fallback: error => { fallbackCalls++; return 'ERROR: ' + error().message; },
      get children() {
        return Loading({
          fallback: 'Loading',
          get children() {
            const p = document.createElement('p');
            createRenderEffect(() => [isPending(results), latest(results).length], ([pending, count]) => { p.textContent = (pending ? 'Searching' : 'Ready') + ': ' + count; });
            return p;
          }
        });
      }
    })
  });
}, document.getElementById('app'));
search(true);
flush();
console.log('pending:', document.getElementById('app').textContent);
reject(new Error('Search failed'));
await new Promise(resolve => setTimeout(resolve, 10));
flush();
console.log('rejected:', document.getElementById('app').textContent, 'fallback calls:', fallbackCalls);
dispose();
window.close();
