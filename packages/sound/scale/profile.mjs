// Parse-only attribution run. --unbounded reproduces the original TS closure.
// --ts-only stops before B; --expose-gc makes retained-heap samples comparable.
import ts from 'typescript';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Analysis } from '../prototypes/dataflow/analyze.mjs';
import { boundedImports } from '../prototypes/dataflow/imports.mjs';
import { APP, files, options } from './input.mjs';
const start = performance.now();
const sample = (stage, extra={}) => { global.gc?.(); console.log(JSON.stringify({stage,ms:performance.now()-start,...process.memoryUsage(),maxRSS:process.resourceUsage().maxRSS,...extra})); };
sample('inventory',{roots:files.length});
const host = ts.createCompilerHost(options), original = host.getSourceFile;
host.getCurrentDirectory = () => APP;
const imports = boundedImports(files,APP,options,host);
if (!process.argv.includes('--unbounded')) host.resolveModuleNames=imports.resolve;
const roots = new Set(files), libDir = path.dirname(ts.getDefaultLibFilePath(options));
const categories = {}; let count=0;
host.getSourceFile=(...args)=>{
  const sf=original(...args);
  if(sf) {
    const category=roots.has(sf.fileName)?'checked':sf.fileName.startsWith(libDir+'/')?'typescript-lib':sf.isDeclarationFile?'declaration':'unchecked-source-or-json';
    const row=categories[category]??={count:0,chars:0}; row.count++; row.chars+=sf.text.length; count++;
  }
  if(count%100===0) console.log(JSON.stringify({stage:'load',count,file:args[0],categories,...process.memoryUsage()}));
  return sf;
};
const program=ts.createProgram(files,options,host);
sample('program',{sourceFiles:program.getSourceFiles().length,categories});
const oracle=()=>({nodes:program.getNodeCount(),symbols:program.getSymbolCount(),types:program.getTypeCount(),instantiations:program.getInstantiationCount()});
program.getTypeChecker(); sample('type-checker',oracle());
if(!process.argv.includes('--ts-only')) {
  let analysis=new Analysis(program,files,{opaqueImports:imports.opaque,onPhase:stage=>sample(stage,oracle())});
  sample('analysis-created');
  const diagnostics=analysis.run(); sample('analysis-complete',{diagnostics:diagnostics.length,...oracle()});
  analysis=null; sample('analysis-released',{diagnostics:diagnostics.length,...oracle()});
}
