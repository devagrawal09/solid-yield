import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<div id="app"></div>');
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement'])
  globalThis[key] = window[key];
const { createMemo, createSignal, createRenderEffect, Errored,
  latest, isPending, flush } = await import('solid-js');
const { render, insert } = await import('@solidjs/web');
let start, reject, fallbackCalls = 0;
const root = document.getElementById('app');
const dispose = render(() => {
  const [running, setRunning] = createSignal(false);
  start = setRunning;
  const data = createMemo(() => running() ? {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise((_, fail) => { reject = fail; }),
        return: async () => ({ done: true })
      };
    }
  } : []);
  return Errored({
    fallback: error => { fallbackCalls++; return 'ERROR: ' + error().message; },
    get children() {
      const p = document.createElement('p');
      insert(p, () => latest(data).length);
      createRenderEffect(() => isPending(data),
        pending => { p.dataset.pending = String(pending); });
      return p;
    }
  });
}, root);
start(true);
flush();
reject(new Error('Search failed'));
await new Promise(resolve => setTimeout(resolve, 10));
flush();
console.log(JSON.stringify({ text: root.textContent, fallbackCalls }));
dispose();
window.close();
