// Parse-only whole-app evidence. Never execute the input's modules or scripts.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { APP, files, excluded, all, options } from './input.mjs';
// A trusted baseline snapshot may be selected for an identical-input comparison.
const { createChecker } = await import(process.env.SOUND_NOISE_CHECKER ?? '../prototypes/dataflow/index.mjs');
const label=process.argv[2] ?? 'after';
const out=`prototypes/dataflow/noise-evidence/${label}`;
fs.mkdirSync('prototypes/dataflow/noise-evidence',{recursive:true});
const save=(suffix,value)=>fs.writeFileSync(out+suffix,JSON.stringify(value,null,2)+'\n');
const tally=values=>{const counts={};for(const v of values)counts[v]=(counts[v]??0)+1;return counts;};
if(process.argv.includes('--worker')){
  save('.json',{stage:'checking',node:process.version,roots:files.length});
  const start=performance.now();
  const checker=createChecker({rootDir:APP,files,compilerOptions:options});
  try{
    const result=checker.check();
    const diagnostics=result.diagnostics.map(d=>({...d,loc:{...d.loc,file:d.loc.file.replace(APP+'/','')},related:d.related?.map(r=>({...r,loc:{...r.loc,file:r.loc.file.replace(APP+'/','')}}))}));
    const raw=JSON.stringify(diagnostics)+'\n';
    fs.writeFileSync(out+'.diagnostics.json.gz',gzipSync(raw,{level:9}));
    save('.json',{stage:'complete',node:process.version,roots:files.length,excluded:excluded.length,all:all.length,
      loc:files.reduce((n,f)=>n+fs.readFileSync(f,'utf8').split('\n').length-1,0),
      inputHash:createHash('sha256').update(files.map(f=>f.replace(APP+'/','')+'\0'+createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join('\n')).digest('hex'),
      compilerOptions:options,elapsedMs:result.elapsedMs,wallMs:performance.now()-start,counts:tally(diagnostics.map(d=>d.severity+':'+d.code)),
      partialByConstruct:tally(diagnostics.filter(d=>d.code==='UNANALYZED_BOUNDARY').map(d=>d.data?.construct)),
      programStats:result.programStats,invalidated:result.invalidatedFiles.length,reanalyzed:result.reanalyzedFiles.length,
      budgetHits:result.timings.filter(t=>t.partial),jobs:result.timings.length,
      workerMaxRssKiB:process.resourceUsage().maxRSS,memory:process.memoryUsage()});
    console.log(JSON.stringify({label,diagnostics:diagnostics.length,elapsedMs:result.elapsedMs,rss:process.resourceUsage().maxRSS}));
  }finally{checker.dispose();}
}else{
  const log=fs.openSync(out+'.log','w');
  const args=['-l',process.execPath,'--max-old-space-size=2048',fileURLToPath(import.meta.url),label,'--worker'];
  const child=spawn('/usr/bin/time',args,{detached:true,stdio:['ignore',log,log]});
  const start=performance.now();let timedOut=false;
  const cleanup=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const timer=setTimeout(()=>{timedOut=true;cleanup();},120000);
  const result=await new Promise(resolve=>{child.once('error',e=>resolve({error:String(e)}));child.once('close',(code,signal)=>resolve({code,signal}));});
  clearTimeout(timer);cleanup();fs.closeSync(log);
  save('.process.json',{command:args,...result,timedOut,wallMs:performance.now()-start});
  console.log(JSON.stringify({label,...result,timedOut}));process.exitCode=result.code??1;
}
