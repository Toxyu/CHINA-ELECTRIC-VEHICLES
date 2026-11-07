"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (signInError) {
          console.error("[v0] staff Supabase sign-in failed", signInError.message);
          throw new Error(signInError.message);
        }

        const response = await fetch("/api/auth/admin-session", { cache: "no-store" });
        const data = await response.json() as { error?: string };
        if (!response.ok) {
          console.error("[v0] staff profile authorization failed", data.error);
          await supabase.auth.signOut();
          throw new Error(data.error || "Administrator access required.");
        }

        router.push("/admin/dashboard");
      } catch (error) {
        console.error("[v0] staff login request failed", error);
        setMessage(error instanceof Error ? error.message : "Staff sign in failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const endpoint = mode === "register" ? "/api/auth/register"
      : mode === "forgot" ? "/api/auth/forgot-password"
        : mode === "reset" ? "/api/auth/reset-password"
          : mode === "verify" ? "/api/auth/verify"
            : mode === "admin" ? "/api/auth/admin-login" : "/api/auth/login";
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
      if (mode === "admin") router.push("/admin/dashboard");
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
