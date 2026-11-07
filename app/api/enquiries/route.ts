import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isSupabaseConfigured, supabaseRequest } from "@/lib/supabase-admin"

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

async function notifyByEmail(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev", to: ["chinaevp.org@gmail.com"], subject, html }) })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 240) : ""
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 5000) : ""
    const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 240) : "Vehicle sourcing enquiry"
    if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Please provide a name, valid email, and message." }, 400)

    if (isSupabaseConfigured()) {
      await supabaseRequest("enquiries", { method: "POST", body: JSON.stringify({ name, email, subject, message, status: "NEW" }) })
    } else {
      await prisma.enquiry.create({ data: { name, email, country: "Unknown", vehicleBrief: subject, notes: message } })
    }

    try { await notifyByEmail(subject, `<p><strong>${name}</strong> (${email})</p><p>${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`) } catch { /* email is optional; persistence already succeeded */ }
    return json({ ok: true, message: "Thanks — your message has been received." }, 201)
  } catch {
    return json({ error: "We could not save your message right now. Please try again." }, 500)
  }
}
