export interface Message { id: string; text: string }
export async function loadMessages(id: string): Promise<Message[]> {
  const res = await fetch(`/api/session/${id}/message`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
