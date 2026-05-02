import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NATA Today | Automotive Recruiting & Training",
  description:
    "A modern NATA Today demo for automotive recruiting, training, certification, and dealer-ready candidate visibility.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer style={footerStyle}>
          <span>© {new Date().getFullYear()} NATA Today</span>
          <nav style={footerNavStyle} aria-label="Legal links">
            <Link href="/privacy" style={footerLinkStyle}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={footerLinkStyle}>
              Terms
            </Link>
          </nav>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  padding: "28px 20px",
  color: "#9fb4d6",
  fontSize: 13,
  background: "#07111f",
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const footerNavStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#cfe2ff",
  textDecoration: "none",
  fontWeight: 800,
};
