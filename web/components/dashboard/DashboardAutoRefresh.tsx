"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 22_000;

/** Ricarica i dati server (metriche, DTC, letture) mentre la scheda è visibile — complementare al polling CAN sniffer. */
export function DashboardAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
