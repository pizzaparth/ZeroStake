"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CircleDot } from "lucide-react";
import { BetInput } from "@/components/ui/BetInput";
import { useBalance } from "@/context/BalanceContext";
import { useSettings } from "@/context/SettingsContext";
import { getMultiplierTable } from "@/lib/game-engine/plinko";
import { cn } from "@/lib/cn";
import type { PlinkoRisk } from "@/lib/game-engine/plinko";
import { playFetch } from "@/lib/seed-client";
import { ServerSeedRow } from "@/components/ui/GameShell";

// ─── Board geometry ───────────────────────────────────────────────────────────

const W = 420;
const H = 500;
const PAD = 18;
const TOP_Y = 40;
const BUCKET_H = 50;
const PEG_AREA_H = H - TOP_Y - BUCKET_H;

/** Spacing between pegs (= bucket width). (rows+1) buckets across (W-2*PAD). */
const spacing = (rows: number) => (W - 2 * PAD) / (rows + 1);
const rowH    = (rows: number) => PEG_AREA_H / rows;

const CX = W / 2;

const pegX = (r: number, j: number, rows: number) =>
  CX + (j - r / 2) * spacing(rows);
const pegY = (r: number, rows: number) => TOP_Y + r * rowH(rows);
const bucketCX = (j: number, rows: number) =>
  PAD + (j + 0.5) * spacing(rows);
const bucketY = (rows: number) => TOP_Y + rows * rowH(rows) + 8;

// ─── Physics constants ────────────────────────────────────────────────────────
//
// The ball's outcome (its L/R path and final bucket) is decided by the server
// before the animation runs. So rather than simulate loose collisions — which
// drift and snap unpredictably — we precompute the exact peg centres the ball
// visits and animate each hop as a real projectile arc whose launch velocity is
// solved to land precisely on the next peg. This mirrors the genre standard: deterministic
// landing, but a smooth, physical-looking fall with a consistent little bounce.

const GRAVITY = 0.22;   // px / frame² — sets the overall fall pace
const BOUNCE  = 1.4;    // upward speed (px/frame) imparted when leaving each peg
const BALL_R  = 5;

// ─── Ball physics state ───────────────────────────────────────────────────────

interface Pt { x: number; y: number; }

interface PhysBall {
  /** Exact centres the ball passes through: spawn → apex peg → … → bucket. */
  waypoints: Pt[];
  seg: number;          // index of the hop currently animating (waypoints[seg] → [seg+1])
  segFrame: number;     // frames elapsed in the current hop
  segDuration: number;  // total frames for the current hop (fractional)
  ax: number;           // start x of the current hop
  ay: number;           // start y of the current hop
  vx: number;           // constant horizontal speed for the hop
  vy0: number;          // launch vertical speed (negative = upward bounce)
  x: number;            // rendered position (evaluated analytically each frame)
  y: number;
  delay: number;        // frames to wait before launching (staggers multi-ball drops)
  bucketIndex: number;
  landed: boolean;
}

/** Solve launch velocities so a hop from `a` lands exactly on `b` at t = T.
 *  `bounce` is the upward kick (0 for the initial straight drop into the apex).
 *  The hop is then evaluated analytically (not Euler-integrated) so the ball
 *  passes through each peg centre with zero drift — no snapping, no jitter. */
function setupHop(ball: PhysBall, a: Pt, b: Pt, bounce: number) {
  const dy = b.y - a.y;            // always > 0 (downward)
  const dx = b.x - a.x;
  const vy0 = -bounce;             // negative = upward
  // dy = vy0·T + ½·g·T²  →  solve the positive root for T
  const T = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * GRAVITY * dy)) / GRAVITY;
  ball.ax = a.x;
  ball.ay = a.y;
  ball.vx = dx / T;
  ball.vy0 = vy0;
  ball.segDuration = T;
  ball.segFrame = 0;
}

/** Build the full waypoint chain for a resolved ball path. */
function buildWaypoints(path: Array<"L" | "R">, rows: number): { waypoints: Pt[]; bucketIndex: number } {
  const pts: Pt[] = [];
  // Spawn just above the apex peg so the ball visibly drops in.
  pts.push({ x: CX, y: TOP_Y - Math.min(30, rowH(rows) * 0.6) });

  // Apex peg, then one peg per row, deflecting L/R per the path.
  let j = 0;
  pts.push({ x: pegX(0, 0, rows), y: pegY(0, rows) });
  for (let r = 0; r < rows; r++) {
    if (path[r] === "R") j++;
    if (r < rows - 1) {
      pts.push({ x: pegX(r + 1, j, rows), y: pegY(r + 1, rows) });
    }
  }

  // Final drop into the bucket the ball landed in.
  const bucketIndex = j;
  const bH = BUCKET_H - 16;
  pts.push({ x: bucketCX(bucketIndex, rows), y: bucketY(rows) + bH * 0.5 });

  return { waypoints: pts, bucketIndex };
}

// ─── Multiplier colour helpers ────────────────────────────────────────────────

function mFill(m: number): string {
  if (m >= 50)  return "rgba(34,211,238,0.85)";
  if (m >= 10)  return "rgba(139,92,246,0.55)";
  if (m >= 3)   return "rgba(167,139,250,0.35)";
  if (m >= 1.5) return "rgba(255,255,255,0.07)";
  if (m >= 1)   return "rgba(255,255,255,0.04)";
  return               "rgba(251,113,133,0.25)";
}
function mText(m: number): string {
  if (m >= 10)  return "#a78bfa";
  if (m >= 3)   return "#c4b5fd";
  if (m >= 1.5) return "#cfcae4";
  if (m >= 1)   return "#6b6390";
  return               "#fb7185";
}
function mStroke(m: number): string {
  if (m >= 10)  return "rgba(139,92,246,0.7)";
  if (m >= 3)   return "rgba(167,139,250,0.5)";
  if (m >= 1.5) return "rgba(255,255,255,0.14)";
  if (m >= 1)   return "rgba(255,255,255,0.07)";
  return               "rgba(251,113,133,0.45)";
}

// ─── Canvas Plinko Board ──────────────────────────────────────────────────────

function PlinkoBoard({
  rows,
  risk,
  ballsRef,
  running,
  onAllLanded,
}: {
  rows: 8 | 12 | 16;
  risk: PlinkoRisk;
  ballsRef: React.MutableRefObject<PhysBall[]>;
  running: boolean;
  onAllLanded: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const table     = getMultiplierTable(rows, risk);
  const sp        = spacing(rows);
  const pr        = Math.max(3, 4.5 - (rows - 8) * 0.12); // peg radius
  const dpr       = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale canvas for retina
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    const bY  = bucketY(rows);
    const bH  = BUCKET_H - 16;
    const bW  = sp - 3;
    const fs  = Math.max(7, Math.min(11, sp * 0.52));

    const drawPegsAndBuckets = (landCount: Record<number, number> = {}) => {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      for (let r = 0; r < rows; r++) {
        for (let j = 0; j <= r; j++) {
          ctx.beginPath();
          ctx.arc(pegX(r, j, rows), pegY(r, rows), pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let i = 0; i <= rows; i++) {
        const m   = table[i];
        const cx  = bucketCX(i, rows);
        const hit = landCount[i] ?? 0;
        const x   = cx - bW / 2;
        ctx.fillStyle = mFill(m);
        ctx.strokeStyle = mStroke(m);
        ctx.lineWidth = hit > 0 ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, bY, bW, bH, 3);
        ctx.fill();
        ctx.stroke();
        if (hit > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(0.22, hit * 0.07)})`;
          ctx.beginPath();
          ctx.roundRect(x, bY, bW, bH, 3);
          ctx.fill();
        }
        ctx.fillStyle = mText(m);
        ctx.font = `700 ${fs}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${m}×`, cx, bY + bH / 2);
      }
    };

    // Always draw the static board immediately (pegs + buckets)
    ctx.clearRect(0, 0, W, H);
    drawPegsAndBuckets();

    if (!running) return;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Count landed balls per bucket
      const landCount: Record<number, number> = {};
      for (const b of ballsRef.current) {
        if (b.landed) landCount[b.bucketIndex] = (landCount[b.bucketIndex] ?? 0) + 1;
      }

      drawPegsAndBuckets(landCount);

      // ── Update + draw balls ──
      let allDone = true;
      for (const ball of ballsRef.current) {
        if (!ball.landed) {
          allDone = false;

          if (ball.delay > 0) {
            ball.delay--;            // still waiting to launch — hold at spawn
          } else {
            // Evaluate the projectile analytically: position is exact at the
            // peg when segFrame reaches segDuration, so the last frame is clamped
            // and the ball lands dead-on with no snap.
            ball.segFrame++;
            const tf = Math.min(ball.segFrame, ball.segDuration);
            ball.x = ball.ax + ball.vx * tf;
            ball.y = ball.ay + ball.vy0 * tf + 0.5 * GRAVITY * tf * tf;

            if (ball.segFrame >= ball.segDuration) {
              ball.seg++;
              if (ball.seg >= ball.waypoints.length - 1) {
                ball.landed = true;  // reached the bucket
              } else {
                setupHop(ball, ball.waypoints[ball.seg], ball.waypoints[ball.seg + 1], BOUNCE);
              }
            }
          }
        }

        // Draw
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = ball.landed ? "rgba(167,139,250,0.6)" : "#a78bfa";
        ctx.shadowColor = ball.landed ? "transparent" : "rgba(139,92,246,0.4)";
        ctx.shadowBlur  = ball.landed ? 0 : 5;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (allDone && ballsRef.current.length > 0) {
        cancelAnimationFrame(rafRef.current);
        onAllLanded();
        return;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, rows, risk]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: W, height: H, maxWidth: "100%", display: "block", margin: "0 auto" }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ROWS_OPTIONS = [8, 12, 16] as const;
const RISK_OPTIONS: PlinkoRisk[] = ["low", "medium", "high"];
const BALL_COUNT_OPTIONS = [1, 3, 5, 10, 25, 100] as const;

interface PlinkoResult {
  path: Array<"L" | "R">;
  bucketIndex: number;
  multiplier: number;
  profit: number;
  /** Absent for logged-in bets until the seed pair is rotated. */
  serverSeed?: string;
  serverSeedHash: string;
  clientSeed: string;
  /** Each ball is its own bet: logged-in balls take consecutive nonces. */
  nonce: number;
}

export default function PlinkoPage() {
  const { applyProfit, syncBalance, balance } = useBalance();
  const { clientSeed } = useSettings();
  const [betAmount, setBetAmount]   = useState(100_00);
  const [rows, setRows]             = useState<8 | 12 | 16>(8);
  const [risk, setRisk]             = useState<PlinkoRisk>("medium");
  const [ballCount, setBallCount]   = useState<1 | 3 | 5 | 10 | 25 | 100>(1);
  const [dropping, setDropping]     = useState(false);
  const [sessionProfit, setSessionProfit] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);
  const [history, setHistory]       = useState<{ multiplier: number; profit: number }[]>([]);

  const ballsRef       = useRef<PhysBall[]>([]);
  const totalProfitRef = useRef(0);

  const handleAllLanded = useCallback(() => {
    setDropping(false);
    setSessionProfit(totalProfitRef.current);
  }, []);

  const drop = useCallback(async () => {
    if (betAmount * ballCount > balance || dropping) return;

    setDropping(true);
    setSessionProfit(null);
    setLastResult(null);
    ballsRef.current = [];

    try {
      const res = await playFetch("/api/games/plinko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, rows, risk, count: ballCount, clientSeed }),
      });
      const data: { results: PlinkoResult[]; balance?: number } = await res.json();
      const results = data.results;

      // Apply profit immediately (server already resolved).
      // Authenticated: trust the server's aggregate balance directly, applied
      // once — not per ball, since it's already the correct final total.
      // Guest: accumulate locally, same as every other game page.
      let total = 0;
      results.forEach(r => {
        total += r.profit;
        if (data.balance === undefined) applyProfit(r.profit);
        setHistory(h => [{ multiplier: r.multiplier, profit: r.profit }, ...h].slice(0, 40));
      });
      if (data.balance !== undefined) syncBalance(data.balance);
      totalProfitRef.current = total;
      setLastResult(results[results.length - 1]);

      // Build a waypoint chain per ball and prime its first hop.
      // A light per-ball delay staggers simultaneous drops into a cascade.
      ballsRef.current = results.map((r, i) => {
        const { waypoints, bucketIndex } = buildWaypoints(r.path, rows);
        const ball: PhysBall = {
          waypoints,
          seg: 0,
          segFrame: 0,
          segDuration: 1,
          ax: waypoints[0].x,
          ay: waypoints[0].y,
          vx: 0,
          vy0: 0,
          x: waypoints[0].x,
          y: waypoints[0].y,
          delay: Math.min(i * 2, 120),
          bucketIndex,
          landed: false,
        };
        // Initial drop into the apex has no bounce kick.
        setupHop(ball, waypoints[0], waypoints[1], 0);
        return ball;
      });

    } catch {
      setDropping(false);
    }
  }, [betAmount, ballCount, balance, rows, risk, dropping, applyProfit, syncBalance, clientSeed]);

  const totalBet = (betAmount * ballCount) / 100;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <CircleDot className="text-purple-400" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Plinko</h1>
          <p className="text-xs text-[var(--muted)]">Drop balls · Physics simulation · Land on a multiplier</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Board */}
        <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2 overflow-hidden">
          <PlinkoBoard
            rows={rows}
            risk={risk}
            ballsRef={ballsRef}
            running={dropping}
            onAllLanded={handleAllLanded}
          />

          <div className="min-h-[24px] text-center py-1">
            {dropping && (
              <p className="text-xs text-[var(--muted)] animate-pulse">
                {ballCount > 1 ? `${ballCount} balls dropping…` : "Dropping…"}
              </p>
            )}
            {!dropping && sessionProfit !== null && (
              <p className={cn("text-sm font-black", sessionProfit >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]")}>
                {ballCount > 1 ? `${ballCount} balls · ` : ""}
                {sessionProfit >= 0 ? "+" : ""}${(sessionProfit / 100).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="lg:w-64 space-y-3">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
            {/* Rows */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Rows</label>
              <div className="flex gap-1.5">
                {ROWS_OPTIONS.map(r => (
                  <button key={r}
                    onClick={() => { setRows(r); ballsRef.current = []; }}
                    disabled={dropping}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-bold transition-all",
                      rows === r
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                        : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Risk</label>
              <div className="flex gap-1.5">
                {RISK_OPTIONS.map(r => (
                  <button key={r}
                    onClick={() => setRisk(r)}
                    disabled={dropping}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-xs font-bold capitalize transition-all",
                      risk === r
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                        : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Ball count */}
            <div className="space-y-1.5">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Balls</label>
              <div className="grid grid-cols-3 gap-1.5">
                {BALL_COUNT_OPTIONS.map(n => (
                  <button key={n}
                    onClick={() => setBallCount(n as typeof ballCount)}
                    disabled={dropping}
                    className={cn(
                      "py-1.5 rounded-lg border text-xs font-bold transition-all",
                      ballCount === n
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_14px_rgba(139,92,246,0.3)]"
                        : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <BetInput value={betAmount} onChange={setBetAmount} disabled={dropping} />

            {ballCount > 1 && (
              <p className="text-xs text-[var(--muted)] text-center -mt-1">
                Total: <span className="text-[var(--text)] font-semibold">${totalBet.toFixed(2)}</span>
              </p>
            )}

            <button
              onClick={drop}
              disabled={dropping || betAmount * ballCount > balance}
              className={cn(
                "w-full py-3 rounded-xl font-black text-base transition-all",
                "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
                "shadow-[0_0_25px_rgba(139,92,246,0.2)] hover:shadow-[0_0_35px_rgba(139,92,246,0.4)]",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {dropping ? "Dropping…" : ballCount === 1 ? "Drop Ball" : `Drop ${ballCount} Balls`}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 space-y-2">
              <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">History</p>
              <div className="flex flex-wrap gap-1">
                {history.map((h, i) => (
                  <span key={i}
                    className="px-2 py-0.5 rounded text-[10px] font-bold border"
                    style={{ background: mFill(h.multiplier), color: mText(h.multiplier), borderColor: mStroke(h.multiplier) }}
                  >
                    {h.multiplier}×
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Provably fair */}
      {lastResult && (
        <details className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-[var(--text)] hover:text-[var(--accent)]">
            Provably Fair {ballCount > 1 ? "— Last Ball" : "Verification"}
          </summary>
          <div className="mt-3 space-y-1.5 font-mono break-all text-[var(--muted)]">
            <ServerSeedRow serverSeed={lastResult.serverSeed} />
            <div><span>Hash: </span><span className="text-[var(--text)]">{lastResult.serverSeedHash}</span></div>
            <div><span>Client Seed: </span><span className="text-[var(--text)]">{lastResult.clientSeed}</span></div>
            <div><span>Nonce: </span><span className="text-[var(--text)]">{lastResult.nonce}</span></div>
            <div><span>Path: </span><span className="text-[var(--text)]">{lastResult.path.join("")}</span></div>
          </div>
        </details>
      )}
    </div>
  );
}
