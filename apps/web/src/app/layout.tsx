import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: "../../public/brand/fonts/manrope-variable.ttf",
  variable: "--font-manrope", weight: "200 800", display: "swap",
});
export const metadata: Metadata = {
  title: "TraceMigo — Read code. Think together.",
  description: "Practice reading Python code: predict the output, inspect a prerecorded trace, and explain the result.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/brand/favicon-96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return <html lang="en" className={manrope.variable}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
