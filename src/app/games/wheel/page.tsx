"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Disc3 } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { GameShell, type ProvablyFair } from "@/components/ui/GameShell";
import { ResultBanner } from "@/components/ui/ResultBanner";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getWheelRing, type WheelRisk, type WheelSegments } from "@/lib/game-engine/wheel";
import { cn } from "@/lib/cn";
import { playFetch } from "@/lib/seed-client";

interface WheelResponse {
  segmentIndex: number; multiplier: number; profit: number; ring: number[];
  serverSeed?: string; serverSeedHash: string; clientSeed: string; nonce: number;
  balance?: number;
}

const SIZE = 320;
const R = 150;
const CENTER = SIZE / 2;
const SEGMENTS_OPTS: WheelSegments[] = [10, 20, 30, 40, 50];
const RISKS: WheelRisk[] = ["low", "medium", "high"];

function segColor(m: number): string {
  if (m === 0) return "#241e33";
  if (m < 1) return "#4a3f68";
  if (m < 2) return "#7c6bb0";
  if (m < 5) return "#8b5cf6";
  return "#22d3ee";
}

export default function WheelPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount] = useState(100_00);
  const [segments, setSegments] = useState<WheelSegments>(30);
  const [risk, setRisk] = useState<WheelRisk>("medium");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [last, setLast] = useState<WheelResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draw the static wheel whenever config changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const ring = getWheelRing(segments, risk);
    const seg = (Math.PI * 2) / ring.length;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ring.forEach((m, i) => {
      const start = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.arc(CENTER, CENTER, R, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = segColor(m);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // label only when segments are sparse enough to read
      if (ring.length <= 30 && m > 0) {
        ctx.save();
        ctx.translate(CENTER, CENTER);
        ctx.rotate(start + seg / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = m >= 5 ? "#0e3a44" : "#fff";
        ctx.font = `700 ${ring.length <= 20 ? 11 : 9}px system-ui`;
        ctx.fillText(`${m}×`, R - 8, 0);
        ctx.restore();
      }
    });
    // hub
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#16131f";
    ctx.fill();
    ctx.strokeStyle = "#2b2542";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [segments, risk]);

  const spin = useCallback(async () => {
    if (betAmount > balance || spinning) return;
    setSpinning(true);
    setLast(null);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    try {
      const res = await playFetch("/api/games/wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, segments, risk, clientSeed }),
      });
      const data: WheelResponse = await res.json();
      const segAngle = 360 / data.ring.length;
      // Rotate so the winning segment centre lands under the top pointer.
      const base = rotRef.current;
      const extraSpins = 5 * 360;
      const landed = base + extraSpins - ((base + (data.segmentIndex + 0.5) * segAngle) % 360);
      rotRef.current = landed;
      setRotation(landed);
      settleTimer.current = setTimeout(() => {
        if (data.balance !== undefined) syncBalance(data.balance); else applyProfit(data.profit);
        setLast(data);
        setSpinning(false);
      }, 4200);
    } catch {
      setSpinning(false);
    }
  }, [betAmount, balance, segments, risk, spinning, applyProfit, syncBalance, clientSeed]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const fair: ProvablyFair | null = last
    ? { serverSeed: last.serverSeed, serverSeedHash: last.serverSeedHash, clientSeed: last.clientSeed, nonce: last.nonce,
        extra: [{ label: "Multiplier", value: `${last.multiplier}×` }] }
    : null;

  return (
    <GameShell title="Wheel" subtitle="Spin the wheel · Pick your risk · Land a multiplier"
      icon={Disc3} iconClass="bg-rose-500/10 border-rose-500/20 text-rose-400" fair={fair}>
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Wheel display — fills available space */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[260px]">
          <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10"
              style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid var(--accent)" }} />
            <canvas ref={canvasRef}
              style={{ width: SIZE, height: SIZE, maxWidth: "100%", transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.16,1,0.3,1)" : "none" }} />
          </div>
          <div className="min-h-[24px] mt-3">
            <ResultBanner profit={last ? last.profit : null} label={last ? `${last.multiplier}×` : undefined} />
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Risk</label>
            <div className="flex gap-1.5">
              {RISKS.map((r) => (
                <button key={r} onClick={() => setRisk(r)} disabled={spinning}
                  className={cn("flex-1 py-2 rounded-lg border text-xs font-bold capitalize transition-all",
                    risk === r ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Segments</label>
            <div className="grid grid-cols-5 gap-1.5">
              {SEGMENTS_OPTS.map((s) => (
                <button key={s} onClick={() => setSegments(s)} disabled={spinning}
                  className={cn("py-1.5 rounded-lg border text-xs font-bold transition-all",
                    segments === s ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                      : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <BetInput value={betAmount} onChange={setBetAmount} disabled={spinning} />
          <button onClick={spin} disabled={spinning || betAmount > balance}
            className={cn("w-full py-3 rounded-xl font-black text-base transition-all",
              "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
              "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
              "disabled:opacity-40 disabled:cursor-not-allowed")}>
            {spinning ? "Spinning…" : "Spin"}
          </button>
        </div>
      </div>
    </GameShell>
  );
}
