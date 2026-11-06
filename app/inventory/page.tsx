"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Search, Zap } from "lucide-react";

type VehicleCard = {
  id: string;
  stockReference: string;
  model: string;
  year: number;
  bodyType: string;
  condition: "NEW" | "USED";
  currency: string;
  exportPrice: string;
  rangeKm: number | null;
  manufacturer: { name: string };
  images: { url: string; alt: string }[];
};

type SearchResults = {
  vehicles: VehicleCard[];
  total: number;
  page: number;
  pages: number;
  manufacturers: string[];
  bodyTypes: string[];
};

export default function Inventory() {
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [minRange, setMinRange] = useState("");
  const [maxRange, setMaxRange] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (query.trim()) params.set("q", query.trim());
      if (manufacturer) params.set("manufacturer", manufacturer);
      if (bodyType) params.set("bodyType", bodyType);
      if (condition) params.set("condition", condition);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (minYear) params.set("minYear", minYear);
      if (maxYear) params.set("maxYear", maxYear);
      if (minRange) params.set("minRange", minRange);
      if (maxRange) params.set("maxRange", maxRange);
      if (sort !== "newest") params.set("sort", sort);
      try {
        const response = await fetch(`/api/vehicles?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Inventory could not be loaded.");
        if (active) setResult(data as SearchResults);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Inventory could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, manufacturer, bodyType, condition, sort, minPrice, maxPrice, minYear, maxYear, minRange, maxRange, page]);

  const money = (currency: string, value: string) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));

  return <main className="catalog-page">
    <header className="catalog-nav"><Link href="/" className="brand"><span className="brand-icon"><Zap/></span><span>E.V <b>CHINA</b><small>GLOBAL MOBILITY</small></span></Link><Link href="/" className="back-link"><ArrowLeft size={16}/> Home</Link></header>
    <section className="catalog-hero"><div className="section-kicker">VERIFIED CHINA EV MARKETPLACE</div><h1>Find the EV that<br/><em>moves you.</em></h1><p>Browse only vehicles verified for listing. Specifications, price and export availability remain subject to the written quotation and destination checks.</p></section>
    <section className="catalog-body">
      <div className="catalog-toolbar">
        <div className="search-field"><Search size={17}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search make, model or stock reference" aria-label="Search inventory"/></div>
        <select value={manufacturer} onChange={(event) => { setManufacturer(event.target.value); setPage(1); }} aria-label="Filter by manufacturer"><option value="">All makes</option>{(result?.manufacturers || []).map((name) => <option key={name}>{name}</option>)}</select>
        <select value={bodyType} onChange={(event) => { setBodyType(event.target.value); setPage(1); }} aria-label="Filter by body type"><option value="">All body types</option>{(result?.bodyTypes || []).map((name) => <option key={name}>{name}</option>)}</select>
        <select value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1); }} aria-label="Filter by condition"><option value="">New and used</option><option value="NEW">New</option><option value="USED">Used</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort inventory"><option value="newest">Latest listings</option><option value="price-asc">Price: low to high</option><option value="year-desc">Newest model year</option></select>
        <input className="catalog-filter-number" type="number" min="0" placeholder="Min price" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} aria-label="Minimum price"/>
        <input className="catalog-filter-number" type="number" min="0" placeholder="Max price" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} aria-label="Maximum price"/>
        <input className="catalog-filter-number" type="number" min="1990" placeholder="From year" value={minYear} onChange={(event) => { setMinYear(event.target.value); setPage(1); }} aria-label="Minimum model year"/>
        <input className="catalog-filter-number" type="number" min="1990" placeholder="To year" value={maxYear} onChange={(event) => { setMaxYear(event.target.value); setPage(1); }} aria-label="Maximum model year"/>
        <input className="catalog-filter-number" type="number" min="0" placeholder="Min range km" value={minRange} onChange={(event) => { setMinRange(event.target.value); setPage(1); }} aria-label="Minimum range in kilometers"/>
        <input className="catalog-filter-number" type="number" min="0" placeholder="Max range km" value={maxRange} onChange={(event) => { setMaxRange(event.target.value); setPage(1); }} aria-label="Maximum range in kilometers"/>
        <span className="result-count">{loading ? "Loading…" : `${result?.total || 0} verified vehicles`}</span>
      </div>
      {error && <div className="catalog-warning" role="alert">{error}</div>}
      {!loading && !error && !result?.vehicles.length && <div className="catalog-warning"><b>No verified vehicles are currently listed</b><p>We will only publish stock after supplier, vehicle details, price and availability are checked. Submit a sourcing enquiry if you have a particular model in mind.</p><Link className="text-link" href="/#contact">Start an enquiry <ArrowUpRight size={16}/></Link></div>}
      <div className="catalog-grid">{result?.vehicles.map((vehicle) => <article className="catalog-card" key={vehicle.id}>
        <Link href={`/inventory/${vehicle.id}`} aria-label={`View ${vehicle.manufacturer.name} ${vehicle.model}`}>
          <div className="catalog-image" style={{ backgroundImage: vehicle.images[0]?.url ? `url("${vehicle.images[0].url}")` : undefined }}><span>VERIFIED LISTING</span><small>{vehicle.stockReference}</small></div>
        </Link>
        <div className="catalog-card-content"><div className="catalog-card-top"><div><h2>{vehicle.manufacturer.name} {vehicle.model}</h2><p>{vehicle.year} · {vehicle.bodyType} · {vehicle.condition === "NEW" ? "New" : "Used"}</p></div></div>
          <div className="spec-pills"><span>{vehicle.rangeKm ? `${vehicle.rangeKm} km range` : "Range on request"}</span><span>China export</span></div>
          <p className="catalog-note">Supplier-verified listing. Confirm exact trim, documents and destination eligibility before purchase.</p>
          <div className="vehicle-price">{money(vehicle.currency, vehicle.exportPrice)}</div>
          <Link href={`/inventory/${vehicle.id}`} className="catalog-cta">View specifications & request quote <ArrowUpRight size={16}/></Link>
        </div>
      </article>)}</div>
      {result && result.pages > 1 && <div className="pagination"><button className="button button-dark" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {result.pages}</span><button className="button button-dark" disabled={page >= result.pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
      <div className="catalog-warning"><b>Inventory transparency</b><p>Published listings are verified at listing time; supplier stock can change. Availability and selling price must be reconfirmed before a binding offer. Export prices exclude destination taxes and duties unless a written quote says otherwise.</p></div>
    </section>
  </main>;
}
