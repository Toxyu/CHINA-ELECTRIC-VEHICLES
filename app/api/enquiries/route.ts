import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["name", "email", "country", "vehicle"];
    if (required.some((key) => typeof body[key] !== "string" || !body[key].trim())) return NextResponse.json({ error: "Please complete the required fields." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("enquiries").insert({ name: body.name.trim(), email: body.email.trim().toLowerCase(), country: body.country.trim(), vehicle: body.vehicle.trim(), budget: body.budget?.trim() || null, notes: body.notes?.trim() || null }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, enquiry: data, message: "Thank you! Sent to chinaevp.org@gmail.com. We will reply in 24h." }, { status: 201 });
  } catch { return NextResponse.json({ error: "Your enquiry could not be saved." }, { status: 500 }); }
}

export async function GET() {
  try { const { data, error } = await supabaseAdmin.from("enquiries").select("*").order("created_at", { ascending: false }); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ enquiries: data ?? [] }); }
  catch { return NextResponse.json({ error: "Unable to load enquiries." }, { status: 500 }); }
}
