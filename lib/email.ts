export async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info("Email delivery is disabled; set RESEND_API_KEY to send transactional emails.");
      return false;
    }
    throw new Error("Email delivery is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error("Email provider returned", response.status);
    throw new Error("Transactional email could not be sent.");
  }
  return true;
}
