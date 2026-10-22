// @ts-check
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChecker } from './index.mjs';
const rootDir=dirname(fileURLToPath(import.meta.url));
const entry=resolve(rootDir,'_noise.tsx');
const prelude='import {createMemo, Loading, Errored} from "solid-js"; import {render} from "@solidjs/web";';
/** @param {string} source @param {Record<string,string>} [others] */
function check(source,others={}){
  const sources=new Map([[entry,prelude+source],...Object.entries(others).map(([f,s])=>[resolve(rootDir,f),s])]);
  const checker=createChecker({rootDir,files:[...sources.keys()],readFile:f=>sources.get(f)});
  try{return checker.check();}finally{checker.dispose();}
}
describe('whole-app symbol identity reductions',()=>{
  for(const declarations of [false,true]){
    it(`keeps a local value beside a ${declarations?'resolved':'unresolved'} type import, with a pending mutant`,()=>{
      const other=declarations?{'_noise-type.ts':'export interface View {label: string}'}:{};
      const source='import type {View} from "./_noise-type"; function View(){BODY return <p>{VALUE}</p>} function App(){return <View/>} render(App,document.body);';
      expect(check(source.replace('BODY','').replace('VALUE','1'),other).diagnostics).toEqual([]);
      const positive=check(source.replace('BODY','const read=createMemo(()=>Promise.resolve(1));').replace('VALUE','read()'),other);
      expect(positive.diagnostics.map(d=>d.code)).toEqual(['ASYNC_OUTSIDE_LOADING_BOUNDARY']);
    });
  }
  it('does not give unresolved imports the body of a local component or a safe local callback',()=>{
    const source='import type {View} from "./absent-types"; import {injected} from "./absent-api"; function View(){return <p/>} function safe(){} function App(){return <button onClick={()=>CALL()}/>} render(App,document.body);';
    expect(check(source.replace('CALL','safe')).diagnostics).toEqual([]);
    const positive=check(source.replace('CALL','injected'));
    expect(positive.diagnostics.some(d=>d.code==='UNHANDLED_HANDLER_FAILURE')).toBe(true);
    expect(positive.diagnostics.some(d=>d.data?.construct==='an import without declarations')).toBe(true);
    expect(positive.diagnostics.some(d=>String(d.data?.construct).includes('calling the component'))).toBe(false);
  });
  it('keeps unknown imported results worst case after the call, with a boundary control',()=>{
    const source='import {injected} from "./absent-api"; function App(){return WRAP<p>{injected().value}</p>END} render(App,document.body);';
    const safe=check(source.replace('WRAP','<Loading><Errored fallback={()=>null}>').replace('END','</Errored></Loading>'));
    expect(safe.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
    const positive=check(source.replace('WRAP','').replace('END',''));
    expect(positive.diagnostics.map(d=>d.code)).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
    expect(positive.diagnostics.map(d=>d.code)).toContain('ERROR_OUTSIDE_ERRORED_BOUNDARY');
  });
});
describe('resolved JSX helpers use their call scope and arguments',()=>{
  it('keeps declared scalar arguments scalar in exported JSX summaries, including aliases and unions',()=>{
    for(const type of ['string','Text','string | undefined']){
      const source='type Text=string; function parse(value:string){return value.trim().split(" ")} export function label(value:TYPE){return <p>{parse(value ?? "").join(" ")}</p>}'.replace('TYPE',type);
      expect(check(source).diagnostics).toEqual([]);
    }
  });
  it('keeps explicit throws and reactive obligations in scalar JSX helpers',()=>{
    const source='function parse(value:string){BODY return value.trim()} export function label(value:string){return <p>{parse(value)}</p>} function App(){return <section>{label("ready")}</section>} render(App,document.body);';
    expect(check(source.replace('BODY','')).diagnostics).toEqual([]);
    expect(check(source.replace('BODY','throw new RangeError();')).diagnostics.map(d=>d.code)).toContain('ERROR_OUTSIDE_ERRORED_BOUNDARY');
    expect(check('export function label(value:string){throw new RangeError();return <p>{value.trim()}</p>}').diagnostics.map(d=>d.code)).toContain('SETUP_MAY_THROW');
    const read='import {createSignal} from "solid-js"; export function label(value:string){return <p>{value.trim()}</p>} function App(){const [read]=createSignal("ready"); SITE} render(App,document.body);';
    expect(check(read.replace('SITE','return <section>{label(read())}</section>')).diagnostics).toEqual([]);
    expect(check(read.replace('SITE','label(read());return <p/>')).diagnostics.map(d=>d.code)).toContain('STRICT_READ_UNTRACKED');
    const pending='export function label(value:string){return <p>{value.trim()}</p>} function App(){const read=createMemo(()=>Promise.resolve("ready"));return <section>{label(read())}</section>} render(App,document.body);';
    expect(check(pending).diagnostics.map(d=>d.code)).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
  });
  it('does not exempt callback parameters or ordinary reactive object props',()=>{
    const callback='export function label(read:()=>string){return <p>{read()}</p>}';
    expect(check(callback).diagnostics.map(d=>d.code)).toContain('COMPONENT_OBLIGATIONS_EXPORTED');
    const props='import {createSignal} from "solid-js"; function Child(p:{value:string}){const n=p.value;return <p>{n}</p>} function App(){const [read]=createSignal("ready");return <Child value={read()}/>} render(App,document.body);';
    expect(check(props).diagnostics.map(d=>d.code)).toContain('STRICT_READ_UNTRACKED');
  });
  it('analyzes direct and aliased JSX helper calls, with a pending-read mutant',()=>{
    for(const call of ['view(1, "ready")','alias(1, "ready")']){
      const source='function view(value:number,label:string){BODY return <p>{label}{VALUE}</p>} const alias=view; function App(){return <section>{CALL}</section>} render(App,document.body);'.replace('CALL',call);
      expect(check(source.replace('BODY','').replace('VALUE','value')).diagnostics).toEqual([]);
      const positive=check(source.replace('BODY','const read=createMemo(()=>Promise.resolve(value));').replace('VALUE','read()'));
      expect(positive.diagnostics.map(d=>d.code)).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
    }
  });
  it('keeps failure and setup read obligations in direct JSX helpers',()=>{
    const source='function view(callback:()=>number){return <p>{callback()}</p>} function App(){return <section>{view(CALLBACK)}</section>} render(App,document.body);';
    expect(check(source.replace('CALLBACK','()=>1')).diagnostics).toEqual([]);
    expect(check(source.replace('CALLBACK','()=>{throw new RangeError()}')).diagnostics.map(d=>d.code)).toContain('ERROR_OUTSIDE_ERRORED_BOUNDARY');
    const read='import {createSignal} from "solid-js"; function view(read:()=>number){const n=read();return <p>{n}</p>} function App(){const [read]=createSignal(1); SITE return <p/>} render(App,document.body);';
    expect(check(read.replace('SITE','const held=()=>view(read);')).diagnostics).toEqual([]);
    expect(check(read.replace('SITE','view(read);')).diagnostics.map(d=>d.code)).toContain('STRICT_READ_UNTRACKED');
  });
  it('analyzes a JSX-returning handler body without treating it as a render boundary',()=>{
    const source='function view(){BODY return <p/>} function App(){return <button onClick={view}/>} render(App,document.body);';
    expect(check(source.replace('BODY','')).diagnostics).toEqual([]);
    expect(check(source.replace('BODY','throw new RangeError();')).diagnostics.map(d=>d.code)).toContain('UNHANDLED_HANDLER_FAILURE');
  });
});
describe('deferred coverage in returned or unvisited bodies',()=>{
  it('leaves capture-only refs clean and warns for unvisited intrinsic ref arrays',()=>{
    const source='export function factory(){let element:HTMLInputElement;return ()=> <input ref={REF}/>;}';
    expect(check(source.replace('REF','node=>{element=node}')).diagnostics).toEqual([]);
    const positive=check(source.replace('REF','[node=>{element=node},()=>{throw new Error()}]'));
    expect(positive.diagnostics.map(d=>d.code)).toEqual(['UNANALYZED_BOUNDARY']);
    expect(positive.diagnostics[0].data?.construct).toBe('a ref callback array');
  });
  it('warns for a resolved deferred API in an unvisited renderer, without using its spelling',()=>{
    expect(check('function onSettled(fn:()=>void){} export function factory(){return ()=>onSettled(()=>{});}').diagnostics).toEqual([]);
    const result=check('import {onSettled as committed} from "solid-js"; export function factory(){return ()=>committed(()=>{throw new Error()});}');
    expect(result.diagnostics.map(d=>d.code)).toEqual(['UNANALYZED_BOUNDARY']);
    expect(result.diagnostics[0].data?.construct).toBe('onSettled(…)');
  });
  it('leaves plain signal setup clean and keeps reached compute signals worst case',()=>{
    const source='import {createSignal as signal} from "solid-js"; function App(){const [read]=signal(VALUE);return <p>{read()}</p>} render(App,document.body);';
    expect(check(source.replace('VALUE','1')).diagnostics).toEqual([]);
    const positive=check(source.replace('VALUE','()=>1'));
    expect(positive.diagnostics.map(d=>d.code)).toContain('UNANALYZED_BOUNDARY');
    expect(positive.diagnostics.map(d=>d.code)).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
    expect(positive.diagnostics.map(d=>d.code)).toContain('ERROR_OUTSIDE_ERRORED_BOUNDARY');
    const unvisited=check('import {createSignal as signal} from "solid-js"; export function factory(){return ()=>{const [read]=signal(()=>1);return read;};}');
    expect(unvisited.diagnostics.map(d=>d.code)).toEqual(['UNANALYZED_BOUNDARY']);
    const write='import {createSignal as signal} from "solid-js"; function App(){const [,write]=signal(VALUE);return <button onClick={()=>write(2)}/>} render(App,document.body);';
    expect(check(write.replace('VALUE','1')).diagnostics).toEqual([]);
    expect(check(write.replace('VALUE','()=>1')).diagnostics.map(d=>d.code)).toContain('UNHANDLED_HANDLER_FAILURE');
  });
});
