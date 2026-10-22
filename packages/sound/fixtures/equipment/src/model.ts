export type Status = "available" | "checked-out" | "maintenance";
export interface Equipment { readonly id: string; readonly name: string; readonly location: string; readonly status: Status; readonly notes: string }
export interface Draft { readonly name: string; readonly location: string; readonly notes: string }
export type Operation = "list" | "detail" | "create" | "update" | "status" | "delete";
export type Result = { readonly ok: true } | { readonly ok: false; readonly message: string };
export const statuses: readonly Status[] = ["available", "checked-out", "maintenance"];
export function isStatus(value: string): value is Status { return statuses.some(status => status === value); }
export function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
