"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth-form";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  return <AuthForm mode="reset" token={token}/>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="auth-page">Loading reset form…</main>}><ResetPasswordForm/></Suspense>;
}
