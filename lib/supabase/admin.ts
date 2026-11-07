import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | undefined;
export function getSupabaseAdmin() {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server environment is not configured.");
    admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return admin;
}
