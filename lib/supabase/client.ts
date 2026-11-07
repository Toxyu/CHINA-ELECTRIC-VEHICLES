import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anonKey,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    validUrl: Boolean(url && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)),
  };
}

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserConfig();
  if (!url || !anonKey) {
    throw new Error("Supabase browser configuration is missing at build time.");
  }

  return createBrowserClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
