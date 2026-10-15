const { spawn } = require("child_process"); const path=require("path"); const fs=require("fs");
const app="/private/tmp/sy-review2-out/app"; const file=app+"/src/index.tsx";
const child=spawn(process.execPath,[path.join(app,"node_modules/typescript/lib/tsserver.js"),"--allowLocalPluginLoads","--pluginProbeLocations",app],{stdio:["pipe","pipe","pipe"]});
let buf=Buffer.alloc(0),seq=0,pend=new Map(),err="";
child.stderr.on("data",c=>err+=c);
child.stdout.on("data",ch=>{buf=Buffer.concat([buf,ch]);for(;;){const e=buf.indexOf("\r\n\r\n");if(e<0)return;const m=/Content-Length: (\d+)/.exec(buf.subarray(0,e).toString());const L=+m[1];if(buf.length<e+4+L)return;const msg=JSON.parse(buf.subarray(e+4,e+4+L));buf=buf.subarray(e+4+L);if(msg.type==="response"&&pend.has(msg.request_seq)){pend.get(msg.request_seq)(msg);pend.delete(msg.request_seq)}}});
const req=(command,args)=>new Promise(r=>{const id=++seq;pend.set(id,r);child.stdin.write(JSON.stringify({seq:id,type:"request",command,arguments:args})+"\n")});
(async()=>{
 await req("open",{file,fileContent:fs.readFileSync(file,"utf8"),scriptKindName:"TSX"});
 const d=await req("semanticDiagnosticsSync",{file});
 console.log("DIAGS",JSON.stringify((d.body||[]).map(x=>[x.start.line+":"+x.start.offset,x.code,x.text.slice(0,140)])));
 const src=fs.readFileSync(file,"utf8").split("\n");
 for (const name of ["function Counter","function TodoList","function App","function Form","const todos","fetchTodos(props"]) {
  const i=src.findIndex(l=>l.includes(name)); if(i<0)continue; const col=src[i].indexOf(name.split(" ").pop())+1;
  const q=await req("quickinfo",{file,line:i+1,offset:col});
  console.log("HOVER",name,"@",i+1+":"+col,"=>",q.success?JSON.stringify(q.body.displayString).slice(0,300):q.message);
 }
 child.kill(); console.log("stderr:",err.slice(0,200));
})();
