import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const make = searchParams.get("make")?.trim();
    const availability = searchParams.get("availability")?.trim();
    const maxPrice = Number(searchParams.get("maxPrice"));
    let builder = getSupabaseAdmin().from("cars").select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (make) builder = builder.ilike("make", make);
    if (availability) builder = builder.eq("availability", availability);
    if (Number.isFinite(maxPrice) && maxPrice > 0) builder = builder.lte("price_kes", maxPrice);
    if (query) builder = builder.or(`make.ilike.%${query}%,model.ilike.%${query}%`);
    const { data, error } = await builder;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vehicles: data ?? [], total: data?.length ?? 0 });
  } catch { return NextResponse.json({ error: "Unable to load vehicles." }, { status: 500 }); }
}
