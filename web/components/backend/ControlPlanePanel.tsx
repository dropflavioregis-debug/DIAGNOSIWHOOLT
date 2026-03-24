"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/common/SectionCard";

type Profile = { id: string; name: string; category: string };

export function ControlPlanePanel() {
  const [devices, setDevices] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string>("");

  const [rolloutChannel, setRolloutChannel] = useState("stable");
  const [rolloutVersion, setRolloutVersion] = useState("");
  const [rolloutUrl, setRolloutUrl] = useState("");
  const [rolloutMd5, setRolloutMd5] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [allowAuto, setAllowAuto] = useState(false);

  const [assignDevice, setAssignDevice] = useState("");
  const [assignProfile, setAssignProfile] = useState("");

  useEffect(() => {
    void (async () => {
      const [devRes, profileRes] = await Promise.all([
        fetch("/api/device/commands").then((r) => r.json()),
        fetch("/api/protocol-profiles").then((r) => r.json()),
      ]);
      const devList = Array.isArray(devRes.devices) ? devRes.devices : [];
      const profileListRaw = Array.isArray(profileRes.profiles) ? profileRes.profiles : [];
      const profileList: Profile[] = profileListRaw
        .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
        .map((p) => ({ id: p.id, name: p.name, category: typeof p.category === "string" ? p.category : "generic" }));
      setDevices(devList);
      setProfiles(profileList);
      setAssignDevice(devList[0] ?? "");
      setAssignProfile(profileList[0]?.id ?? "");
    })();
  }, []);

  async function saveRolloutRule() {
    setMessage("");
    const allowlistDevices = allowlist
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    const res = await fetch("/api/firmware/rollout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: rolloutChannel,
        rollout_mode: allowAuto ? "hybrid" : "manual",
        allow_auto: allowAuto,
        allowlist_devices: allowlistDevices,
        target_version: rolloutVersion,
        binary_url: rolloutUrl,
        binary_md5: rolloutMd5 || null,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setMessage(data.ok ? "Regola rollout salvata." : data.error ?? "Errore salvataggio rollout.");
  }

  async function assignProtocolProfile() {
    setMessage("");
    if (!assignDevice || !assignProfile) {
      setMessage("Seleziona device e profilo.");
      return;
    }
    const res = await fetch("/api/protocol-profiles/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: assignDevice,
        profile_id: assignProfile,
        channel: rolloutChannel,
        auto_apply: true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setMessage(data.ok ? "Profilo assegnato al device." : data.error ?? "Errore assegnazione profilo.");
  }

  return (
    <SectionCard title="Control Plane OTA e Profili">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--color-border-tertiary)] p-3">
          <div className="mb-2 text-xs font-medium text-[var(--color-text-primary)]">Rollout firmware (ibrido)</div>
          <div className="space-y-2 text-xs">
            <input value={rolloutChannel} onChange={(e) => setRolloutChannel(e.target.value)} placeholder="channel" className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5" />
            <input value={rolloutVersion} onChange={(e) => setRolloutVersion(e.target.value)} placeholder="target version (es. 1.1.0)" className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5" />
            <input value={rolloutUrl} onChange={(e) => setRolloutUrl(e.target.value)} placeholder="binary url" className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5" />
            <input value={rolloutMd5} onChange={(e) => setRolloutMd5(e.target.value)} placeholder="binary md5 (opzionale)" className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5" />
            <input value={allowlist} onChange={(e) => setAllowlist(e.target.value)} placeholder="allowlist device_id (comma-separated)" className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5" />
            <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={allowAuto} onChange={(e) => setAllowAuto(e.target.checked)} />
              Auto rollout su allowlist (manuale default)
            </label>
            <button type="button" onClick={saveRolloutRule} className="rounded-md border border-[var(--color-border-secondary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]">
              Salva regola rollout
            </button>
          </div>
        </div>

        <div className="rounded-md border border-[var(--color-border-tertiary)] p-3">
          <div className="mb-2 text-xs font-medium text-[var(--color-text-primary)]">Assegna protocol profile</div>
          <div className="space-y-2 text-xs">
            <select value={assignDevice} onChange={(e) => setAssignDevice(e.target.value)} className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5">
              {devices.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={assignProfile} onChange={(e) => setAssignProfile(e.target.value)} className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1.5">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
              ))}
            </select>
            <button type="button" onClick={assignProtocolProfile} className="rounded-md border border-[var(--color-border-secondary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]">
              Assegna profilo al device
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-3 text-[11px] text-[var(--color-text-secondary)]">{message}</p>
      )}
    </SectionCard>
  );
}
