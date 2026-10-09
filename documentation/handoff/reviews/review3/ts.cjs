// usage: node ts.cjs diag|hover [names...]
const { spawn } = require("node:child_process"); const fs=require("fs"), path=require("path");
const app = "/private/tmp/sy-review3-out/app";
const child = spawn(process.execPath,[require.resolve("typescript/lib/tsserver.js",{paths:[app]}),"--allowLocalPluginLoads","--pluginProbeLocations",app],{stdio:["pipe","pipe","pipe"],cwd:app});
let buf=Buffer.alloc(0),seq=0;const pend=new Map();
child.stdout.on("data",c=>{buf=Buffer.concat([buf,c]);for(;;){const e=buf.indexOf("\r\n\r\n");if(e<0)return;const m=/Content-Length: (\d+)/.exec(buf.subarray(0,e).toString());const l=+m[1];if(buf.length<e+4+l)return;const msg=JSON.parse(buf.subarray(e+4,e+4+l));buf=buf.subarray(e+4+l);if(msg.type==="response"&&pend.has(msg.request_seq)){const p=pend.get(msg.request_seq);pend.delete(msg.request_seq);p(msg)}}});
const req=(command,args)=>new Promise(r=>{const id=++seq;pend.set(id,r);child.stdin.write(JSON.stringify({seq:id,type:"request",command,arguments:args})+"\n")});
(async()=>{
 const mode=process.argv[2]; const files=fs.readdirSync(app+"/src").filter(f=>/\.tsx?$/.test(f)).map(f=>path.join(app,"src",f));
 for(const f of files) await req("open",{file:f,fileContent:fs.readFileSync(f,"utf8")});
 if(mode==="diag"){ for(const f of files){const r=await req("semanticDiagnosticsSync",{file:f});for(const d of r.body||[])console.log(path.basename(f)+":"+d.start.line+":"+d.start.offset,(d.text||"").split("\n")[0].slice(0,220));} }
 else { for(const spec of process.argv.slice(3)){ const [fn,name]=spec.split(":"); const f=path.join(app,"src",fn); const t=fs.readFileSync(f,"utf8"); const i=t.indexOf("function "+name)+9; const pre=t.slice(0,i); const line=pre.split("\n").length; const off=i-pre.lastIndexOf("\n"); const r=await req("quickinfo",{file:f,line,offset:off}); console.log(spec, "=>", r.success?(r.body.displayString||"").slice(0,300):r.message);} }
 child.kill(); process.exit(0);
})();
