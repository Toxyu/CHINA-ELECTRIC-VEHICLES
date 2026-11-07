import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("email, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: profile?.email ?? user.email ?? "",
      name: profile?.full_name ?? user.user_metadata?.name ?? user.email ?? "",
      role: profile?.role ?? "CUSTOMER",
    };
  } catch (error) {
    console.error("[v0] admin session check unavailable", error);
    return null;
  }
}

export function hasRole(role: string, allowed: string[]) { return allowed.includes(role); }
export function isAdmin(role?: string) { return role === "ADMIN" || role === "SUPER_ADMIN"; }
export function isStaff(role?: string) { return isAdmin(role) || role === "STAFF"; }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function createSession(_userId: string) { return true; }
export async function destroySession() { const supabase = await createClient(); await supabase.auth.signOut(); }
