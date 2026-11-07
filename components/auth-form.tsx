"use client";

import { FormEvent, useState } from "react";
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
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    if (mode === "admin") {
      const config = getSupabaseBrowserConfig();
      try {
        if (!config.hasUrl || !config.hasAnonKey || !config.validUrl) {
          console.error("[v0] Supabase browser configuration failure");
          throw new Error("Wrong email or password. Try again.");
        }

        const supabase = createClient();
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
          throw new Error("Wrong email or password. Try again.");
        }

        const response = await fetch("/api/auth/admin-session", { cache: "no-store" });
        const data = await response.json() as { error?: string };
        if (!response.ok) {
          console.error("[v0] staff profile authorization failed", { status: response.status, error: data.error });
          await supabase.auth.signOut();
          throw new Error("Wrong email or password. Try again.");
        }

        window.location.href = "/admin";
      } catch (error) {
        const isNetworkFailure = error instanceof TypeError;
        const detail = isNetworkFailure
          ? `The browser could not reach Supabase: ${error instanceof Error ? error.message : "Unknown network error"}. This may be DNS, CORS, CSP, an unavailable project, or a blocked network request; the browser did not expose an HTTP status.`
          : error instanceof Error ? error.message : "Staff sign in failed.";
        console.error("[v0] staff login request failed", { error, isNetworkFailure, url: config.url, method: "POST" });
        setMessage(mode === "admin" ? "Wrong email or password. Try again." : detail);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "register") {
      if (values.password.length < 12) {
        setMessage("Password must be at least 12 characters.");
        setBusy(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: values.name, phone: values.phone } },
        });

        if (data.user && data.user.identities?.length === 0) {
          setMessage("This email already has an account. Please Sign in.");
          setBusy(false);
          return;
        }

        if (error) {
          const normalized = error.message.toLowerCase();
          const message = normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("user already")
            ? "This email already has an account. Please Sign in."
            : normalized.includes("password") && (normalized.includes("weak") || normalized.includes("12") || normalized.includes("minimum"))
              ? "Password must be at least 12 characters."
              : "Could not create account. Please try again.";
          setMessage(message);
          setBusy(false);
          return;
        }

        setMessage("Account created. Please check your email to confirm.");
        setVerificationUrl("");
      } catch {
        setMessage("Could not create account. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const endpoint = mode === "forgot" ? "/api/auth/forgot-password"
      : mode === "reset" ? "/api/auth/reset-password"
        : mode === "verify" ? "/api/auth/verify"
          : "/api/auth/login";
    const payload = mode === "forgot" ? { email: values.email }
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
        const friendlyError = rawError;
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
    {mode !== "admin" && <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon">E.V</span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/" className="back-link">Back to home</Link></header>}
    <section className="auth-card"><div className="section-kicker">E.V CHINA GLOBAL {mode === "admin" ? "ADMINISTRATION" : "CUSTOMER PORTAL"}</div><h1>{title}</h1>
      <form onSubmit={(event) => void submit(event)}>
        {mode === "register" && <label>Full name<input required autoComplete="name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })}/></label>}
        {(mode === "login" || mode === "register" || mode === "forgot" || mode === "admin") && <label>Email address<input required type="email" autoComplete="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })}/></label>}
        {mode === "register" && <label>Phone (optional)<input autoComplete="tel" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })}/></label>}
        {(mode === "login" || mode === "register" || mode === "reset" || mode === "admin") && <label>{mode === "reset" ? "New password" : "Password"}<input required type="password" autoComplete={mode === "register" || mode === "reset" ? "new-password" : "current-password"} minLength={mode === "register" || mode === "reset" ? 12 : 1} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })}/>{(mode === "register" || mode === "reset") && <small>Use at least 12 characters.</small>}</label>}
        <button className="button button-dark form-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "verify" ? "Verify email address" : title}</button>
      </form>
      {message && <p className="auth-message" role="status">{message}</p>}

      {verificationUrl && <a className="auth-action-link" href={verificationUrl}>{mode === "register" ? "Open verification link (development only)" : "Open password reset link (development only)"}</a>}
      <div className="auth-links">
        {mode === "login" && <><Link href="/register">Create account</Link><Link href="/forgot-password">Forgot password?</Link><Link href="/admin/login">Staff sign in</Link></>}
        {mode === "register" && <Link href="/login">Already have an account? Sign in</Link>}
        {(mode === "forgot" || mode === "reset" || mode === "verify") && <Link href="/login">Return to sign in</Link>}
      </div>
    </section>
  </main>;
}
