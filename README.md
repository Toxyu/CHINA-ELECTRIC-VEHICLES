# E.V China Global

Next.js application for a China-based electric-vehicle sourcing marketplace. It includes a public inventory catalogue, customer accounts and enquiries, staff workspaces, quotations and invoices, order tracking, manual external-payment recording, shipment updates, and an optional AI inventory assistant.

The application is a deployable software foundation, not a claim of operating-company registration, verified suppliers, vehicle availability, import eligibility, payment processing, or completed logistics. No live vehicles are seeded; staff must verify and publish inventory before it appears publicly.

## Requirements

- Node.js 20.9 or later and npm
- PostgreSQL 14 or later
- An HTTPS deployment domain for production authentication cookies
- Optional Resend account for production verification and password-reset email
- Optional OpenAI-compatible API key for the inventory assistant
- Persistent HTTPS image hosting; image URLs are stored, but this project does not upload image files

## Local setup

1. Install dependencies and configure environment values:

   ```sh
   npm install
   cp .env.example .env.local
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env.local`.
2. Set `DATABASE_URL` to the PostgreSQL runtime connection string and `DIRECT_URL` to a direct, non-pooled connection for migrations. Set real company details before issuing invoices.
3. Apply migrations, generate Prisma Client, then start the app:

   ```sh
   npm run db:migrate
   npm run db:generate
   npm run dev
   ```
4. Open `http://localhost:3000`.

The first administrator is provisioned explicitly; there is no default password or public admin registration:

```sh
# Set ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_NAME, ADMIN_BOOTSTRAP_PASSWORD (16+ characters)
npm run admin:bootstrap
```

Create additional staff accounts through the operator-controlled CLI, choosing one of `INVENTORY_MANAGER`, `SALES_MANAGER`, `FINANCE_OFFICER`, or `LOGISTICS_MANAGER`:

```sh
# Set STAFF_EMAIL, STAFF_NAME, STAFF_ROLE, STAFF_PASSWORD (16+ characters)
npm run staff:create
```

Provisioning refuses to overwrite an existing account. Do not put bootstrap or staff credentials in source control or retain them in a deployment environment after use.

## Environment

See `.env.example` for the complete variable list:

- `DATABASE_URL`, `DIRECT_URL`: pooled runtime and direct migration PostgreSQL URLs.
- `APP_URL`: externally visible application origin used to construct email links.
- `RESEND_API_KEY`, `EMAIL_FROM`: optional transactional email. Configure a verified sender/domain before production; local development exposes one-time links in API responses.
- `OPENAI_API_KEY`, `OPENAI_MODEL`: optional server-only assistant configuration. Never use a `NEXT_PUBLIC_` prefix for secrets.
- `COMPANY_LEGAL_NAME`, `COMPANY_EMAIL`, `COMPANY_PHONE`, `COMPANY_ADDRESS`: operator-provided invoice identity/contact details.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: optional business number, digits only.
- `ADMIN_BOOTSTRAP_*`, `STAFF_*`: transient CLI provisioning inputs, not runtime credentials.

## Main workflows

- Public pages: `/`, `/inventory`, `/inventory/[id]`, `/privacy`, `/terms`.
- Customer pages: `/account`, `/quote`; registration, verification, login, reset and account deactivation are API-backed.
- Staff pages: `/admin/login` and the role-scoped `/admin/[section]` workspace.
- APIs under `/api` handle authentication, inventory, enquiries, saved vehicles, quotations, invoices/PDFs, payments, orders, shipments, notifications and assistant requests.

The public catalogue returns only available, verified vehicles and never exposes VINs or supplier-private identifiers. Staff must verify stock, pricing, images, specifications and legal eligibility before publication. Customer quotations use server-side calculations and immutable snapshots; currencies must match because there is no foreign-exchange service. Customs duties and tariffs are not calculated. Payment records represent externally completed payments that finance staff verify; the app neither charges cards nor stores card data. Shipment information is manually entered.

## Database and operations

`prisma/schema.prisma` is the data model. Apply the checked-in SQL migration with `npm run db:migrate`; use `npm run db:dev` only for local schema development. Back up PostgreSQL and test restoration, restrict database credentials, monitor email delivery and API errors, and define retention, incident response, and data-subject request procedures before launch. The app does not configure cloud backups or object storage.

Set `APP_URL`, database URLs, company details and any provider credentials in the hosting platform's secret manager. Run `npm run db:migrate` as a deployment/release step before routing traffic to a new application version. Configure HTTPS and a supported PostgreSQL provider. AI and email are optional, but email verification/reset delivery is required for a production customer account experience.

## Checks

```sh
npm run lint
npm test
npx prisma validate
npm run build
npm audit
```

The quote arithmetic unit tests do not require a database. Migration execution, authentication/email delivery, staff permissions and transactional workflows require a configured PostgreSQL service and have to be smoke-tested in the deployment environment.

## Before launch

- Replace all company placeholders with verified legal/business contact details.
- Enter independently verified stock and supplier data; use licensed, persistent image URLs.
- Have qualified counsel adapt the privacy notice and terms to the operator, destination markets, vendors and retention practices.
- Obtain specialist advice on exact vehicle import, customs, safety, tax and registration eligibility. The site does not promise that China-market EVs may be imported or registered in a destination.
- Verify supplier and logistics contracts, payment beneficiary, refund terms and external payment references.
- Configure production email, database backups, monitoring and incident response.
