// Trusted driver. The application is read as data, never imported/executed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { APP, files, excluded, all, options } from './input.mjs';
import { createChecker } from '../prototypes/dataflow/index.mjs';
const out = path.resolve(process.env.SOUND_SCALE_OUT ?? 'scale/evidence/openclaw');
fs.mkdirSync(path.dirname(out), { recursive:true });
const save = (suffix, value) => fs.writeFileSync(out+suffix, JSON.stringify(value,null,2));
const tally = values => { const counts = {}; for (const value of values) counts[value] = (counts[value] ?? 0)+1; return counts; };
const describe = result => ({ elapsedMs:result.elapsedMs, diagnosticCount:result.diagnostics.length,
  counts:tally(result.diagnostics.map(d => d.severity+':'+d.code)), programStats: result.programStats,
  partialByConstruct:tally(result.diagnostics.filter(d=>d.code==='UNANALYZED_BOUNDARY').map(d=>d.data?.construct ?? 'unspecified')),
  invalidatedCount:result.invalidatedFiles?.length, reanalyzedCount:result.reanalyzedFiles?.length,
  summaryHash:result.summaryHash, summaryChanges:result.summaryChanges,
  slowestJobs:[...(result.timings ?? [])].sort((a,b)=>b.ms-a.ms).slice(0,20),
  namedJobs:(result.timings ?? []).filter(row=>['settings-sidebar-shell.tsx','multi-select.tsx'].some(name=>row.file.endsWith('/'+name))),
  fileTimes:Object.entries((result.timings ?? []).reduce((times,row)=>{times[row.file]=(times[row.file]??0)+row.ms;return times;},{})).sort((a,b)=>b[1]-a[1]).slice(0,20)
});
if (process.argv.includes('--worker')) {
  const result = {node:process.version,roots:files.length,excluded:excluded.length,all:all.length,loc:files.reduce((n,f)=>n+fs.readFileSync(f,'utf8').split(String.fromCharCode(10)).length-1,0),memory:[],updates:[],stage:'create'};
  const flush = () => save('.json',result);
  const sample = stage => result.memory.push({stage,...process.memoryUsage(),maxRSS:process.resourceUsage().maxRSS});
  let checker;
  try {
    flush(); let start=performance.now(); checker=createChecker({rootDir:APP,files,compilerOptions:options}); result.createMs=performance.now()-start; sample('create');
    result.stage='cold'; flush(); start=performance.now(); const cold=checker.check(); result.coldMs=performance.now()-start; result.cold=describe(cold); sample('cold'); flush();
    if (process.argv.includes('--updates')) for (const relative of ['components/theme-brand-icon.tsx','lib/reactive/i18n.ts','app/app-root.tsx']) {
      const file=path.join(APP,'src',relative), original=fs.readFileSync(file,'utf8');
      const source=ts.createSourceFile(file,original,ts.ScriptTarget.Latest,true); let literal;
      const visit=node=>{ if (!literal && (node.kind===ts.SyntaxKind.TrueKeyword || node.kind===ts.SyntaxKind.FalseKeyword)) literal=node; ts.forEachChild(node,visit); }; visit(source);
      const semantic=literal ? original.slice(0,literal.getStart(source))+(literal.kind===ts.SyntaxKind.TrueKeyword?'false':'true')+original.slice(literal.end) : original+String.fromCharCode(10)+'const __soundScaleSemantic = 1;';
      for (const [kind,text] of [['trivial',original+String.fromCharCode(10)],['semantic',semantic]]) {
        result.stage='update:'+relative+':'+kind; flush(); start=performance.now(); const updated=checker.update(file,text);
        const row={file:relative,kind,ms:performance.now()-start,result:describe(updated)}; result.updates.push(row); sample(result.stage); flush();
        start=performance.now(); const restored=checker.update(file,original); row.restoreMs=performance.now()-start; row.restoredCount=restored.diagnostics.length; flush();
      }
    }
    result.stage='complete';
  } catch (error) { result.stage='failed'; result.error={message:String(error),stack:error.stack}; process.exitCode=1; }
  finally { checker?.dispose(); sample('disposed'); result.resourceUsage=process.resourceUsage(); flush(); }
} else {
  const log=fs.openSync(out+'.log','w');
  const args=['-l',process.execPath,'--max-old-space-size=2048',fileURLToPath(import.meta.url),'--worker',...process.argv.slice(2)];
  const start=performance.now(), child=spawn('/usr/bin/time',args,{detached:true,stdio:['ignore',log,log]});
  let peak=0, peakCombined=0, timedOut=false; const samples=[];
  const sampler=setInterval(()=>{
    const rows=spawnSync('ps',['-axo','pid=,pgid=,rss='],{encoding:'utf8'}).stdout.trim().split(String.fromCharCode(10)).map(l=>l.trim().split(/ +/).map(Number)).filter(r=>r[1]===child.pid);
    const rss=rows.reduce((n,r)=>n+r[2],0); peak=Math.max(peak,rss); peakCombined=Math.max(peakCombined,rss+process.memoryUsage().rss/1024);
    samples.push({ms:performance.now()-start,rssKiB:rss,driverRssKiB:process.memoryUsage().rss/1024,processes:rows});
  },250);
  const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},process.argv.includes('--updates')?900000:120000);
  const exit=await new Promise(resolve=>{child.once('error',error=>resolve({error:String(error)}));child.once('close',(code,signal)=>resolve({code,signal}));});
  clearInterval(sampler);clearTimeout(timer);fs.closeSync(log);
  try { process.kill(-child.pid,'SIGKILL'); } catch {}
  const processResult={command:args,wallMs:performance.now()-start,timedOut,...exit,peakGroupRssKiB:peak,peakIncludingDriverRssKiB:peakCombined,samples};
  save('.process.json',processResult); console.log(JSON.stringify({...processResult,samples:undefined}));
  process.exitCode=exit.code ?? 1;
}
