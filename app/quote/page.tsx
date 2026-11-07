import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

export default function QuotationsPage() {
  return <main className="catalog-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon"><Zap/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/inventory" className="back-link"><ArrowLeft size={16}/> Marketplace</Link></header>
    <section className="catalog-hero"><div className="section-kicker">CUSTOMER PORTAL</div><h1>Your vehicle<br/><em>quotations.</em></h1><p>Review and approve staff-issued quotations based on verified listing snapshots. Your order is created only after you approve a valid offer.</p></section>
    <section className="catalog-body">
      <div className="catalog-warning"><b>No quotations yet</b><p>Sign in to view quotations issued for your account. Your quotations will appear here after staff prepares a verified offer.</p><Link className="button button-dark" href="/admin/login">Sign in to view quotations</Link></div>
    </section>
  </main>;
}
