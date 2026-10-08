"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Wallet, RotateCcw, Zap, Settings, LogOut, LogIn, History } from "lucide-react";
import { useBalance } from "@/context/BalanceContext";
import { cn } from "@/lib/cn";

export function Header() {
  const { balance, reset, fmt } = useBalance();
  const path = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-10 flex items-center px-4 md:px-6 h-14 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border)]">
      {/* Mobile logo — links home (sidebar is hidden below md) */}
      <Link href="/" className="md:hidden flex items-center gap-1.5 font-display text-lg font-extrabold text-[var(--text)] tracking-tight hover:text-[var(--accent-2)] transition-colors">
        <Zap size={18} className="text-[var(--accent)] fill-[var(--accent)]" />
        STEAK
      </Link>

      {/* Wallet — fused balance + reset, centered wallet control */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-stretch">
        <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] border-r-0 rounded-l-lg px-3.5 py-1.5">
          <Wallet size={14} className="text-[var(--accent-2)]" />
          <span className="text-sm font-bold text-[var(--text)] tabular-nums">
            ${fmt(balance)}
          </span>
        </div>
        <button
          onClick={reset}
          title="Reset balance to your configured starting amount"
          className="flex items-center gap-1.5 px-3.5 rounded-r-lg bg-[var(--accent)] text-white text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {status === "authenticated" ? (
          <>
            <span className="hidden sm:inline text-xs font-semibold text-[var(--muted)] max-w-[8rem] truncate">
              {session.user?.name}
            </span>
            <Link
              href="/history"
              title="Bet history"
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
                path === "/history"
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]"
              )}
            >
              <History size={14} />
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              title="Log out"
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
            >
              <LogOut size={14} />
            </button>
          </>
        ) : (
          status !== "loading" && (
            <Link
              href="/login"
              title="Log in"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
            >
              <LogIn size={13} />
              Log In
            </Link>
          )
        )}

        <Link
          href="/settings"
          title="Settings"
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
            path === "/settings"
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]"
          )}
        >
          <Settings size={14} />
        </Link>
      </div>
    </header>
  );
}
