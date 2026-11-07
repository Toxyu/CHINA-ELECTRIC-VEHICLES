import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return { supabase, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { supabase, user, response: null };
}

export async function GET() {
  const { supabase, response } = await adminClient();
  if (response) return response;
  const { data, error } = await supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load customers." }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] });
}
