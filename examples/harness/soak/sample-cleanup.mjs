// The schedule never travels back across rounds. Keep the current jsdom history
// entry (including its URL and state), but release entries from earlier rounds.
// This is a jsdom-only harness control; the app's navigation still runs normally.
export function trimNavigationHistory(window) {
  const history = window._sessionHistory;
  if (!history || !Array.isArray(history._entries))
    throw new Error("Unsupported jsdom session history layout");
  const current = history._entries[history._currentIndex];
  history._entries.splice(0, history._entries.length, current);
  history._currentIndex = 0;
}

export function cleanupSample(window, mocks, env = {}) {
  if (env.SOAK_CLEAR_MOCKS !== "0") mocks.clearAllMocks();
  if (env.SOAK_KEEP_HISTORY !== "1") trimNavigationHistory(window);
}
