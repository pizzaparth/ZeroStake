import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AppProviders } from "@/components/providers/AppProviders";
import { auth } from "@/auth";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Steak — Play Money Casino",
  description: "A play-money online game platform. No real money.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`h-full ${manrope.variable} ${bricolage.variable}`}>
      <body className="flex h-full bg-[var(--bg)] font-sans">
        <AppProviders session={session}>
          <Sidebar />
          <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
            <Header />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
