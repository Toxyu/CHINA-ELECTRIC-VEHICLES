"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Zap } from "lucide-react";

type QuoteRecord = {
  id: string;
  number: string;
  status: string;
  destination: string;
  destinationPort: string | null;
  currency: string;
  total: string;
  validUntil: string | null;
  vehicleSnapshot: { manufacturer?: string; model?: string; year?: number; stockReference?: string };
  invoice: { id: string; number: string; status: string } | null;
};

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/quotes");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in to view quotations.");
      setQuotes(data.quotes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Quotations could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/quotes").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in to view quotations.");
      if (active) setQuotes(data.quotes);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Quotations could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function approve(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/quotes/${id}/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Quotation could not be approved.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Quotation could not be approved."); }
  }

  return <main className="catalog-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon"><Zap/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/inventory" className="back-link"><ArrowLeft size={16}/> Marketplace</Link></header>
    <section className="catalog-hero"><div className="section-kicker">CUSTOMER PORTAL</div><h1>Your vehicle<br/><em>quotations.</em></h1><p>Review and approve staff-issued quotations based on verified listing snapshots. Your order is created only after you approve a valid offer.</p></section>
    <section className="catalog-body">
      {error && <div className="catalog-warning" role="alert">{error}<p><Link href="/login">Sign in to your account</Link></p></div>}
      {loading && <p>Loading quotations…</p>}
      {!loading && !error && !quotes.length && <div className="catalog-warning"><b>No quotations yet</b><p>Start by requesting a verified quote for a listed vehicle. Our staff will review availability and prepare an itemised offer.</p><Link className="button button-dark" href="/inventory">Browse verified inventory</Link></div>}
      <div className="quote-list">{quotes.map((quote) => <article className="quote-card" key={quote.id}>
        <div className="quote-card-head"><div><span className="section-kicker">{quote.number}</span><h2>{quote.vehicleSnapshot.manufacturer} {quote.vehicleSnapshot.model} {quote.vehicleSnapshot.year || ""}</h2><p>{quote.destination}{quote.destinationPort ? ` · ${quote.destinationPort}` : ""} · Stock {quote.vehicleSnapshot.stockReference}</p></div><span className={`status-pill status-${quote.status.toLowerCase()}`}>{quote.status}</span></div>
        <div className="quote-card-foot"><strong>{new Intl.NumberFormat(undefined, { style: "currency", currency: quote.currency }).format(Number(quote.total))}</strong><span>Valid until {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "not specified"}</span>
          {quote.invoice && <a className="button button-lime" href={`/api/invoices/${quote.invoice.id}/pdf`}><Download size={16}/> Download PDF</a>}
          {quote.status === "SENT" && <button className="button button-dark" onClick={() => void approve(quote.id)}>Approve quotation and create order</button>}
        </div>
        {quote.invoice && <p className="form-hint"><FileText size={14}/> Pro forma invoice {quote.invoice.number}; not a tax invoice or payment confirmation.</p>}
      </article>)}</div>
    </section>
  </main>;
}
