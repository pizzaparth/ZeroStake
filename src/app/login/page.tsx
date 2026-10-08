"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/cn";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const res = await signIn("credentials", { redirect: false, username: username.trim(), password });
    setSubmitting(false);
    if (res?.error) {
      setError(res.code === "rate_limited" ? "Too many sign-in attempts. Try again in a few minutes." : "Invalid username or password.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="max-w-sm mx-auto mt-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]">
          <LogIn size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--text)]">Log In</h1>
          <p className="text-sm text-[var(--muted)]">Your balance and history follow your account.</p>
        </div>
      </div>

      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        {justRegistered && (
          <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
            Account created — log in below.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="username"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="current-password"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          onClick={submit}
          disabled={submitting || !username.trim() || !password}
          className={cn("w-full py-2.5 rounded-lg font-bold text-sm transition-all",
            "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
            "disabled:opacity-30 disabled:cursor-not-allowed")}
        >
          {submitting ? "Logging in…" : "Log In"}
        </button>
      </section>

      <p className="text-center text-xs text-[var(--muted)]">
        No account?{" "}
        <Link href="/register" className="text-[var(--accent-2)] hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
