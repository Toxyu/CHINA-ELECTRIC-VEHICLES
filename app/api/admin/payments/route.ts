import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("enquiries").select("id, name, email, message, status, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load records." }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}
