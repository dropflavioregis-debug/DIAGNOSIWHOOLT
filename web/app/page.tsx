import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-background-primary)] p-6">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">EV Diagnostic System</h1>
      <p className="max-w-md text-center text-sm text-[var(--color-text-secondary)]">
        Sistema open source per diagnostica universale auto elettriche (Renault, PSA, Tesla, Hyundai/Kia, VW MEB, Nissan Leaf, ecc.) tramite ESP32-S3 + SN65HVD230.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-[#1D9E75] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Apri dashboard
      </Link>
    </main>
  );
}
