import Link from "next/link";

export default function PrivacyPage() {
  return <main className="legal-page"><header className="catalog-nav"><Link className="brand" href="/">E.V <b>CHINA</b></Link><Link href="/">Home</Link></header><article><div className="section-kicker">CUSTOMER INFORMATION</div><h1>Privacy <em>notice.</em></h1><p>This starter privacy notice describes the information the current application stores. Have qualified counsel adapt it to the operating company, destination laws, retention schedule and actual vendors before collecting customer data in production.</p>
    <h2>Information collected</h2><p>Account registration stores name, email, optional phone number, a password hash, verification status and sign-in sessions. Enquiries store the contact and vehicle requirements submitted by a customer. Quotations, orders, shipment updates, payment references, saved listings and notifications are stored to support the requested services.</p>
    <h2>Use and sharing</h2><p>Information is used to respond to vehicle sourcing requests and administer customer accounts and orders. Transactional email is sent only through the configured email provider. The site does not store card numbers or initiate payments. AI messages may be sent to the configured AI provider when that feature is enabled; do not enter sensitive personal or payment information in chat.</p>
    <h2>Security and retention</h2><p>Passwords are hashed, session cookies are HTTP-only and account resources are access-controlled. Records are retained in the configured Supabase project. The operator must configure access, backups, retention, incident response and data-subject request handling with its hosting providers.</p>
    <h2>Contact</h2><p>Publish the operating company&apos;s verified legal name and privacy contact before launch. The project does not invent those details.</p>
  </article></main>;
}
