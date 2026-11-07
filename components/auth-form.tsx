"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, getSupabaseBrowserConfig } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "forgot" | "reset" | "verify" | "admin";

export function AuthForm({ mode, token = "" }: { mode: AuthMode; token?: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", phone: "" });
  const [message, setMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ kind: string; detail: string } | null>(() => mode === "admin"
    ? { kind: "configuration", detail: "Checking browser configuration and Supabase Auth reachability…" }
    : null);

  useEffect(() => {
    if (mode !== "admin") return;
    const config = getSupabaseBrowserConfig();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    async function checkAuthEndpoint() {
      if (!config.hasUrl || !config.validUrl) {
        setDiagnostic({ kind: "configuration", detail: `URL present: ${config.hasUrl}; anon key present: ${config.hasAnonKey}; valid HTTPS URL: ${config.validUrl}; expected host: ${config.expectedHostname}; configured host: ${config.hostname || "missing"}.` });
        return;
      }

      try {
        const response = await fetch(`${config.url?.replace(/\/$/, "")}/auth/v1/health`, { signal: controller.signal, cache: "no-store" });
        setDiagnostic({ kind: "reachability", detail: `Auth endpoint responded with HTTP ${response.status}. URL present: ${config.hasUrl}; anon key present: ${config.hasAnonKey}; hostname matches: ${config.hostnameMatchesExpected}.` });
      } catch (error) {
        const detail = error instanceof DOMException && error.name === "AbortError"
          ? "Auth endpoint check timed out after 6 seconds."
          : `Auth endpoint is unreachable: ${error instanceof Error ? error.message : String(error)}`;
        console.error("[v0] Supabase Auth reachability check failed", { url: config.url, error });
        setDiagnostic({ kind: "network", detail: `${detail} URL present: ${config.hasUrl}; anon key present: ${config.hasAnonKey}; hostname matches: ${config.hostnameMatchesExpected}.` });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void checkAuthEndpoint();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    if (mode === "admin") {
      const config = getSupabaseBrowserConfig();
      try {
        if (!config.hasUrl || !config.hasAnonKey || !config.validUrl) {
          const detail = `Browser Supabase configuration is invalid. URL present: ${config.hasUrl}; anon key present: ${config.hasAnonKey}; valid HTTPS URL: ${config.validUrl}.`;
          console.error("[v0] Supabase browser configuration failure", { ...config, anonKey: undefined });
          setDiagnostic({ kind: "configuration", detail });
          throw new Error(detail);
        }

        const supabase = createClient();
        console.info("[v0] Supabase sign-in starting", {
          url: config.url,
          method: "POST",
          endpoint: `${config.url?.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
        });
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (signInError) {
          console.error("[v0] Supabase sign-in failed", {
            name: signInError.name,
            message: signInError.message,
            status: signInError.status,
            code: signInError.code,
          });
          setDiagnostic({ kind: "supabase", detail: `${signInError.name}: ${signInError.message}${signInError.status ? ` (HTTP ${signInError.status})` : ""}` });
          throw new Error(signInError.message);
        }

        const response = await fetch("/api/auth/admin-session", { cache: "no-store" });
        const data = await response.json() as { error?: string };
        if (!response.ok) {
          console.error("[v0] staff profile authorization failed", { status: response.status, error: data.error });
          await supabase.auth.signOut();
          setDiagnostic({ kind: "authorization", detail: `Admin profile check failed (HTTP ${response.status}): ${data.error || "Unknown error"}` });
          throw new Error(data.error || "Administrator access required.");
        }

        router.push("/admin/dashboard");
      } catch (error) {
        const isNetworkFailure = error instanceof TypeError;
        const detail = isNetworkFailure
          ? "The browser could not reach Supabase. This may be DNS, CORS, CSP, an unavailable project, or a blocked network request; the browser did not expose an HTTP status."
          : error instanceof Error ? error.message : "Staff sign in failed.";
        console.error("[v0] staff login request failed", { error, isNetworkFailure, url: config.url, method: "POST" });
        setDiagnostic((current) => current ?? { kind: isNetworkFailure ? "network" : "unexpected", detail });
        setMessage(detail);
      } finally {
        setBusy(false);
      }
      return;
    }

    const endpoint = mode === "register" ? "/api/auth/register"
      : mode === "forgot" ? "/api/auth/forgot-password"
        : mode === "reset" ? "/api/auth/reset-password"
          : mode === "verify" ? "/api/auth/verify"
            : "/api/auth/login";
    const payload = mode === "register" ? values
      : mode === "forgot" ? { email: values.email }
        : mode === "reset" ? { token, password: values.password }
          : mode === "verify" ? { token }
            : { email: values.email, password: values.password };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const text = await response.text();
      let data: { error?: string; message?: string; verificationUrl?: string; resetUrl?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: "The server returned an invalid response. Please try again." };
        }
      }
      if (!response.ok) {
        const rawError = data.error || "Request could not be completed.";
        const friendlyError = mode === "register" && /already registered|already exists|already have an account/i.test(rawError)
          ? "This email already has an account. Please use the Sign in link below."
          : rawError;
        console.error("SIGNUP_ERROR", rawError);
        throw new Error(friendlyError);
      }
      setMessage(data.message || "Signed in successfully.");
      setVerificationUrl(data.verificationUrl || data.resetUrl || "");
      if (mode === "login") router.push("/account");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "register" ? "Create your account"
    : mode === "forgot" ? "Reset your password"
      : mode === "reset" ? "Choose a new password"
        : mode === "verify" ? "Verify your email"
          : mode === "admin" ? "Staff sign in" : "Welcome back";

  return <main className="auth-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon">E.V</span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/" className="back-link">Back to home</Link></header>
    <section className="auth-card"><div className="section-kicker">E.V CHINA GLOBAL {mode === "admin" ? "ADMINISTRATION" : "CUSTOMER PORTAL"}</div><h1>{title}</h1>
      <form onSubmit={(event) => void submit(event)}>
        {mode === "register" && <label>Full name<input required autoComplete="name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })}/></label>}
        {(mode === "login" || mode === "register" || mode === "forgot" || mode === "admin") && <label>Email address<input required type="email" autoComplete="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })}/></label>}
        {mode === "register" && <label>Phone (optional)<input autoComplete="tel" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })}/></label>}
        {(mode === "login" || mode === "register" || mode === "reset" || mode === "admin") && <label>{mode === "reset" ? "New password" : "Password"}<input required type="password" autoComplete={mode === "register" || mode === "reset" ? "new-password" : "current-password"} minLength={mode === "register" || mode === "reset" ? 12 : 1} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })}/>{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}</label>}
        <button className="button button-dark form-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "verify" ? "Verify email address" : title}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}
      {mode === "admin" && diagnostic && <aside className="auth-diagnostic" role="alert">
        <strong>Sign-in diagnostics: {diagnostic.kind}</strong>
        <p>{diagnostic.detail}</p>
        <small>Public configuration: {getSupabaseBrowserConfig().hasUrl ? "URL present" : "URL missing"}; {getSupabaseBrowserConfig().hasAnonKey ? "anon key present" : "anon key missing"}; hostname {getSupabaseBrowserConfig().hostnameMatchesExpected ? "matches expected project" : "does not match expected project"}.</small>
      </aside>}
      {verificationUrl && <a className="auth-action-link" href={verificationUrl}>{mode === "register" ? "Open verification link (development only)" : "Open password reset link (development only)"}</a>}
      <div className="auth-links">
        {mode === "login" && <><Link href="/register">Create account</Link><Link href="/forgot-password">Forgot password?</Link><Link href="/admin/login">Staff sign in</Link></>}
        {mode === "admin" && <Link href="/admin/login">Admin sign in</Link>}
        {mode === "register" && <Link href="/login">Already have an account? Sign in</Link>}
        {(mode === "forgot" || mode === "reset" || mode === "verify") && <Link href="/login">Return to sign in</Link>}
      </div>
    </section>
  </main>;
}
