import subprocess, shutil, os, sys, json
APP="/private/tmp/sy-review3-out/app"; BASE="/private/tmp/sy-review3-out/base"
M = {
 1: ("swallow empty catch (Checkout)", {"Checkout.tsx": [('catch (err) {\n      setStatus("failed");\n    }','catch (err) {}')]}),
 2: ("log-only catch (Checkout)", {"Checkout.tsx": [('setStatus("failed");','console.error(err);')]}),
 3: ("catch base ApiError in ProductList memo, siblings thrown", {"ProductList.tsx": [
     ('import { listProducts } from "./api";','import { listProducts } from "./api";\nimport { ApiError } from "./errors";'),
     ('createMemo(() => listProducts())','createMemo(async () => { try { return await listProducts(); } catch (e) { if (e instanceof ApiError) return []; throw e; } })')]}),
 4: ("selective instanceof WITH rethrow (RateLimited)", {"ProductList.tsx": [
     ('import { listProducts } from "./api";','import { listProducts } from "./api";\nimport { RateLimited } from "./errors";'),
     ('createMemo(() => listProducts())','createMemo(async () => { try { return await listProducts(); } catch (e) { if (e instanceof RateLimited) return []; throw e; } })')]}),
 5: ("selective instanceof WITHOUT rethrow", {"ProductList.tsx": [
     ('import { listProducts } from "./api";','import { listProducts } from "./api";\nimport { RateLimited } from "./errors";'),
     ('createMemo(() => listProducts())','createMemo(async () => { try { return await listProducts(); } catch (e) { if (e instanceof RateLimited) return []; } })')]}),
 6: ("async onClick that rejects", {"Clock.tsx": [
     ('<small>tick {t()}</small>','<small>tick {t()} <button onClick={async () => { await placeOrder([], "x@y"); await getProduct("zzz"); }}>go</button></small>'),
     ('import { createSignal, onCleanup } from "solid-js";','import { createSignal, onCleanup } from "solid-js";\nimport { placeOrder, getProduct } from "./api";')]}),
 7: (".then without .catch in handler", {"Checkout.tsx": [
     ('await placeOrder(items().map(i => i.id), email);','placeOrder(items().map(i => i.id), email).then(() => setStatus("ok"));')]}),
 8: ("throw a string (api)", {"api.ts": [('throw new RateLimited(30);','throw "slow down";')]}),
 9: ("throw inside setTimeout", {"Clock.tsx": [
     ('onCleanup(','setTimeout(() => { throw new Error("late"); }, 10);\n  onCleanup(')]}),
 10: ("server fn throws NEW class Banned (no client change)", {"api.ts": [
     ('import { NotFound, RateLimited } from "./errors";','import { NotFound, RateLimited, ApiError } from "./errors";\nexport class Banned extends ApiError {}'),
     ('if (!p) throw new NotFound(id);','if (id === "3") throw new Banned("banned");\n  if (!p) throw new NotFound(id);')]}),
 11: ("Promise.all with rejectable member", {"Details.tsx": [
     ('createMemo(() => getProduct(props.id))','createMemo(() => Promise.all([getProduct(props.id), getProduct("9")]))'),
     ('{prod().name}</h2><p>{prod().price}','{prod()[0].name}</h2><p>{prod()[1].price}')]}),
 12: ("try/finally with no catch", {"Checkout.tsx": [
     ('catch (err) {\n      setStatus("failed");\n    }','finally {\n      setStatus("done");\n    }')]}),
 13: ("await inside async memo of throwing fn", {"Details.tsx": [
     ('createMemo(() => getProduct(props.id))','createMemo(async () => { const x = await getProduct(props.id); return x; })')]}),
 14: ("context read without provider", {"index.tsx": [('<CartCtx value={cart}>','<>'),('</CartCtx>','</>')]}),
 15: ("remove Errored", {"index.tsx": [
     ('<Errored fallback={(e: unknown) => <p>failed {`${e}`}</p>}>',''),('</Errored>','')]}),
}
def run(cmd):
    r=subprocess.run(cmd,cwd=APP,capture_output=True,text=True,shell=True); return (r.stdout+r.stderr)
def restore():
    for f in os.listdir(BASE): shutil.copy(f"{BASE}/{f}", f"{APP}/src/{f}")
for n in map(int, sys.argv[1:]):
    title, edits = M[n]; restore()
    for f, reps in edits.items():
        p=f"{APP}/src/{f}"; s=open(p).read()
        for a,b in reps:
            assert a in s, (n,f,a); s=s.replace(a,b,1)
        open(p,"w").write(s)
    print(f"##### {n}: {title}")
    out=run("pnpm exec solid-yield check . 2>&1 | cut -c1-420 | grep -v '^  '")
    print(out.replace("/private/tmp/sy-review3-out/app/src/",""))
    print(run("node ../ts.cjs hover ProductList.tsx:ProductList Details.tsx:Details Checkout.tsx:Checkout Clock.tsx:Clock index.tsx:App 2>&1 | cut -c1-260"))
restore()
