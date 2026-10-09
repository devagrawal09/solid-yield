import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<div id="app"></div>');
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement']) globalThis[key] = window[key];
const { createMemo, createSignal, createRenderEffect, Errored, Loading, Show, latest, isPending, flush } = await import('solid-js');
const { render, insert } = await import('@solidjs/web');
const flags = new Set(process.argv.slice(2));
let search, reject, fallbackCalls = 0;
const dispose = render(() => {
 const [query, setQuery] = createSignal(false);
 search = setQuery;
 const results = createMemo(() => query() ? flags.has('promise') ? new Promise((_, fail) => {reject=fail}) : {
  [Symbol.asyncIterator]() { return {next: () => new Promise((_, fail) => {reject=fail}), return: async () => ({done:true})}; }
 } : []);
 const panel = () => {
  const p = document.createElement('p');
  const list = () => latest(results);
  insert(p, flags.has('direct') ? () => list().length : Show({get when(){return list().length>0}, fallback:'No results', children:'Results'}));
  if (!flags.has('no-pending')) createRenderEffect(() => isPending(results), pending => {p.dataset.pending=String(pending)});
  return p;
 };
 const boundary = () => Errored({fallback:error=>{fallbackCalls++;return 'ERROR: '+error().message},get children(){return flags.has('no-loading')?panel():Loading({fallback:'Loading',get children(){return panel()}})}});
 return flags.has('no-outer')?boundary():Show({get when(){return query()},children:boundary});
},document.getElementById('app'));
search(true);flush();
reject(new Error('Search failed'));
await new Promise(resolve=>setTimeout(resolve,10));flush();
console.log(JSON.stringify({flags:[...flags], text:document.getElementById('app').textContent, fallbackCalls}));
dispose();window.close();
