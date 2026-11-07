import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  let tables = false;
  try { const { error } = await getSupabaseAdmin().from("cars").select("id").limit(1); tables = !error; } catch {}
  return NextResponse.json({ supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), groq: Boolean(process.env.GROQ_API_KEY), tables });
}
