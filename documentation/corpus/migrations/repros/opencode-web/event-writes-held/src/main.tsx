import { createSignal } from "solid-js";
import { render } from "@solidjs/web";

const wait = (ms: number) => new Promise<string>((r) => setTimeout(() => r("ok"), ms));

// opencode-web MessageInput.handleSend shape: set a "sending" flag and clear the draft,
// await the request, then reset. The guard relies on the flag.
function Composer() {
  const [draft, setDraft] = createSignal("hello");
  const [sending, setSending] = createSignal(false);
  const [sent, setSent] = createSignal(0);
  const send = async () => {
    if (sending() || !draft()) return;
    setSending(true);
    setDraft("");
    try {
      await wait(500);
      setSent((n) => n + 1);
    } catch {
      setDraft("hello");
    } finally {
      setSending(false);
    }
  };
  return (
    <div>
      <input id="draft" value={draft()} onInput={(e) => setDraft(e.currentTarget.value)} disabled={sending()} />
      <button id="send" onClick={send}>{sending() ? "sending" : "send"}</button>
      <span id="sent">{sent()}</span>
    </div>
  );
}

render(() => <Composer />, document.getElementById("root")!);
