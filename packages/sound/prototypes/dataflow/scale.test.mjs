// @ts-check
import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createChecker } from "./index.mjs";
import { summarize } from "./incremental.mjs";
const rootDir = dirname(fileURLToPath(import.meta.url));
const entry = resolve(rootDir, "_scale-input.tsx");
const prelude = 'import { createSignal, createMemo } from "solid-js"; import { render } from "@solidjs/web";';
const create = text => createChecker({rootDir,files:[entry],readFile:p=>p===entry?text:undefined});

describe("dataflow scale boundaries", () => {
  it("reuses unchanged syntax, relocates diagnostics and does not mutate old results", () => {
    const text = prelude+'function App() { const [read] = createSignal(1); const value=read(); return <p>{value}</p>; } render(App, document.body);';
    const checker = create(text);
    try {
      const cold=checker.check(), first=cold.diagnostics[0].loc.line;
      const moved=checker.update(entry,String.fromCharCode(10)+text);
      expect(moved.reanalyzedFiles).toEqual([]);
      expect(moved.diagnostics.map(d=>d.code)).toEqual(cold.diagnostics.map(d=>d.code));
      expect(moved.diagnostics[0].loc.line).toBe(first+1);
      expect(cold.diagnostics[0].loc.line).toBe(first);
      const changed=checker.update(entry,text.replace('const value=read();','const value=1;'));
      expect(changed.reanalyzedFiles).toEqual([entry]);
      expect(changed.diagnostics).toEqual([]);
    } finally { checker.dispose(); }
  });
  it("preserves updates of imported declarations outside the checked roots", () => {
    const dir=mkdtempSync(resolve(tmpdir(),'sound-scale-types-'));
    const declaration=resolve(dir,'api.d.ts');
    writeFileSync(declaration,'export declare function save(): number;');
    const text=prelude+'import {save} from '+JSON.stringify(declaration.slice(0,-5))+'; function App(){const read=createMemo(()=>save());return <p>{read()}</p>;} render(App,document.body);';
    const checker=create(text);
    try {
      expect(checker.check().diagnostics.some(d=>d.code==='ASYNC_OUTSIDE_LOADING_BOUNDARY')).toBe(false);
      const changed=checker.update(declaration,'export declare function save(): Promise<number>;');
      expect(changed.diagnostics.some(d=>d.code==='ASYNC_OUTSIDE_LOADING_BOUNDARY')).toBe(true);
    } finally { checker.dispose(); rmSync(dir,{recursive:true,force:true}); }
  });
  it("does not hash ASI, JSX text or literal changes as trivia", () => {
    expect(summarize(entry,'function f(){return 1}').hash).not.toBe(summarize(entry,'function f(){return'+String.fromCharCode(10)+'1}').hash);
    expect(summarize(entry,'const x=<p>a b</p>').hash).not.toBe(summarize(entry,'const x=<p>ab</p>').hash);
    expect(summarize(entry,'const x=true').hash).not.toBe(summarize(entry,'const x=false').hash);
    expect(summarize(entry,'/// <reference no-default-lib="true" />'+String.fromCharCode(10)+'const x=1').hash).not.toBe(summarize(entry,'const x=1').hash);
    expect(summarize(entry,'function f( {').valid).toBe(false);
  });
  it("cuts unchecked source imports explicitly and keeps unknown handler failures", () => {
    const dir=mkdtempSync(resolve(tmpdir(),'sound-scale-'));
    const app=resolve(dir,'app.tsx'), helper=resolve(dir,'helper.ts');
    writeFileSync(helper,'export function save() {}');
    writeFileSync(app,'import {save} from "./helper"; export function App(){return <button onClick={()=>save()}/>;}');
    const checker=createChecker({rootDir:dir,files:[app]});
    try {
      const result=checker.check();
      expect(result.diagnostics.some(d=>d.code==='UNANALYZED_BOUNDARY'&&d.data?.construct==='unchecked source import')).toBe(true);
      expect(result.diagnostics.some(d=>d.code==='UNHANDLED_HANDLER_FAILURE')).toBe(true);
      expect(result.diagnostics.some(d=>d.code==='PENDING_ASYNC_IN_HANDLER')).toBe(false);
      expect(result.diagnostics.every(d=>d.loc.file===app)).toBe(true);
    } finally { checker.dispose(); rmSync(dir,{recursive:true,force:true}); }
  });
  it("retains worst-case values through checked re-export and namespace aliases", () => {
    const dir=mkdtempSync(resolve(tmpdir(),'sound-scale-exports-'));
    const helper=resolve(dir,'api.ts'), barrel=resolve(rootDir,'_scale-barrel.ts');
    writeFileSync(helper,'export const value=1;');
    const exports='export {value} from '+JSON.stringify(helper.slice(0,-3))+';';
    try {
      for (const namespace of [false,true]) {
        const source=prelude+(namespace?'import * as api from "./_scale-barrel";':'import {value} from "./_scale-barrel";')+'function App(){return <p>{'+(namespace?'api.value':'value')+'}</p>;} render(App,document.body);';
        const checker=createChecker({rootDir,files:[entry,barrel],readFile:p=>p===entry?source:p===barrel?exports:undefined});
        try {
          const result=checker.check();
          expect(result.diagnostics.some(d=>d.code==='UNANALYZED_BOUNDARY'&&d.data?.construct==='unchecked source re-export')).toBe(true);
          expect(result.diagnostics.some(d=>d.code==='ASYNC_OUTSIDE_LOADING_BOUNDARY')).toBe(true);
        } finally { checker.dispose(); }
      }
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  it("keeps changed recursive component inputs pending and failing", () => {
    const checker=create(prelude+'function App(props:{value?:number}){const read=createMemo(()=>Promise.resolve(1));return <App value={read()}/>;} render(App,document.body);');
    try {
      const result=checker.check();
      expect(result.diagnostics.some(d=>d.code==='UNANALYZED_BOUNDARY'&&d.data?.construct==='recursive or bounded component')).toBe(true);
      expect(result.diagnostics.some(d=>d.code==='ASYNC_OUTSIDE_LOADING_BOUNDARY')).toBe(true);
      expect(result.diagnostics.some(d=>d.code==='ERROR_OUTSIDE_ERRORED_BOUNDARY')).toBe(true);
    } finally { checker.dispose(); }
  });
  it("closes a recursive cycle only for the same forwarded source and held facts", () => {
    const checker=create(prelude+'function Tree(p:{depth:number,value:number}) { const next=p.depth-1; return <p>{p.value}<Tree depth={next} value={p.value}/></p>; } function App(){const [read]=createSignal(1);return <Tree depth={2} value={read()}/>;} render(App,document.body);');
    try { expect(checker.check().diagnostics).toEqual([]); } finally { checker.dispose(); }
  });
  it("keeps recursive calls partial and failing instead of returning a safe constant", () => {
    const checker=create(prelude+'function recurse(){ return recurse(); } function App(){ return <button onClick={()=>recurse()}/>; } render(App,document.body);');
    try {
      const result=checker.check();
      expect(result.diagnostics.some(d=>d.code==='UNANALYZED_BOUNDARY')).toBe(true);
      expect(result.diagnostics.some(d=>d.code==='UNHANDLED_HANDLER_FAILURE')).toBe(true);
    } finally { checker.dispose(); }
  });
});
