import { NextResponse } from "next/server";
import { requireRole } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { response, user } = await requireRole(["SUPER_ADMIN", "ADMIN", "STAFF"]);
  if (response || !user) return response;
  const { id } = await context.params;
  let body: { status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (!body.status) return NextResponse.json({ error: "Order status is required." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("enquiries").update({ status: body.status }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: data });
}
