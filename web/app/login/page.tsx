"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, from }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Errore di accesso");
        return;
      }
      router.push(data.redirect ?? from);
      router.refresh();
    } catch {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-background-primary)] p-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
        Accesso protetto
      </h1>
      <p className="max-w-md text-center text-sm text-[var(--color-text-secondary)]">
        Inserisci la password per accedere all&apos;applicazione.
      </p>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-4"
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-4 py-2.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[#1D9E75] focus:outline-none focus:ring-1 focus:ring-[#1D9E75]"
          disabled={loading}
        />
        {error && (
          <p className="text-sm text-[var(--color-text-danger)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#1D9E75] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Accesso..." : "Accedi"}
        </button>
      </form>
    </main>
  );
}
