"use client";

import { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, LogOut, Zap } from "lucide-react";

type AccountData = {
  user: { id: string; name: string; email: string; role: string; phone: string };
  enquiries: { id: string; vehicleBrief: string; country: string; status: string; createdAt: string }[];
  quotes: { id: string; number: string; status: string; destination: string; currency: string; total: string; invoice: { id: string; number: string } | null; vehicleSnapshot: { manufacturer?: string; model?: string; year?: number } }[];
  orders: { id: string; number: string; status: string; destination: string; shipment: { status: string; destinationPort: string | null; estimatedArrival: string | null; updates: { message: string; occurredAt: string }[] } | null }[];
  savedVehicles: { vehicle: { id: string; model: string; year: number; manufacturer: { name: string } } }[];
  notifications: { id: string; title: string; message: string; createdAt: string; readAt: string | null }[];
};

export default function AccountPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  useEffect(() => {
    fetch("/api/account").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign in to view your account.");
      setData(result);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Account data could not be loaded."));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("name"), phone: formData.get("phone") }),
    });
    const result = await response.json();
    if (!response.ok) setProfileStatus(result.error || "Profile could not be updated.");
    else {
      setData((current) => current ? { ...current, user: { ...current.user, name: result.user.name, phone: result.user.phone || "" } } : current);
      setProfileStatus("Profile updated.");
    }
  }

  return <main className="catalog-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon"><Zap/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><button className="back-link logout-button" onClick={() => void logout()}><LogOut size={15}/> Sign out</button></header>
    {error ? <section className="auth-card"><div className="section-kicker">CUSTOMER PORTAL</div><h1>Account access</h1><p>{error}</p><Link className="button button-dark" href="/login">Sign in</Link><p><Link href="/register">Create an account</Link></p></section> : !data ? <section className="catalog-body">Loading account…</section> : <section className="account-page">
      <div className="account-heading"><div><div className="section-kicker">CUSTOMER PORTAL</div><h1>Hello, <em>{data.user.name}</em></h1><p>{data.user.email}</p></div><Link className="button button-lime" href="/inventory">Browse vehicles</Link></div>
      <h2>Enquiry history</h2>{data.enquiries.length ? <div className="account-grid">{data.enquiries.map((item) => <article className="account-card" key={item.id}><b>{item.vehicleBrief}</b><p>{item.country} · {item.status}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></article>)}</div> : <p className="muted">No enquiries yet.</p>}
      <h2>Quotations</h2>{data.quotes.length ? <div className="quote-list">{data.quotes.map((quote) => <article className="quote-card" key={quote.id}><div className="quote-card-head"><div><span className="section-kicker">{quote.number}</span><h2>{quote.vehicleSnapshot.manufacturer} {quote.vehicleSnapshot.model} {quote.vehicleSnapshot.year}</h2><p>{quote.destination} · {quote.status}</p></div></div><div className="quote-card-foot"><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: quote.currency }).format(Number(quote.total))}</strong>{quote.invoice && <a className="button button-lime" href={`/api/invoices/${quote.invoice.id}/pdf`}><Download size={15}/> {quote.invoice.number} PDF</a>}</div></article>)}</div> : <p className="muted">No quotations received.</p>}
      <h2>Orders and shipping</h2>{data.orders.length ? <div className="account-grid">{data.orders.map((order) => <article className="account-card" key={order.id}><b>{order.number}</b><p>{order.status.replaceAll("_", " ")} · {order.destination}</p>{order.shipment && <><p>Shipment: {order.shipment.status.replaceAll("_", " ")}{order.shipment.destinationPort ? ` · ${order.shipment.destinationPort}` : ""}</p>{order.shipment.estimatedArrival && <small>Estimated arrival: {new Date(order.shipment.estimatedArrival).toLocaleDateString()}</small>}{order.shipment.updates.map((update) => <small className="shipment-update" key={`${update.occurredAt}:${update.message}`}>{new Date(update.occurredAt).toLocaleDateString()}: {update.message}</small>)}</>}</article>)}</div> : <p className="muted">No orders or shipments yet. Live tracking is shown only when your logistics team records updates.</p>}
      <h2>Notifications</h2>{data.notifications.length ? <div className="account-grid">{data.notifications.map((notification) => <article className={`account-card ${notification.readAt ? "" : "notification-unread"}`} key={notification.id}><b>{notification.title}</b><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString()}</small>{!notification.readAt && <button className="notification-read" onClick={async () => { const response = await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" }); if (response.ok) setData((current) => current ? { ...current, notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item) } : current); }}>Mark as read</button>}</article>)}</div> : <p className="muted">No account notifications.</p>}
      <h2>Saved vehicles</h2>{data.savedVehicles.length ? <div className="account-grid">{data.savedVehicles.map(({ vehicle }) => <Link className="account-card" key={vehicle.id} href={`/inventory/${vehicle.id}`}><b>{vehicle.manufacturer.name} {vehicle.model} {vehicle.year}</b><span>View listing ↗</span></Link>)}</div> : <p className="muted">Save a listed vehicle to keep it here.</p>}
      <h2>Account settings</h2><form className="enquiry-form profile-form" onSubmit={(event) => void saveProfile(event)}><label>Name<input name="name" required maxLength={120} defaultValue={data.user.name}/></label><label>Email<input value={data.user.email} readOnly/></label><label>Phone<input name="phone" maxLength={40} defaultValue={data.user.phone}/></label><button className="button button-dark">Save account settings</button><small className="form-hint" role="status">{profileStatus}</small></form>
    </section>}
  </main>;
}
