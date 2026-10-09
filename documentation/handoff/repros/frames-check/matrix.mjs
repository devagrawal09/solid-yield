import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const cases = [
  ['derived-inside', 'frames'],
  ['derived-inside', 'stream'],
  ['derived-inside-lazy-body-errored', 'frames'],
  ['derived-inside-lazy-body-hole', 'frames'],
  ['derived-inside-lazy-body-hole-wrapped', 'frames'],
  ['derived-inside-hoisted', 'frames'],
  ['nested-loader', 'frames'],
  ['nested-loader-lazy-body-sync', 'frames'],
  ['nested-loader-lazy-body-sync-no-derived', 'frames'],
  ['nested-loader-lazy-body-hole', 'frames'],
  ['nested-loader-lazy-body-stable-promise', 'frames'],
  ['derived-inside-lazy-body-promise-derived', 'frames'],
  ['derived-inside-lazy-body-promise-derived', 'stream']
];
const results = cases.map(([name, renderer]) => {
  const child = spawnSync(process.execPath, ['check.mjs', name, renderer], { encoding: 'utf8', cwd: import.meta.dirname });
  if (child.status !== 0) throw new Error(child.stderr || child.stdout);
  const { ms, counts, errors, result } = JSON.parse(child.stdout);
  return { name, renderer, ms, counts, errors, hasContent: typeof result === 'string' ? /<p>(HELLO|hello)<\/p>/.test(result) : result.some(chunk => /(HELLO|hello)/.test(chunk.html || '')) };
});
for (const [file, name, renderer] of [['repro.frames.json', 'nested async + derived', 'frames'], ['repro.stream.json', 'nested async + derived', 'stream'], ['minimal.frames.json', 'minimal single async memo', 'frames']]) {
  const { errors, result } = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  results.push({ name, renderer, errors, hasContent: typeof result === 'string' ? result.includes('HELLO') : result.some(chunk => chunk.html?.includes('HELLO')) });
}
writeFileSync(new URL('matrix.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results.map(({ name, renderer, errors, hasContent }) => ({ name, renderer, errors: errors.length, hasContent })), null, 2));
