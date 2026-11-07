import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[v0] admin session user lookup failed", userError?.message ?? "No authenticated user");
    return NextResponse.json({ error: userError?.message ?? "No authenticated user." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  let { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[v0] admin profile lookup failed", profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile && user.email?.toLowerCase() === "chinaevp.org@gmail.com") {
    const { data: createdProfile, error: createError } = await admin
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: "China EV Admin", role: "ADMIN" })
      .select("id, email, full_name, role")
      .single();

    if (createError) {
      console.error("[v0] admin profile creation failed", createError.message);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    profile = createdProfile;
  }

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  return NextResponse.json({ user: profile });
}
