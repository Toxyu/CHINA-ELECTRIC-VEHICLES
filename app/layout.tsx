import type { Metadata } from "next";
import "./globals.css";
import "./components.css";
import "./operations.css";

export const metadata: Metadata = {
  title: "E.V CHINA GLOBAL | Source Electric Vehicles from China",
  description: "A sourcing partner concept connecting global buyers with electric vehicles from China. Request a vehicle and receive a tailored sourcing conversation.",
  applicationName: "E.V China Global",
  openGraph: {
    title: "E.V China Global",
    description: "Explore verified electric-vehicle listings and request a tailored sourcing quotation.",
    type: "website",
    siteName: "E.V China Global",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
