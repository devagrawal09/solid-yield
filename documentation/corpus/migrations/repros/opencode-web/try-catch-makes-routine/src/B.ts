function safeUpper(s: string): string {
  try {
    return s.toUpperCase();
  } catch {
    return s;
  }
}
export const names = ["a", "b"].map(safeUpper);
