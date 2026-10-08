class ServerProblem extends Error {}
export async function readServer() {
  'use server';
  await Promise.resolve();
  if (false) throw new ServerProblem('server');
  return 1;
}
