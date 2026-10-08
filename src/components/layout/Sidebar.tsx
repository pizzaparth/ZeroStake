"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame, Dice5, Grid2x2, CircleDot, Rocket, Disc3, CircleDollarSign,
  Grid3X3, Gem, TrendingUp, Castle, Spade, LayoutGrid, Zap, Home, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";

const GROUPS: { label: string | null; items: { href: string; label: string; icon: typeof Home }[] }[] = [
  {
    label: null,
    items: [{ href: "/", label: "Lobby", icon: Home }],
  },
  {
    label: "Originals",
    items: [
      { href: "/games/crash", label: "Crash", icon: Flame },
      { href: "/games/dice", label: "Dice", icon: Dice5 },
      { href: "/games/mines", label: "Mines", icon: Grid2x2 },
      { href: "/games/plinko", label: "Plinko", icon: CircleDot },
      { href: "/games/limbo", label: "Limbo", icon: Rocket },
      { href: "/games/wheel", label: "Wheel", icon: Disc3 },
      { href: "/games/flip", label: "Flip", icon: CircleDollarSign },
      { href: "/games/dragon-tower", label: "Dragon Tower", icon: Castle },
      { href: "/games/keno", label: "Keno", icon: Grid3X3 },
      { href: "/games/diamonds", label: "Diamonds", icon: Gem },
    ],
  },
  {
    label: "Cards & Tables",
    items: [
      { href: "/games/blackjack", label: "Blackjack", icon: Spade },
      { href: "/games/hilo", label: "Hilo", icon: TrendingUp },
      { href: "/games/video-poker", label: "Video Poker", icon: LayoutGrid },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-[var(--surface)] border-r border-[var(--border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Zap className="text-[var(--accent)] fill-[var(--accent)]" size={22} />
        <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text)]">
          STEAK
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-3 px-3 pb-3 flex-1 overflow-y-auto">
        {GROUPS.map(({ label, items }) => (
          <div key={label ?? "top"} className="rounded-xl bg-[var(--surface-2)]/50 p-1.5">
            {label && (
              <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-[var(--muted)] uppercase tracking-[0.15em]">
                {label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map(({ href, label: itemLabel, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all",
                    path === href
                      ? "bg-[var(--accent)] text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
                      : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  <Icon size={16} />
                  {itemLabel}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Provably-fair promo */}
      <div className="p-3">
        <Link
          href="/settings"
          className="relative block overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-violet-600/20 to-cyan-500/10 p-3.5 hover:border-[var(--accent)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[var(--accent-2)]" />
            <span className="text-xs font-bold text-[var(--text)]">Provably fair</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted)]">
            For account holders: every outcome is committed before you bet. Play money only.
          </p>
        </Link>
      </div>
    </aside>
  );
}
