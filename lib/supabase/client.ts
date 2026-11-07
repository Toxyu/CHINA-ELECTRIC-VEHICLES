import { createBrowserClient } from "@supabase/ssr";

const EXPECTED_SUPABASE_HOST = "qysjnsgrcgxpansqxsrr.supabase.co";
type BrowserClient = ReturnType<typeof createBrowserClient>;
let browserClient: BrowserClient | null = null;

export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let hostname = "";

  try {
    hostname = url ? new URL(url).hostname : "";
  } catch {
    hostname = "";
  }

  return {
    url,
    anonKey,
    hostname,
    expectedHostname: EXPECTED_SUPABASE_HOST,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    validUrl: Boolean(url && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)),
    hostnameMatchesExpected: hostname === EXPECTED_SUPABASE_HOST,
  };
}

export function createClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseBrowserConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase browser configuration is missing at build time.");
  }

  browserClient = createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
