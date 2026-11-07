import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";

export function jsonError(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
export async function requireUser() { const user = await getCurrentUser(); if (!user) return { response: jsonError("Authentication required.", 401), user: null }; return { response: undefined, user }; }
export async function requireRole(roles: string[]) { const result = await requireUser(); if (result.response || !result.user) return result; if (!hasRole(result.user.role, roles as any)) return { response: jsonError("You do not have permission to perform this action.", 403), user: null }; return result; }
export async function checkRateLimit() { return true; }
export async function audit() { return undefined; }
export function getClientAddress(request: Request) { return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100); }
export function safeError(error: unknown) { console.error("Request failed", error); return jsonError("The request could not be completed.", 500); }
