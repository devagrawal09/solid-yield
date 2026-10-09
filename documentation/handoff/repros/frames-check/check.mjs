import { createMemo, Loading, Errored } from 'solid-js';
import { ssrElement, renderToStream } from '@solidjs/web';
import { renderServerComponent, frameTransformDirectResult } from '@solidjs/web/frames';
import { provideRequestEvent } from '@solidjs/web/storage';

const name = process.argv[2] || 'derived-inside';
const renderer = process.argv[3] || 'frames';
const counts = { loaders: 0, bodies: 0, derived: 0 };
const async = !name.includes('sync');
const derived = !name.includes('no-derived');
const loading = !name.includes('no-loading');
const nestedLoader = name.includes('nested-loader');
const hoistedDerived = name.includes('hoisted');
let stablePromise;
const source = () => {
  counts.loaders++;
  if (name.includes('stable-promise')) return stablePromise ||= new Promise(resolve => setTimeout(() => resolve('hello'), 10));
  return async ? new Promise(resolve => setTimeout(() => resolve('hello'), 10)) : 'hello';
};

async function frame() {
  'use server';
  return () => {
    const loader = nestedLoader ? undefined : createMemo(source);
    const makeDerived = data => createMemo(() => {
      counts.derived++;
      const value = data().toUpperCase();
      return name.includes('promise-derived') ? Promise.resolve(value) : value;
    });
    const stable = hoistedDerived ? makeDerived(loader) : undefined;
    const body = () => {
      counts.bodies++;
      const data = loader || createMemo(source);
      const value = derived ? stable || makeDerived(data) : data;
      const markup = () => ssrElement('p', {}, name.includes('hole') ? [() => value()] : () => value());
      return name.includes('lazy-markup') ? markup : markup();
    };
    const content = () => name.includes('lazy-body') ? body : body();
    const tree = () => loading ? Loading({ fallback: 'Loading', get children() { return content(); } }) : content();
    return name.includes('errored') ? Errored({ fallback: error => String(error()), get children() { return tree(); } }) : tree();
  };
}

const errors = [];
const start = performance.now();
const result = await provideRequestEvent({ request: new Request('http://localhost/'), locals: {} }, async () => {
  const raw = await frame();
  const template = name.includes('wrapped') ? frameTransformDirectResult(raw, { id: 'test', args: [] }) : raw;
  const options = { onError: error => errors.push(error.message), ...(process.env.ABORT_MS ? { signal: AbortSignal.timeout(Number(process.env.ABORT_MS)) } : {}) };
  return renderer === 'frames' ? await renderServerComponent(template, options) : await renderToStream(template, options);
});
console.log(JSON.stringify({ name, renderer, ms: Math.round(performance.now() - start), counts, errors, result }, null, 2));
