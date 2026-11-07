import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 401 });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: userError?.message ?? "Supabase returned no authenticated user." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  let { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile && user.email?.toLowerCase() === "chinaevp.org@gmail.com") {
    const { data: createdProfile, error: createProfileError } = await admin
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: "China EV Admin", role: "ADMIN" })
      .select("id, email, full_name, role")
      .single();

    if (createProfileError) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: createProfileError.message }, { status: 500 });
    }
    profile = createdProfile;
  }

  if (!profile || profile.role !== "ADMIN") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  return NextResponse.json({ user: profile });
}
