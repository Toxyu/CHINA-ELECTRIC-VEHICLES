import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const expectedHost = "qysjnsgrcgxpansqxsrr.supabase.co";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isDevelopment = process.env.NODE_ENV !== "production";
  let isAdmin = false;

  if (!isDevelopment) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await getSupabaseAdmin().from("profiles").select("role").eq("id", user.id).maybeSingle();
        isAdmin = profile?.role === "ADMIN";
      }
    } catch (error) {
      console.error("[v0] debug authorization failed", error);
    }
  }

  if (!isDevelopment && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = url ? new URL(url) : null;
  } catch {
    parsedUrl = null;
  }

  let authReachability: { reachable: boolean; status?: number; error?: string } = { reachable: false };
  if (parsedUrl) {
    try {
      const response = await fetch(`${parsedUrl.origin}/auth/v1/health`, { method: "GET", cache: "no-store" });
      authReachability = { reachable: true, status: response.status };
    } catch (error) {
      authReachability = { reachable: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return NextResponse.json({
    environment: { nodeEnv: process.env.NODE_ENV, serverRuntime: true },
    configuration: {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceKey),
      urlValid: Boolean(parsedUrl && parsedUrl.protocol === "https:"),
      projectHostname: parsedUrl?.hostname ?? null,
      hostnameMatchesExpected: parsedUrl?.hostname === expectedHost,
      expectedHost,
    },
    authEndpoint: authReachability,
  });
}
