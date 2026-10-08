"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/cn";

export default function RegisterPage() {
  const router = useRouter();
  const { startingBalance } = useSettings();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = username.trim().length >= 3 && email.includes("@") && password.length >= 8 && passwordsMatch;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, startingBalance }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Registration failed.");
        return;
      }
      router.push("/login?registered=1");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]">
          <UserPlus size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--text)]">Create Account</h1>
          <p className="text-sm text-[var(--muted)]">Persist your balance and bet history across devices.</p>
        </div>
      </div>

      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
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
            autoComplete="username"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
          <p className="text-[10px] text-[var(--muted)]">At least 8 characters.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoComplete="new-password"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-[10px] text-red-400">Passwords don&apos;t match.</p>
          )}
        </div>

        <button
          onClick={submit}
          disabled={submitting || !canSubmit}
          className={cn("w-full py-2.5 rounded-lg font-bold text-sm transition-all",
            "bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.99]",
            "disabled:opacity-30 disabled:cursor-not-allowed")}
        >
          {submitting ? "Creating…" : "Create Account"}
        </button>
      </section>

      <p className="text-center text-xs text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent-2)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
