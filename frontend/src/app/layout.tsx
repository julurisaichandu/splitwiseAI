import type { Metadata } from "next";
import { Geist, Geist_Mono, Playwrite_CO } from "next/font/google";
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
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Split Splitter - Bill Splitter",
  description: "Split bills with friends using AI-powered receipt analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playwriteCO.variable} antialiased bg-slate-50`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
