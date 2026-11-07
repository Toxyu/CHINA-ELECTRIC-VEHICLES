import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  return NextResponse.json({ user: profile });
}
