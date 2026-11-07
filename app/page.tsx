 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BatteryCharging, CarFront, CheckCircle2, ChevronDown, Globe2, Menu, MessageCircle, PackageCheck, Search, ShieldCheck, Ship, Sparkles, X, Zap } from "lucide-react";

type FeaturedVehicle = {
  id: string;
  model: string;
  year: number;
  bodyType: string;
  rangeKm: number | null;
  manufacturer: { name: string };
  images: { url: string; alt: string }[];
};

const sourcingProcess = [
  ["01", "Tell us what you need", "Share your preferred make, model, budget, destination country and must-have features."],
  ["02", "Sourcing & quotation", "We help scope suitable options and work towards a transparent, itemised quotation."],
  ["03", "Verification", "Confirm vehicle identity, specification, condition, documentation and inspection arrangements before payment."],
  ["04", "Shipping coordination", "Coordinate agreed export and shipping steps with the relevant service providers."]
];

export default function Home() {
  const [vehicles, setVehicles] = useState<FeaturedVehicle[]>([]);
  const [enquiryStatus, setEnquiryStatus] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{role:"user"|"assistant"; content:string}[]>([
    { role: "assistant", content: "Hello! I’m the E.V CHINA sourcing assistant. Tell me your destination country, budget and the kind of electric vehicle you’re looking for." }
  ]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({name:"", email:"", country:"", vehicle:"", vehicleId:"", budget:"", notes:""});

  useEffect(() => {
    fetch("/api/vehicles?pageSize=3")
      .then(async (response) => {
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) throw new Error(data.error || "Inventory is unavailable.");
        return data as { vehicles: FeaturedVehicle[] };
      })
      .then((data) => setVehicles(data.vehicles ?? []))
      .catch(() => setVehicles([]));
  }, []);

  const configuredWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "";
  const whatsapp = /^\d{8,15}$/.test(configuredWhatsApp) ? configuredWhatsApp : "";
  const sendEnquiry = async () => {
    setEnquiryStatus("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicleBrief: form.vehicle, vehicleId: form.vehicleId || undefined, quantity: 1 }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || "Your enquiry could not be saved.");
      setEnquiryStatus("Enquiry received. Our team will verify availability and pricing before responding.");
      setForm({name:"",email:"",country:"",vehicle:"",vehicleId:"",budget:"",notes:""});
    } catch (error) {
      setEnquiryStatus(error instanceof Error ? error.message : "Your enquiry could not be saved.");
    }
  };

  async function askAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    const next = [...messages, {role:"user" as const, content:question}];
    setMessages(next); setQuestion(""); setBusy(true);
    try {
      const response = await fetch("/api/agent", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({messages:next.slice(-12)}) });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      setMessages([...next, {role:"assistant", content:data.reply || data.error || "I could not find a matching answer. Please share your destination, budget and preferred EV."}]);
    } catch {
      setMessages([...next, {role:"assistant", content:"I could not complete that request. Please use the sourcing form and our team will help you directly."}]);
    } finally { setBusy(false); }
  }

  return <main>
    <header className="nav">
      <Link className="brand" href="/"><span className="brand-icon"><Zap size={21}/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link>
      <nav className={menuOpen ? "nav-links open" : "nav-links"}>
        <Link href="/inventory" onClick={()=>setMenuOpen(false)}>Inventory</Link>
        <Link href="/quote" onClick={()=>setMenuOpen(false)}>Quotations</Link>
        <a href="#vehicles" onClick={()=>setMenuOpen(false)}>Explore vehicles</a>
        <a href="#process" onClick={()=>setMenuOpen(false)}>How it works</a>
        <a href="#about" onClick={()=>setMenuOpen(false)}>Why E.V China</a>
        <a href="#contact" onClick={()=>setMenuOpen(false)}>Contact</a>
      </nav>
      <div className="nav-actions"><button className="agent-nav" onClick={()=>setChatOpen(true)}><Sparkles size={16}/> Ask AI</button><Link className="nav-cta" href="/login">Sign in <ArrowUpRight size={16}/></Link></div>
      <button className="mobile-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen?<X/>:<Menu/>}</button>
    </header>

    <section className="hero">
      <div className="hero-bg"></div><div className="hero-shade"></div>
      <div className="hero-content">
        <div className="eyebrow"><span></span> CHINA TO THE WORLD</div>
        <h1>Find your next<br/><em>electric drive.</em></h1>
        <p className="hero-copy">Your connection to electric vehicles from China. Tell us what you’re looking for — we’ll help you navigate the sourcing journey.</p>
        <div className="hero-buttons"><Link href="/inventory" className="button button-lime">Explore inventory <ArrowRight size={18}/></Link><Link href="/quote" className="button button-glass">Build a quotation <ArrowUpRight size={17}/></Link></div>
        <div className="hero-proof"><div className="proof-icon"><Globe2 size={18}/></div><span><b>One sourcing journey.</b><br/>Your destination. Your requirements.</span></div>
      </div>
      <div className="hero-caption"><span>01 / GLOBAL EV SOURCING</span><span>POWERING THE NEXT JOURNEY ↗</span></div>
    </section>

    <section className="ticker"><span>EV SOURCING</span><i>✳</i><span>CHINA MARKET ACCESS</span><i>✳</i><span>GLOBAL ENQUIRIES</span><i>✳</i><span>ELECTRIC MOBILITY</span><i>✳</i><span>EV SOURCING</span></section>

    <section className="trade-promo"><div><span>GLOBAL TRADE DESK</span><h2>Better buying starts<br/>with a <em>clear quote.</em></h2><p>Explore verified vehicle listings and request an itemised pro forma quotation.</p></div><Link href="/inventory" className="button button-lime">Browse vehicle catalogue <ArrowUpRight size={17}/></Link><Link href="/quote" className="promo-secondary">View your quotations ↗</Link></section>

    <section className="intro section" id="about">
      <div className="section-kicker">01 — THE CONNECTION</div>
      <div className="intro-grid"><h2>China’s EV innovation.<br/><em>Your next destination.</em></h2><div><p className="lead">The electric vehicle market is moving fast. Finding the right vehicle, understanding its specification and navigating an international purchase can feel complicated.</p><p className="muted">E.V CHINA GLOBAL is being built to make that journey clearer — helping buyers define their requirements, explore suitable options and organise the next steps with confidence.</p><a className="text-link" href="#contact">Tell us what you need <ArrowUpRight size={17}/></a></div></div>
    </section>

    <section className="vehicles section" id="vehicles">
      <div className="section-top"><div><div className="section-kicker">02 — EXPLORE THE MARKET</div><h2>Find your kind<br/>of <em>electric.</em></h2></div><p className="muted section-aside">A few examples of popular Chinese EV categories and models to start your search. Availability, specifications and pricing must be confirmed for each enquiry.</p></div>
      {vehicles.length ? <div className="vehicle-grid">{vehicles.map((v,i)=><article className="vehicle-card" key={v.id}><Link href={`/inventory/${v.id}`}><div className="vehicle-image" style={{backgroundImage:v.images[0]?.url?`url(${v.images[0].url})`:undefined}}><span className="vehicle-tag">VERIFIED LISTING</span><span className="vehicle-num">0{i+1}</span></div><div className="vehicle-info"><div><h3>{v.manufacturer.name} {v.model}</h3><p>{v.year} · {v.bodyType}{v.rangeKm?` · ${v.rangeKm} km range`:""}</p></div><ArrowUpRight/></div></Link></article>)}</div> : <div className="catalog-warning"><b>No verified vehicles are listed yet</b><p>We will publish vehicles only after confirming supplier, specification, price and availability.</p><Link className="text-link" href="/inventory">View marketplace <ArrowUpRight size={16}/></Link></div>}
    </section>

    <section className="process section" id="process">
      <div className="section-kicker">03 — THE JOURNEY</div><div className="process-heading"><h2>From search<br/>to <em>your shore.</em></h2><p className="muted">A clear process starts with the right questions. Every order should be confirmed with written specifications, costs and terms before payment.</p></div>
      <div className="process-grid">{sourcingProcess.map(([n,t,d])=><div className="process-item" key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div><ArrowUpRight className="process-arrow"/></div>)}</div>
    </section>

    <section className="faq-section section">
      <div className="section-kicker">ANSWERS BEFORE YOU START</div><h2>Good questions.<br/><em>Clear next steps.</em></h2>
      <div className="faq-list">
        <details><summary>Are the vehicles on this website in stock?</summary><p>Only listings marked verified are published as available, and supplier availability is reconfirmed before a binding offer. If no verified listings appear, submit a sourcing enquiry.</p></details>
        <details><summary>Does the displayed price include import duty and tax?</summary><p>Listing prices are vehicle export prices. Freight, insurance, destination customs duty, taxes, clearance, registration and local delivery are separate unless included in a written quotation with source references.</p></details>
        <details><summary>Can every China-market EV be imported into the USA?</summary><p>No. Do not assume a vehicle is eligible for US road use. Confirm NHTSA/DOT, EPA, CBP, tariff classification, country of origin and current importer requirements with a qualified customs broker.</p></details>
        <details><summary>How do I pay for a vehicle?</summary><p>The site does not take payment or store card details. Verify the contracting entity, written terms and beneficiary account independently before making any external payment.</p></details>
        <details><summary>Is shipment tracking live?</summary><p>No live tracking is claimed. Shipment milestones and tracking references are displayed only when recorded by authorised logistics staff.</p></details>
      </div>
    </section>

    <section className="promise">
      <div className="promise-image"></div><div className="promise-content"><div className="section-kicker">04 — BUY WITH CLARITY</div><h2>Move forward<br/>with <em>confidence.</em></h2><div className="promise-list"><div><ShieldCheck/><span><b>Clarity before commitment</b><small>Request itemised costs and written terms before making a payment.</small></span></div><div><PackageCheck/><span><b>Details that matter</b><small>Check model year, battery, range, charging standard and vehicle documents.</small></span></div><div><Ship/><span><b>Plan the full journey</b><small>Understand export, freight, insurance, customs and local registration costs.</small></span></div></div><a href="#contact" className="button button-lime">Start your enquiry <ArrowRight size={18}/></a></div>
    </section>

    <section className="contact section" id="contact">
      <div className="section-kicker">05 — LET’S GET MOVING</div><div className="contact-grid"><div><h2>What are you<br/>looking <em>for?</em></h2><p className="muted">Share a few details. The more specific your requirements, the more useful the sourcing conversation can be.</p><div className="contact-note"><MessageCircle size={19}/><span>Prefer a conversation? Use WhatsApp to send your enquiry.</span></div></div>
        <form className="enquiry-form" onSubmit={e=>{e.preventDefault();void sendEnquiry();}}>
          <label>Your name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label>
          <label>Email address<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label>
          <div className="form-row"><label>Destination country<input required value={form.country} onChange={e=>setForm({...form,country:e.target.value})} placeholder="e.g. Kenya"/></label><label>Vehicle of interest<input required value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})} placeholder="Make / model / type"/></label></div>
          <label>Estimated budget<input value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} placeholder="Currency and amount"/></label>
          <label>What should we know?<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="New or used, preferred range, quantity, timeline..." rows={3}/></label>
          <button className="button button-dark form-submit" type="submit">Submit sourcing enquiry <ArrowUpRight size={18}/></button>          <small className="form-hint" role="status">{enquiryStatus || "We will use these details only to follow up on your enquiry."}</small>{whatsapp && <a className="form-hint" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Prefer WhatsApp? Start a conversation.</a>}
        </form>
      </div>
    </section>

    <footer><div className="footer-main"><a className="brand footer-brand" href="#"><span className="brand-icon"><Zap size={21}/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></a><p>Connecting global buyers to electric mobility options from China.</p><a href="#contact" className="footer-link">Start a conversation <ArrowUpRight size={16}/></a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} E.V CHINA GLOBAL. All rights reserved.</span><span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · Independent sourcing platform · Verify all offers.</span></div></footer>

    <button className="chat-fab" onClick={()=>setChatOpen(true)} aria-label="Open AI sourcing assistant"><Sparkles size={19}/><span>AI sourcing assistant</span></button>
    {chatOpen && <div className="chat-panel"><div className="chat-head"><div><span className="ai-dot"></span><b>EV China AI Assistant</b><small>Vehicle sourcing guide</small></div><button onClick={()=>setChatOpen(false)} aria-label="Close chat"><X/></button></div><div className="chat-messages">{messages.map((m,i)=><div className={`bubble ${m.role}`} key={i}>{m.content}</div>)}{busy&&<div className="bubble assistant">Thinking…</div>}</div><form className="chat-input" onSubmit={askAgent}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about sourcing an EV…"/><button disabled={busy||!question.trim()} aria-label="Send message"><ArrowRight/></button></form><div className="chat-foot">AI guidance is preliminary. Confirm specifications, pricing and import rules independently.</div></div>}
  </main>;
}
