import fs from 'node:fs';
import path from 'node:path';
export const APP = process.env.SOUND_APP ?? '/Users/devagr/solid-yield-wt/openclaw-trial/app';
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['node_modules','.git','dist'].includes(e.name)?walk(path.join(p,e.name)):e.isFile()?[path.join(p,e.name)]:[]);
export const all=walk(APP+'/src').filter(p=>/\.(ts|tsx)$/.test(p));
export const excluded=all.filter(p=>/\.d\.ts$|\.(?:test|spec|stories|story|test-support)\.|\/(?:tests?|e2e|solid-smoke|test-helpers|stories)\//.test(p));
export const files=all.filter(p=>!excluded.includes(p));
export const options = JSON.parse(fs.readFileSync(path.join(APP,'../compiler-options.json'),'utf8'));
