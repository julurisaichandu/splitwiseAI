import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playwrite_CO, Lexend } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "../../components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playwriteCO = Playwrite_CO({
  variable: "--font-playwrite-co",
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  themeColor: "#b45309",
};

export const metadata: Metadata = {
  title: "SplitWise AI - Bill Splitter",
  description: "Split bills with friends using AI-powered receipt analysis",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SplitWise AI",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playwriteCO.variable} ${lexend.variable} antialiased bg-slate-50`}
      >
        <Providers>{children}</Providers>
        <Script id="sw-register" strategy="afterInteractive">
          {`if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`}
        </Script>
      </body>
    </html>
  );
}
