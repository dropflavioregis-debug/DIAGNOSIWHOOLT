"use client";

import { useEffect, useState } from "react";
import type { VehicleInfo } from "@/lib/types";
import { VehicleStrip } from "@/components/dashboard/VehicleStrip";
import { getDashboardLiveSnapshot } from "@/app/actions/dashboard-live";
import { formatLastDataItaliano } from "@/lib/dashboard-live";

const POLL_MS = 12_000;

interface LiveVehicleStripProps {
  initialVehicle: VehicleInfo;
}

export function LiveVehicleStrip({ initialVehicle }: LiveVehicleStripProps) {
  const [vehicle, setVehicle] = useState<VehicleInfo>(initialVehicle);

  useEffect(() => {
    setVehicle(initialVehicle);
  }, [initialVehicle]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const snap = await getDashboardLiveSnapshot();
      if (cancelled || !snap.ok) return;
      setVehicle((prev) => ({
        ...prev,
        connectionStatus: snap.connectionStatus,
        connected: snap.connectionStatus === "live",
        liveSubtitle: snap.lastDataAt
          ? `Ultimo dato: ${formatLastDataItaliano(new Date(snap.lastDataAt))}`
          : snap.connectionStatus === "pending"
            ? "In attesa del primo dato dal dispositivo…"
            : snap.connectionStatus === "offline"
              ? "Nessun dato negli ultimi 60 s (veicolo o bus CAN inattivo)"
              : undefined,
      }));
    }

    const id = window.setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return <VehicleStrip vehicle={vehicle} />;
}
