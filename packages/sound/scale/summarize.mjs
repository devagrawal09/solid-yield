// Summarize trusted driver output; do not load application modules.
import fs from 'node:fs';
import ts from 'typescript';
import { fixtures } from '../fixtures/index.mjs';
import { APP } from './input.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const log=p=>fs.readFileSync(p,'utf8');
const records=p=>log(p).split(String.fromCharCode(10)).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const time=p=>{
 const lines=log(p).split(String.fromCharCode(10));
 return {workerPeakRssBytes:Number(lines.find(l=>l.includes('maximum resident set size'))?.trim().split(' ')[0]),wallSeconds:Number(lines.find(l=>l.includes(' real ')&&l.includes(' user '))?.trim().split(' real')[0])};
};
const base='scale/evidence/';
const unbounded=records(base+'memory-unbounded.log');
const profile=records(base+'memory-bounded.log');
const cold=read(base+'cold.json'), coldProcess=read(base+'cold.process.json');
const updates=read(base+'openclaw.json'), updateProcess=read(base+'openclaw.process.json');
const suite=read('results/latest.json').results.find(r=>r.prototype==='dataflow');
const driverPeakKiB=Math.max(...coldProcess.samples.map(s=>s.driverRssKiB??0));
const wrapperPeakKiB=Math.max(...coldProcess.samples.flatMap(s=>s.processes.filter(r=>r[0]===r[1]).map(r=>r[2])));
coldProcess.driverPeakRssKiB=driverPeakKiB;
coldProcess.wrapperPeakRssKiB=wrapperPeakKiB;
coldProcess.conservativeCombinedPeakUpperKiB=cold.memory.find(r=>r.stage==='cold').maxRSS+driverPeakKiB+wrapperPeakKiB;
coldProcess.sampleCount=coldProcess.samples.length;
coldProcess.maxGroupProcesses=Math.max(...coldProcess.samples.map(s=>s.processes.length));
updateProcess.sampleCount=updateProcess.samples.length;
updateProcess.maxGroupProcesses=Math.max(...updateProcess.samples.map(s=>s.processes.length));
const scores=suite.scores;
const mutants=fixtures.filter(f=>f.mutation);
const missed=scores.filter(s=>mutants.some(f=>f.id===s.fixture)&&s.misses.length);
const summary={
 environment:{baseCommit:"05df715",branch:"solid-sound-dataflow-scale",platform:process.platform,arch:process.arch,node:process.version,typescript:ts.version,solid:JSON.parse(fs.readFileSync(APP+'/node_modules/solid-js/package.json','utf8')).version,oldSpaceMiB:2048,rootCount:cold.roots,excluded:cold.excluded,all:cold.all,loc:cold.loc},
 unboundedProgram:{inventory:unbounded[0],lastCheckpoint:unbounded.at(-1),...time(base+'memory-unbounded.log'),completed:false,failure:'V8 heap exhaustion before createProgram returned'},
 attribution:{stages:profile.filter(r=>r.stage!=='load'),...time(base+'memory-bounded.log')},
 cold:{createMs:cold.createMs,checkMs:cold.coldMs,result:cold.cold,memory:cold.memory,process:{...coldProcess,samples:undefined},osTiming:time(base+'cold.log')},
 incremental:{coldMs:updates.coldMs,updates:updates.updates.map(u=>({file:u.file,kind:u.kind,ms:u.ms,restoreMs:u.restoreMs,restoredCount:u.restoredCount,result:{diagnosticCount:u.result.diagnosticCount,invalidatedCount:u.result.invalidatedCount,reanalyzedCount:u.result.reanalyzedCount,summaryChanges:u.result.summaryChanges,summaryHash:u.result.summaryHash}})),process:{...updateProcess,samples:undefined},memory:updates.memory,osTiming:time(base+'openclaw.log')},
 frozen:{fixtures:scores.length,soundnessFailures:scores.filter(s=>s.soundnessFailure).length,misses:scores.reduce((n,s)=>n+s.misses.length,0),warningMisses:scores.reduce((n,s)=>n+s.warningMisses.length,0),infoMisses:scores.reduce((n,s)=>n+s.infoMisses,0),unmapped:scores.reduce((n,s)=>n+s.unmapped,0),leakage:scores.reduce((n,s)=>n+s.leakage.length,0),codeTableViolations:scores.reduce((n,s)=>n+s.codeTableViolations.length,0),extraErrors:scores.reduce((n,s)=>n+s.extraErrors.length,0),extraWarnings:scores.reduce((n,s)=>n+s.extraWarnings.length,0),mutants:mutants.length,missedMutants:missed.map(s=>s.fixture),crashes:suite.crashes}
};
fs.writeFileSync(base+'measurements.json',JSON.stringify(summary,null,2)+String.fromCharCode(10));
console.log(JSON.stringify({cold:summary.cold.checkMs,frozen:summary.frozen,updates:summary.incremental.updates.map(u=>({file:u.file,kind:u.kind,ms:u.ms}))}));
