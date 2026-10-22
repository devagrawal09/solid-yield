"""Partition raw findings by visible causal evidence, without claiming a precision rate.

Exact origin is deliberately unresolved when the checker did not retain it. A
warning at the same source position identifies a boundary; nearby warnings do
not prove causation. Manual source traces and verdicts live in review.json.
"""
from collections import Counter, defaultdict
import gzip
import json
from pathlib import Path

out = Path('prototypes/dataflow/noise-evidence')

def read(label):
    with gzip.open(out / (label + '.diagnostics.json.gz'), 'rt') as stream:
        return json.load(stream)

def key(d):
    loc = d['loc']
    return d['code'], loc['file'], loc['line'], loc['col']

def site(d):
    return key(d)[1:]

def cause(construct):
    if construct.startswith('calling the component PendingDevice '):
        return 'alias identity defect (confirmed, before only)'
    if construct.startswith('unchecked source'):
        return 'unchecked implementation import/re-export'
    if construct in ['an import without declarations', 'a call without a declared result shape']:
        return 'missing declaration/result shape'
    if 'bounded' in construct or 'work limit' in construct:
        return 'recursion/depth/work cutoff'
    if any(s in construct for s in ['spread', 'object member', 'service member', 'context service', 'module state']):
        return 'object/prop/escape semantics outside model'
    if construct == 'a compute-form signal' or construct.endswith('(…)') or 'outside a component' in construct or construct.startswith('<'):
        return 'Solid API/ownership semantics outside model'
    if 'component' in construct or 'provider' in construct or 'render argument' in construct:
        return 'unresolved render/provider/call shape'
    return 'other unsupported syntax/callback shape'

def summarize(label):
    process = json.loads((out / (label + '.process.json')).read_text())
    assert process['code'] == 0 and not process['timedOut'], (label, process)
    meta = json.loads((out / (label + '.json')).read_text())
    assert meta['stage'] == 'complete', label
    rows = read(label)
    assert len(rows) == sum(meta['counts'].values()), label
    boundaries = defaultdict(set)
    for d in rows:
        if d['code'] == 'UNANALYZED_BOUNDARY':
            boundaries[site(d)].add(cause(d['data']['construct']))
    counts = Counter()
    code_counts = defaultdict(Counter)
    for d in rows:
        code, data = d['code'], d.get('data', {})
        if code == 'UNANALYZED_BOUNDARY':
            classification = 'direct: ' + cause(data['construct'])
        elif code == 'COMPONENT_OBLIGATIONS_EXPORTED':
            classification = 'summary: exported obligations (origins may overlap)'
        elif boundaries[site(d)]:
            classification = 'downstream at explicit boundary: ' + ' + '.join(sorted(boundaries[site(d)]))
        elif 'unknown' in data.get('failures', []) or 'unknown' in d['message']:
            classification = 'downstream: unknown failure (exact origin unretained)'
        elif data.get('source', '').startswith('props.'):
            classification = 'downstream: prop-flow obligation (exact origin unretained)'
        elif any(s in data.get('source', '') for s in ['analysis work limit', 'recursive', 'bounded']):
            classification = 'downstream: work cutoff'
        elif code in ['ASYNC_OUTSIDE_LOADING_BOUNDARY', 'PENDING_ASYNC_FORBIDDEN_SCOPE', 'PENDING_ASYNC_UNTRACKED_READ', 'PENDING_ASYNC_IN_HANDLER']:
            classification = 'downstream: source read (known/unknown provenance unretained)'
        elif code in ['STRICT_READ_UNTRACKED', 'REACTIVE_WRITE_IN_OWNED_SCOPE']:
            classification = 'candidate supported scope/write error (manual review required)'
        elif code == 'CONTEXT_PROVIDER_MISSING':
            classification = 'candidate missing provider on modeled path (manual review required)'
        else:
            classification = 'downstream: known failure set (path/body proof requires review)'
        counts[classification] += 1
        code_counts[classification][d['severity'] + ':' + code] += 1
    locs = defaultdict(set)
    for d in rows:
        locs[site(d)].add(d['code'])
    return dict(total=len(rows), byCause=dict(counts.most_common()),
                codesByCause={k: dict(v) for k, v in code_counts.items()},
                exactDuplicateCodeLocations=len(rows)-len({key(d) for d in rows}),
                pendingAndFailureSites=sum({'ASYNC_OUTSIDE_LOADING_BOUNDARY', 'ERROR_OUTSIDE_ERRORED_BOUNDARY'} <= codes for codes in locs.values()),
                boundaryAndErrorSites=sum('UNANALYZED_BOUNDARY' in codes and any(code not in ['UNANALYZED_BOUNDARY', 'COMPONENT_OBLIGATIONS_EXPORTED', 'PENDING_ASYNC_IN_HANDLER'] for code in codes) for codes in locs.values()),
                cutoffActivations=len(meta['budgetHits']),
                activationsPastStepBudget=sum(t['steps'] > 20000 for t in meta['budgetHits']),
                activationsAtLeastOneSecond=sum(t['ms'] >= 1000 for t in meta['budgetHits']))

before, after = read('before'), read('after')
bk, ak = {key(d): d for d in before}, {key(d): d for d in after}
summary = dict(method='Visible-origin partition, not adjudication. Colocation only; never infer a causal link from proximity. Direct boundary sites and downstream obligations overlap in cause, not in this partition.',
               before=summarize('before'), after=summarize('after'),
               removedByCode=dict(Counter(d['code'] for k, d in bk.items() if k not in ak)),
               addedByCode=dict(Counter(d['code'] for k, d in ak.items() if k not in bk)),
               changedMessageByCode=dict(Counter(d['code'] for k, d in ak.items() if k in bk and d['message'] != bk[k]['message'])))
round1 = read('after-round1')
rk = {key(d): d for d in round1}
summary['round1'] = summarize('after-round1')
summary['followupRemovedByCode'] = dict(Counter(d['code'] for k, d in rk.items() if k not in ak))
summary['followupAddedByCode'] = dict(Counter(d['code'] for k, d in ak.items() if k not in rk))
(out / 'root-causes.json').write_text(json.dumps(summary, indent=2)+'\n')
review = json.loads((out / 'review.json').read_text())
assert len(review['errors']) >= 40 and len(review['silences']) >= 15
for row in review['errors']:
    assert ak[key(row['diagnostic'])] == row['diagnostic'], row['id']
    assert row['verdict'] in ['TP', 'FP', 'UNSURE'] and row['contractObligation'] and row['reason']
for row in review['silences']:
    assert not any(d['severity'] == 'error' and d['loc']['file'] == row['loc']['file'] and d['loc']['line'] == row['loc']['line'] for d in after), row['id']
print(json.dumps({k: v['byCause'] for k, v in summary.items() if k in ['before', 'after']}, indent=2))
