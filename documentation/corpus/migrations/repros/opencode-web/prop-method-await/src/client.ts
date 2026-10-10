export interface Client {
  session: { create(opts: { body: object }): Promise<{ data?: { id: string } }> };
}
