// Reconstructed review categories, not the missing historical probe sources.
const signal = `import {createSignal,createMemo,createEffect,For,Show,Loading,createContext,useContext} from "solid-js";`;
const counter = body =>
  `${signal} export function Counter(){const [count,set]=createSignal(0);${body}}`;
export const fixtures = [
  {
    id: "native-optimistic-store-basic",
    expected: "accepted",
    source: `import {createOptimisticStore} from 'solid-js';export function App(){const [state,set]=createOptimisticStore({n:1});return <button onClick={()=>set(s=>{s.n++})}>{state.n}</button>}`
  },
  {
    id: "native-for-indexed",
    expected: "accepted",
    source: `import {For,createSignal} from 'solid-js';export function App(){const [items]=createSignal([1,2]);return <For each={items()} keyed={false}>{(item,index)=><p>{index}:{item()}</p>}</For>}`
  },
  {
    id: "native-switch-match",
    expected: "accepted",
    source: `import {Switch,Match,createSignal} from 'solid-js';export function App(){const [n]=createSignal(1);return <Switch fallback={<p>none</p>}><Match when={n()===1}><p>one</p></Match><Match when={n()===2}><p>two</p></Match></Switch>}`
  },
  {
    id: "foreign-route-failure",
    expectedDiagnostic: "FOREIGN_HANDOFF",
    source: `import {createMemo} from 'solid-js';export function Page(){const n=createMemo(()=>{throw new Error('route failed')});return <p>{n()}</p>}export const route={component:Page};`
  },
  {
    id: "foreign-render-callback",
    expected: "accepted",
    source: `import type {JSX} from '@solidjs/web';declare function Pane(p:{children:(n:number)=>JSX.Element}):JSX.Element;export function App(){return <Pane>{n=><span>{n}</span>}</Pane>}`
  },
  {
    id: "async-event-reads",
    expected: "accepted",
    source: `import {createSignal} from 'solid-js';export function App(){const [n,set]=createSignal(0);async function load(){const before=n();await Promise.resolve();return before+n()+1}return <button onClick={async()=>set(await load())}>{n()}</button>}`
  },
  {
    id: "async-memo-reads",
    expected: "accepted",
    source: `import {createSignal,createMemo,Loading} from 'solid-js';export function App(){const [n]=createSignal(1);const value=createMemo(async()=>{await Promise.resolve();return n()});return <Loading fallback="wait"><p>{value()}</p></Loading>}`
  },
  {
    id: "async-setup-reads",
    source: `import {createSignal} from 'solid-js';export function App(){const [n]=createSignal(1);async function load(){await Promise.resolve();return n()}load();return <p/>}`
  },
  {
    id: "ref-event-reads",
    expected: "accepted",
    source: `import {createSignal} from 'solid-js';export function App(){const [n,set]=createSignal(1);return <div ref={el=>{set(n()+el.childElementCount)}}>{n()}</div>}`
  },
  {
    id: "foreign-portal",
    expected: "accepted",
    source: `import {Portal} from '@solidjs/web';import {createSignal} from 'solid-js';export function App(){const [n,set]=createSignal(1);return <Portal><button onClick={()=>set(n()+1)}>{n()}</button></Portal>}`
  },
  {
    id: "foreign-reveal",
    expected: "accepted",
    source: `import {Reveal,Loading} from 'solid-js';export function App(){return <Reveal><Loading fallback="wait"><p>ok</p></Loading></Reveal>}`
  },
  {
    id: "opaque-reactive-argument",
    expected: "accepted",
    source: `import {createSignal,createMemo} from 'solid-js';declare function load(n:number):number;export function App(){const [n]=createSignal(1);const value=createMemo(()=>load(n()));return <p>{value()}</p>}`
  },
  {
    id: "receiver-reactive-argument",
    expected: "accepted",
    source: `import {createSignal,createMemo} from 'solid-js';declare const api:{load(n:number):number};export function App(){const [n]=createSignal(1);const value=createMemo(()=>api.load(n()));return <p>{value()}</p>}`
  },
  {
    id: "timer-callback-failure",
    expectedDiagnostic: "NATIVE_CALLBACK_FAILURE",
    source: `import {createSignal,createMemo} from 'solid-js';declare function risk():void;export function App(){const [n]=createSignal(2);const timer=createMemo(()=>setTimeout(()=>{n();risk()},10));return <p>{timer()}</p>}`
  },
  {
    id: "native-latest-pending",
    expected: "accepted",
    source: `import {createSignal,latest,isPending} from 'solid-js';export function App(){const [n]=createSignal(2);return <p>{latest(n)}{isPending(n)?"pending":"ready"}</p>}`
  },
  {
    id: "handled-catch",
    expected: "accepted",
    source: `import {createMemo} from 'solid-js';export function App(){const n=createMemo(()=>{try{throw new Error('bad')}catch{return 7}});return <p>{n()}</p>}`
  },
  {
    id: "rethrow-catch",
    expected: "accepted",
    source: `import {createMemo} from 'solid-js';export function App(){const n=createMemo(()=>{try{throw new Error('bad')}catch(e){throw e}});return <p>{n()}</p>}`
  },
  {
    id: "unknown-rethrow-catch",
    expected: "accepted",
    source: `import {createMemo} from 'solid-js';export function App(){const n=createMemo(()=>{try{throw new Error('bad')}catch(e){String(e);throw e}});return <p>{n()}</p>}`
  },
  {
    id: "generator-action",
    expected: "accepted",
    source: `import {action,createSignal} from 'solid-js';export function App(){const [n,set]=createSignal(0);const save=action(function*(){try{yield Promise.resolve(2);set(n()+1)}catch{set(-1)}});return <button onClick={save}>{n()}</button>}`
  },
  ...[
    ["event-updater", "return <button onClick={()=>write(c=>{c.n=n()})}/>;"],
    [
      "event-array-nesting",
      "return <button onClick={()=>[1].filter(()=>n()).forEach(()=>set(n()+1))}/>;"
    ],
    [
      "event-promise-nesting",
      "return <button onClick={()=>Promise.resolve().then(()=>set(n()+1))}/>;"
    ],
    ["event-deep-nesting", "return <button onClick={()=>consume(()=>consume(()=>n()))}/>;"],
    ["effect-compute-nesting", "createEffect(()=>consume(()=>n()),value=>{});return <p/>;"],
    [
      "effect-phase-nesting",
      "createEffect(()=>n(),value=>{consume(()=>set(n()+value))});return <p/>;"
    ],
    ["memo-opaque-nesting", "const value=createMemo(()=>consume(()=>n()));return <p>{value()}</p>;"]
  ].map(([id, body]) => ({
    id,
    expected: "accepted",
    source: `import {createSignal,createEffect,createMemo,createStore} from 'solid-js';declare function consume<T>(callback:()=>T):T;export function App(){const [n,set]=createSignal(1);const [state,write]=createStore({n:0});${body}}`
  })),
  {
    id: "native-store",
    expected: "accepted",
    source: `import {createStore} from 'solid-js';export function App(){const [state,set]=createStore({n:1});return <button onClick={()=>set(s=>{s.n++})}>{state.n}</button>}`
  },
  {
    id: "native-optimistic",
    expected: "accepted",
    source: `import {createOptimistic} from 'solid-js';export function App(){const [n,set]=createOptimistic(0);return <button onClick={()=>set(n()+1)}>{n()}</button>}`
  },
  {
    id: "timer-callback",
    expectedDiagnostic: "MemoOp",
    source: `import {createSignal,createMemo} from 'solid-js';export function App(){const [n,set]=createSignal(0);const timer=createMemo(()=>setTimeout(()=>set(n()+1),10));return <p>{timer()}{n()}</p>}`
  },
  {
    id: "native-settled",
    expected: "accepted",
    source: `import {onSettled} from 'solid-js';export function App(){onSettled(()=>{return ()=>{}});return <p/>}`
  },
  {
    id: "reactive-array-map",
    expected: "accepted",
    source: `import {createSignal,createMemo} from 'solid-js';export function App(){const [n]=createSignal(2);const values=createMemo(()=>[1,2].map(x=>x*n()));return <p>{values().join(',')}</p>}`
  },

  {
    id: "class-memo",
    source: `import {createMemo} from 'solid-js'; class Failed extends Error{} function load(){throw new Failed('bad')} export function App(){const value=createMemo(()=>load());return <p>{value()}</p>}`,
    expected: "accepted"
  },
  {
    id: "unknown-memo",
    source: `import {createMemo} from 'solid-js'; function load(){throw 'bad'} export function App(){const value=createMemo(()=>load());return <p>{value()}</p>}`,
    expected: "accepted"
  },
  {
    id: "async-event",
    source: `export function App(){return <button onClick={async()=>{throw new Error('bad')}}/>}`,
    expected: "accepted"
  },
  {
    id: "named-async-event",
    source: `async function save(){throw new Error('bad')} export function App(){return <button onClick={save}/>}`,
    expected: "accepted"
  },
  {
    id: "promise-catch",
    source: `import {createMemo} from 'solid-js'; export function App(){const value=createMemo(()=>Promise.reject(new Error('bad')).catch(()=>1));return <p>{value()}</p>}`,
    expected: "accepted"
  },

  {
    id: "promise-event",
    source: counter('return <button onClick={()=>Promise.reject("failed")}/>;')
  },
  {
    id: "counter",
    source: counter(
      "const twice=createMemo(()=>count()*2);return <button onClick={()=>set(count()+1)}>{twice()}</button>;"
    ),
    expected: "accepted"
  },
  {
    id: "conditional",
    source: counter("return <p>{count()>0 ? count() : 0}</p>;"),
    expected: "accepted"
  },
  {
    id: "loop",
    source: counter(
      "return <button onClick={()=>{if(count()===0)return;for(let i=0;i<2;i++)set(i);}}>{count()}</button>;"
    ),
    expected: "accepted"
  },
  {
    id: "props",
    source: "export function Child(props:{value:number}){return <p>{props.value}</p>;}",
    expected: "accepted"
  },
  {
    id: "tag",
    source: "function Child(){return <p/>;} export function Parent(){return <Child/>;}",
    expected: "accepted",
    slots: ["T01", "L01"]
  },
  {
    id: "setup-read",
    source: counter("const n=count();return <p>{n}</p>;"),
    slots: ["T02", "L02", "R01", "R04"]
  },
  {
    id: "named-event",
    source: counter("const save=()=>set(1);return <button onClick={save}/>;"),
    slots: ["T03", "L04"]
  },
  {
    id: "inline-event",
    source: counter("return <button onClick={()=>set(1)}/>;"),
    expected: "accepted",
    slots: ["T04", "L03", "R02"]
  },
  { id: "effect-arity", source: counter("createEffect(()=>{});return <p/>;"), slots: ["T05"] },
  {
    id: "row",
    source: `${signal} export function List(){return <For each={[1,2]}>{n=><li>{n}</li>}</For>;}`,
    expected: "accepted",
    slots: ["T06", "L07"]
  },
  {
    id: "pending-root",
    expectedDiagnostic: "PENDING_ROOT",
    source: `${signal} import {render} from '@solidjs/web';function App(){const n=createMemo(async()=>1);return <p>{n()}</p>;}render(App,document.body);`,
    slots: ["T07"]
  },
  {
    id: "colored-prop",
    source: `${signal} function Child(p:{n:number}){return <p>{p.n}</p>;}export function App(){const n=createMemo(async()=>1);return <Child n={n()}/>;}`,
    slots: ["T08"]
  },
  {
    id: "throw-error",
    source: counter('return <button onClick={()=>{throw new Error("oops");}}/>;'),
    slots: ["T09", "R03"]
  },
  {
    id: "context",
    source: `${signal} const C=createContext<number>();export function Child(){const n=useContext(C);return <p>{n}</p>;}export function App(){return <C value={1}><Child/></C>;}`,
    expected: "accepted",
    slots: ["T10"]
  },
  {
    id: "lazy-child",
    source: `${signal} export function App(){return <Loading fallback={<p>wait</p>}><p>ready</p></Loading>;}`,
    expected: "accepted",
    slots: ["T11"]
  },
  {
    id: "eager-jsx",
    source: counter("const child=<p>{count()}</p>;return <div>{child}</div>;"),
    slots: ["L05"]
  },
  {
    id: "catch",
    source: counter("return <button onClick={()=>{try{set(1);}catch{set(2);}}}/>;"),
    slots: ["L06"]
  },
  {
    id: "memo-write",
    source: counter("const n=createMemo(()=>{set(1);return count();});return <p>{n()}</p>;"),
    slots: ["R05"]
  },
  { id: "hole-create", source: counter("return <p>{createSignal(1)[0]()}</p>;"), slots: ["R06"] },
  {
    id: "async-effect",
    source: counter("createEffect(()=>count(),async n=>{set(n);});return <p/>;"),
    slots: ["R07"]
  },
  {
    id: "missing-context",
    source: `${signal} import {render} from '@solidjs/web';const C=createContext<number>();function App(){const n=useContext(C);return <p>{n}</p>;}render(App,document.body);`,
    slots: ["R08"]
  },
  {
    id: "unhandled-failure",
    source: counter('return <button onClick={()=>{throw new Error("nope!");}}/>;'),
    slots: ["R09"]
  },
  {
    id: "callback-read",
    source: counter("const n=createMemo(()=>[1].map(()=>count()));return <p>{n()}</p>;")
  },
  {
    id: "async-read",
    source: counter("const n=createMemo(async()=>count());return <p>{n()}</p>;")
  },
  {
    id: "method-read",
    source: counter("const obj={read(){return count();}};return <p>{obj.read()}</p>;")
  },
  {
    id: "feedback",
    source: counter(
      "const n=createMemo(()=>count());createEffect(()=>n(),n=>{set(n+1);});return <p>{n()}</p>;"
    ),
    expected: "accepted"
  },
  { id: "unknown-throw", source: "export function fail(e:unknown){throw e;}" },
  {
    id: "server-rejection",
    source: `${signal} async function load(){"use server";return 1;}export function App(){const n=createMemo(()=>load());return <p>{n()}</p>;}`
  },
  {
    id: "spread",
    source: counter("const attributes={onClick:()=>set(1)};return <button {...attributes}/>;")
  },
  { id: "ref", source: counter("return <button ref={el=>el.focus()}/>;") },
  {
    id: "effect-bundle",
    source: counter("createEffect(()=>count(),{effect:n=>set(n)});return <p/>;")
  }
];
export const missingSlots = ["T12", "T13", "T14", "T15", "R10", "R11", "R12"];
