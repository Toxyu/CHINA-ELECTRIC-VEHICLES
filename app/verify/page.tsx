"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth-form";

function VerifyForm() {
  const token = useSearchParams().get("token") || "";
  return <AuthForm mode="verify" token={token}/>;
}

export default function VerifyPage() {
  return <Suspense fallback={<main className="auth-page">Loading verification…</main>}><VerifyForm/></Suspense>;
}
