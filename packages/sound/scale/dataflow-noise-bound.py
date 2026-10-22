"""Run one trusted checker/test command, capped and with process-group cleanup."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

label, timeout, *command = sys.argv[1:]
out = Path('prototypes/dataflow/noise-evidence')
out.mkdir(exist_ok=True)
env = dict(os.environ, NODE_OPTIONS='--max-old-space-size=2048')
node_dir = '/Users/devagr/.nvm/versions/node/v24.18.0/bin'
env['PATH'] = node_dir + os.pathsep + env['PATH']
start = time.monotonic()
with (out / (label + '.log')).open('w') as log:
    child = subprocess.Popen(command, env=env, stdout=log, stderr=log, start_new_session=True)
    timed_out = False
    try:
        code = child.wait(timeout=int(timeout))
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGKILL)
        code = child.wait()
    finally:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
result = dict(command=command, code=code, timedOut=timed_out, wallSeconds=time.monotonic()-start)
(out / (label + '.process.json')).write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
sys.exit(code if code >= 0 else 1)
