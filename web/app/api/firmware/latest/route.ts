import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isVersionAtLeast, logDeviceUpdateEvent } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

const FIRMWARE_VERSION = process.env.FIRMWARE_VERSION ?? "1.0.0";
const FIRMWARE_BINARY_URL = process.env.FIRMWARE_BINARY_URL ?? "";
const FIRMWARE_MD5 = process.env.FIRMWARE_MD5 ?? "";
const FIRMWARE_CHANNEL = process.env.FIRMWARE_CHANNEL ?? "stable";
const FIRMWARE_MIN_SUPPORTED_VERSION = process.env.FIRMWARE_MIN_SUPPORTED_VERSION ?? "1.0.0";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deviceId = (searchParams.get("device_id") ?? "").trim();
  const deviceVersion = (searchParams.get("current_version") ?? "").trim();
  const channel = (searchParams.get("channel") ?? FIRMWARE_CHANNEL).trim();

  const supabase = getSupabase();
  if (supabase) {
    const { data: rules } = await supabase
      .from("firmware_rollout_rules")
      .select("target_version, binary_url, binary_md5, min_supported_version, rollout_group, allow_auto, allowlist_devices, metadata")
      .eq("channel", channel)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rules && typeof rules.binary_url === "string" && rules.binary_url.length > 0) {
      const allowlist = Array.isArray(rules.allowlist_devices) ? rules.allowlist_devices : [];
      const isAllowlisted = deviceId.length > 0 && allowlist.includes(deviceId);
      const minSupported = typeof rules.min_supported_version === "string" && rules.min_supported_version.length > 0
        ? rules.min_supported_version
        : FIRMWARE_MIN_SUPPORTED_VERSION;
      const compatible = deviceVersion ? isVersionAtLeast(deviceVersion, minSupported) : true;
      if (deviceId) {
        await logDeviceUpdateEvent(deviceId, "manifest_requested", compatible ? "ok" : "blocked", rules.target_version ?? null, {
          channel,
          min_supported_version: minSupported,
          is_allowlisted: isAllowlisted,
        });
      }
      return NextResponse.json({
        version: rules.target_version ?? FIRMWARE_VERSION,
        url: rules.binary_url,
        md5: rules.binary_md5 ?? null,
        channel,
        min_supported_version: minSupported,
        rollout_group: rules.rollout_group ?? null,
        auto_approved: Boolean(rules.allow_auto) && isAllowlisted,
        compatible,
        metadata: rules.metadata ?? {},
        build: process.env.FIRMWARE_BUILD ?? undefined,
      });
    }
  }

  return NextResponse.json({
    version: FIRMWARE_VERSION,
    url: FIRMWARE_BINARY_URL,
    md5: FIRMWARE_MD5 || null,
    channel: FIRMWARE_CHANNEL,
    min_supported_version: FIRMWARE_MIN_SUPPORTED_VERSION,
    rollout_group: null,
    auto_approved: false,
    compatible: true,
    metadata: {},
    build: process.env.FIRMWARE_BUILD ?? undefined,
  });
}
