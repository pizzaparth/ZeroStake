"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode } from "react";
import { SettingsProvider } from "@/context/SettingsContext";
import { BalanceProvider } from "@/context/BalanceContext";

export function AppProviders({ session, children }: { session: Session | null; children: ReactNode }) {
  return (
    <SessionProvider session={session}>
      <SettingsProvider>
        <BalanceProvider>{children}</BalanceProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
