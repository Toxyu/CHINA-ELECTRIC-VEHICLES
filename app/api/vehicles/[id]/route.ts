import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: vehicle, error } = await supabase.from("cars").select("*").eq("id", id).eq("is_active", true).single();
  if (error || !vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  const { data: similar } = await supabase.from("cars").select("*").eq("is_active", true).neq("id", id).limit(3);
  return NextResponse.json({ vehicle, similar: similar ?? [] });
}
