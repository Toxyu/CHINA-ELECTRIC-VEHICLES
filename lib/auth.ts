import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() { const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) return null; return { id: data.user.id, email: data.user.email ?? "", name: data.user.user_metadata?.name ?? data.user.email ?? "", role: data.user.user_metadata?.role ?? "CUSTOMER" } as any; }
export function hasRole(role: string, allowed: string[]) { return allowed.includes(role); }
export function isAdmin(role?: string) { return role === "ADMIN" || role === "SUPER_ADMIN"; }
export function isStaff(role?: string) { return isAdmin(role) || role === "STAFF"; }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function createSession(_userId: string) { return true; }
export async function destroySession() { const supabase = await createClient(); await supabase.auth.signOut(); }
