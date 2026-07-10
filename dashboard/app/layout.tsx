import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '../styles/tokens.css';
import '../styles/v2-primitives.css';

// Self-hosted, no-flash — feeds tokens.css's --font-sans / --font-mono (v2
// primitives only; the v1 system keeps its existing Google Fonts <link>
// until it migrates too, see tokens.css's scoping note).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'RetailIQ — E-Commerce Intelligence Platform',
  description: 'Revenue, retention, segmentation, and logistics analytics for Olist e-commerce data.',
};

/**
 * Root layout owns only what's global to every route: fonts, base
 * stylesheets, html/body. The dashboard chrome (Rail, TourProvider, the
 * flex shell) lives one level down in app/app/layout.tsx (PRD §3/§9.1) —
 * the public landing page at '/' renders full-bleed, with none of that
 * dashboard shell around it.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
