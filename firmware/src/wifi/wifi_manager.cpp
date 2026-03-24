#include "wifi_manager.h"
#include "config/config.h"
#include "config/nvs_config.h"
#include "session_state.h"
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <cstdio>
#include <cstring>

namespace ev_diag {

static WebServer* s_server = nullptr;
static DNSServer* s_dns = nullptr;
static WebServer* s_reconfigureServer = nullptr;
static bool s_apMode = false;
static const size_t LOG_LINES_MAX = 80;
static char s_logLines[LOG_LINES_MAX][128];
static size_t s_logHead = 0;
static size_t s_logCount = 0;

struct RuntimeStatus {
  bool canStarted;
  bool snifferActive;
  bool lastIngestOk;
  uint32_t lastIngestAgeMs;
  uint32_t rxFramesTotal;
  uint32_t rxFramesPerSec;
  uint32_t lastRxAgeMs;
  uint32_t lastCanId;
  uint8_t lastCanDlc;
  uint32_t busOffCount;
  uint32_t rxQueueOverflowCount;
  uint32_t canRestartCount;
  int activeBitrateKbps;
  char sessionId[64];
  char vehicleId[64];
  char lastCanError[96];
  char lastProbeSummary[160];
};

static RuntimeStatus s_runtime = {
  false, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "", "", "", ""
};
// Keep large HTTP response buffers out of loopTask stack.
static char s_reconfigurePageBuf[4600];
static char s_statusJsonBuf[8192];
static void handleStatusJson();

static void getMacSuffix(char* out, size_t len) {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  if (len >= 5)
    snprintf(out, len, "%02X%02X", mac[4], mac[5]);
  else
    out[0] = '\0';
}

bool wifiConnectSTA(const NvsConfig& cfg) {
  if (cfg.wifi_ssid[0] == '\0') return false;
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.mode(WIFI_STA);
  WiFi.begin(cfg.wifi_ssid, cfg.wifi_password);

  const unsigned long start = millis();
  const unsigned long timeout = 15000;
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < timeout) {
    delay(200);
  }
  return WiFi.status() == WL_CONNECTED;
}

bool wifiIsConnected() {
  return WiFi.status() == WL_CONNECTED;
}

void wifiDisconnect() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  s_apMode = false;
}

static const char* CONFIG_HTML = R"raw(
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EV-Diagnostic Config</title></head>
<body><h1>EV-Diagnostic</h1><form method="POST" action="/save">
<label>WiFi SSID <input name="ssid" type="text" required></label><br>
<label>Password <input name="pass" type="password"></label><br>
<label>Server URL <input name="server" type="url" placeholder="https://..."></label><br>
<label>API Key <input name="apikey" type="text"></label><br>
<label>Device name <input name="device" type="text" placeholder="EV-Diag-01"></label><br>
<button type="submit">Save and restart</button></form></body></html>
)raw";

static void handleRoot() {
  if (s_server) s_server->send(200, "text/html", CONFIG_HTML);
}

static void handleSave() {
  if (!s_server) return;
  if (s_server->method() != HTTP_POST) {
    s_server->send(405, "text/plain", "Method Not Allowed");
    return;
  }

  NvsConfig cfg = {};
  cfg.can_speed_kbps = config::CAN_SPEED_Kbps_DEFAULT;

  if (s_server->hasArg("ssid"))
    strncpy(cfg.wifi_ssid, s_server->arg("ssid").c_str(), sizeof(cfg.wifi_ssid) - 1);
  if (s_server->hasArg("pass"))
    strncpy(cfg.wifi_password, s_server->arg("pass").c_str(), sizeof(cfg.wifi_password) - 1);
  if (s_server->hasArg("server"))
    strncpy(cfg.server_url, s_server->arg("server").c_str(), sizeof(cfg.server_url) - 1);
  if (s_server->hasArg("apikey"))
    strncpy(cfg.api_key, s_server->arg("apikey").c_str(), sizeof(cfg.api_key) - 1);
  if (s_server->hasArg("device"))
    strncpy(cfg.device_name, s_server->arg("device").c_str(), sizeof(cfg.device_name) - 1);
  if (cfg.device_name[0] == '\0')
    strncpy(cfg.device_name, "EV-Diag-01", sizeof(cfg.device_name) - 1);

  if (configSave(cfg)) {
    s_server->send(200, "text/html",
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><p>Config saved. Restarting...</p></body></html>");
    delay(500);
    ESP.restart();
  } else {
    s_server->send(500, "text/plain", "Save failed");
  }
}

void wifiStartAPAndCaptivePortal() {
  WiFi.mode(WIFI_AP);
  char suffix[8];
  getMacSuffix(suffix, sizeof(suffix));
  char ssid[32];
  snprintf(ssid, sizeof(ssid), "%s-%s", config::AP_SSID_PREFIX, suffix);

  WiFi.softAP(ssid, config::AP_PASSWORD, config::AP_CHANNEL, false, config::AP_MAX_CONNECTIONS);
  delay(100);
  IPAddress apIp(192, 168, 4, 1);
  WiFi.softAPConfig(apIp, apIp, IPAddress(255, 255, 255, 0));

  s_dns = new DNSServer();
  s_dns->start(53, "*", apIp);

  s_server = new WebServer(80);
  s_server->on("/", handleRoot);
  s_server->on("/status.json", HTTP_GET, handleStatusJson);
  s_server->on("/save", HTTP_POST, handleSave);
  s_server->onNotFound([]() {
    if (s_server) s_server->sendHeader("Location", "http://192.168.4.1/", true);
    if (s_server) s_server->send(302, "text/plain", "");
  });
  s_server->begin();
  s_apMode = true;
}

static const char RECONFIGURE_HTML[] =
  "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>EV-Diagnostic</title></head>"
  "<body><h1>EV-Diagnostic</h1><p>Dispositivo connesso. IP: %s</p>"
  "<form method=\"POST\" action=\"/start-session\" style=\"margin-bottom:1em\">"
  "<button type=\"submit\">Avvia connessione con il veicolo</button></form>"
  "<p><small>Collega il cavo OBD2 all&apos;auto e clicca il pulsante sopra per avviare una nuova sessione diagnostica. I dati appariranno nella dashboard.</small></p>"
  "<hr style=\"margin:1em 0\">"
  "<h3 style=\"margin:0 0 .5em 0\">Stato runtime</h3>"
  "<div id=\"statusBox\" style=\"font-family:monospace;font-size:12px;white-space:pre-wrap;background:#f4f4f4;border:1px solid #ddd;padding:.6em;border-radius:6px;margin-bottom:1em\">Caricamento stato...</div>"
  "<h3 style=\"margin:0 0 .5em 0\">Log completo dispositivo</h3>"
  "<div id=\"logBox\" style=\"font-family:monospace;font-size:12px;white-space:pre-wrap;background:#111;color:#d7ffd7;border:1px solid #333;padding:.6em;border-radius:6px;max-height:280px;overflow:auto\">Caricamento log...</div>"
  "<hr style=\"margin:1em 0\">"
  "<form method=\"POST\" action=\"/reconfigure\">"
  "<button type=\"submit\">Apri configurazione (WiFi / Server / API key)</button></form>"
  "<p><small>Il dispositivo si riavvierà in hotspot EV-Diagnostic-XXXX. Connettiti e apri <strong>http://192.168.4.1</strong></small></p>"
  "<script>"
  "async function refreshStatus(){"
  "try{"
  "const r=await fetch('/status.json',{cache:'no-store'});"
  "const d=await r.json();"
  "if(!d||!d.ok){throw new Error('status');}"
  "const lines=["
  "'wifi_connected: '+d.wifi_connected,"
  "'rssi: '+d.rssi,"
  "'can_started: '+d.can_started,"
  "'sniffer_active: '+d.sniffer_active,"
  "'last_ingest_ok: '+d.last_ingest_ok,"
  "'last_ingest_age_ms: '+d.last_ingest_age_ms,"
  "'active_bitrate_kbps: '+d.active_bitrate_kbps,"
  "'rx_frames_total: '+d.rx_frames_total,"
  "'rx_frames_per_sec: '+d.rx_frames_per_sec,"
  "'last_rx_age_ms: '+d.last_rx_age_ms,"
  "'last_can_id: '+d.last_can_id,"
  "'last_can_dlc: '+d.last_can_dlc,"
  "'bus_off_count: '+d.bus_off_count,"
  "'rx_queue_overflow_count: '+d.rx_queue_overflow_count,"
  "'can_restart_count: '+d.can_restart_count,"
  "'last_can_error: '+(d.last_can_error||'-'),"
  "'last_probe_summary: '+(d.last_probe_summary||'-'),"
  "'session_id: '+(d.session_id||'-'),"
  "'vehicle_id: '+(d.vehicle_id||'-')"
  "];"
  "document.getElementById('statusBox').textContent=lines.join('\\n');"
  "const logs=(d.logs||[]);"
  "document.getElementById('logBox').textContent=logs.length?logs.join('\\n'):'Nessun log ancora disponibile.';"
  "}catch(e){"
  "document.getElementById('statusBox').textContent='Errore lettura stato';"
  "}"
  "}"
  "refreshStatus();"
  "setInterval(refreshStatus,1000);"
  "</script>"
  "</body></html>";

static void handleReconfigurePage() {
  if (!s_reconfigureServer) return;
  snprintf(s_reconfigurePageBuf, sizeof(s_reconfigurePageBuf), RECONFIGURE_HTML, WiFi.localIP().toString().c_str());
  s_reconfigureServer->send(200, "text/html", s_reconfigurePageBuf);
}

static void appendLogLine(const char* message) {
  if (!message || message[0] == '\0') return;
  unsigned long nowSec = millis() / 1000UL;
  size_t idx = s_logHead;
  char cleaned[96];
  size_t j = 0;
  for (size_t i = 0; message[i] != '\0' && j < sizeof(cleaned) - 1; i++) {
    char c = message[i];
    cleaned[j++] = (c == '"' || c == '\\') ? '\'' : c;
  }
  cleaned[j] = '\0';
  snprintf(s_logLines[idx], sizeof(s_logLines[idx]), "[%lus] %s", nowSec, cleaned);
  s_logHead = (s_logHead + 1) % LOG_LINES_MAX;
  if (s_logCount < LOG_LINES_MAX) s_logCount++;
}

static void sendStatusJson(WebServer* server) {
  if (!server) return;
  char* p = s_statusJsonBuf;
  size_t rem = sizeof(s_statusJsonBuf);
  int n = snprintf(
    p, rem,
    "{\"ok\":true,\"ip\":\"%s\",\"wifi_connected\":%s,\"rssi\":%d,"
    "\"can_started\":%s,\"sniffer_active\":%s,\"last_ingest_ok\":%s,\"last_ingest_age_ms\":%lu,"
    "\"active_bitrate_kbps\":%d,\"rx_frames_total\":%lu,\"rx_frames_per_sec\":%lu,"
    "\"last_rx_age_ms\":%lu,\"last_can_id\":%lu,\"last_can_dlc\":%u,"
    "\"bus_off_count\":%lu,\"rx_queue_overflow_count\":%lu,\"can_restart_count\":%lu,"
    "\"last_can_error\":\"%s\",\"last_probe_summary\":\"%s\","
    "\"session_id\":\"%s\",\"vehicle_id\":\"%s\",\"logs\":[",
    WiFi.localIP().toString().c_str(),
    (WiFi.status() == WL_CONNECTED) ? "true" : "false",
    (int)WiFi.RSSI(),
    s_runtime.canStarted ? "true" : "false",
    s_runtime.snifferActive ? "true" : "false",
    s_runtime.lastIngestOk ? "true" : "false",
    (unsigned long)s_runtime.lastIngestAgeMs,
    s_runtime.activeBitrateKbps,
    (unsigned long)s_runtime.rxFramesTotal,
    (unsigned long)s_runtime.rxFramesPerSec,
    (unsigned long)s_runtime.lastRxAgeMs,
    (unsigned long)s_runtime.lastCanId,
    (unsigned)s_runtime.lastCanDlc,
    (unsigned long)s_runtime.busOffCount,
    (unsigned long)s_runtime.rxQueueOverflowCount,
    (unsigned long)s_runtime.canRestartCount,
    s_runtime.lastCanError,
    s_runtime.lastProbeSummary,
    s_runtime.sessionId,
    s_runtime.vehicleId
  );
  if (n < 0 || (size_t)n >= rem) {
    server->send(500, "application/json", "{\"ok\":false}");
    return;
  }
  p += n;
  rem -= (size_t)n;
  for (size_t i = 0; i < s_logCount; i++) {
    size_t idx = (s_logHead + LOG_LINES_MAX - s_logCount + i) % LOG_LINES_MAX;
    const char* line = s_logLines[idx];
    n = snprintf(p, rem, "%s\"%s\"", (i == 0) ? "" : ",", line);
    if (n < 0 || (size_t)n >= rem) break;
    p += n;
    rem -= (size_t)n;
  }
  n = snprintf(p, rem, "]}");
  if (n < 0 || (size_t)n >= rem) {
    server->send(500, "application/json", "{\"ok\":false}");
    return;
  }
  server->sendHeader("Cache-Control", "no-store");
  server->send(200, "application/json", s_statusJsonBuf);
}

static void handleStatusJson() {
  if (s_reconfigureServer) {
    sendStatusJson(s_reconfigureServer);
    return;
  }
  if (s_server) {
    sendStatusJson(s_server);
  }
}

static void handleStartSession() {
  if (!s_reconfigureServer) return;
  if (s_reconfigureServer->method() != HTTP_POST) {
    s_reconfigureServer->send(405, "text/plain", "Method Not Allowed");
    return;
  }
  sessionForceNew();
  s_reconfigureServer->send(200, "text/html",
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body>"
    "<p>Connessione con il veicolo avviata. La prossima trasmissione creer&agrave; una nuova sessione nella dashboard.</p>"
    "<p><a href=\"/\">Torna alla pagina principale</a></p></body></html>");
}

static void handleReconfigure() {
  if (!s_reconfigureServer) return;
  if (s_reconfigureServer->method() != HTTP_POST) {
    s_reconfigureServer->send(405, "text/plain", "Method Not Allowed");
    return;
  }
  if (configClearWifi()) {
    s_reconfigureServer->send(200, "text/html",
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><p>Riavvio in modalit&agrave; configurazione...</p></body></html>");
    delay(800);
    ESP.restart();
  } else {
    s_reconfigureServer->send(500, "text/plain", "Clear failed");
  }
}

void wifiStartReconfigureServer() {
  if (s_reconfigureServer) return;
  s_reconfigureServer = new WebServer(80);
  s_reconfigureServer->on("/", handleReconfigurePage);
  s_reconfigureServer->on("/status.json", HTTP_GET, handleStatusJson);
  s_reconfigureServer->on("/start-session", HTTP_POST, handleStartSession);
  s_reconfigureServer->on("/reconfigure", HTTP_POST, handleReconfigure);
  s_reconfigureServer->begin();
  appendLogLine("HTTP reconfigure server started");
}

void wifiReconfigureLoop() {
  if (s_reconfigureServer) s_reconfigureServer->handleClient();
}

bool wifiManagerLoop() {
  if (s_apMode && s_dns) s_dns->processNextRequest();
  if (s_apMode && s_server) s_server->handleClient();
  return s_apMode;
}

void wifiSetRuntimeStatus(
  bool canStarted,
  bool snifferActive,
  const char* sessionId,
  const char* vehicleId,
  bool lastIngestOk,
  uint32_t lastIngestAgeMs,
  uint32_t rxFramesTotal,
  uint32_t rxFramesPerSec,
  uint32_t lastRxAgeMs,
  uint32_t lastCanId,
  uint8_t lastCanDlc,
  uint32_t busOffCount,
  uint32_t rxQueueOverflowCount,
  uint32_t canRestartCount,
  int activeBitrateKbps,
  const char* lastCanError,
  const char* lastProbeSummary
) {
  s_runtime.canStarted = canStarted;
  s_runtime.snifferActive = snifferActive;
  s_runtime.lastIngestOk = lastIngestOk;
  s_runtime.lastIngestAgeMs = lastIngestAgeMs;
  s_runtime.rxFramesTotal = rxFramesTotal;
  s_runtime.rxFramesPerSec = rxFramesPerSec;
  s_runtime.lastRxAgeMs = lastRxAgeMs;
  s_runtime.lastCanId = lastCanId;
  s_runtime.lastCanDlc = lastCanDlc;
  s_runtime.busOffCount = busOffCount;
  s_runtime.rxQueueOverflowCount = rxQueueOverflowCount;
  s_runtime.canRestartCount = canRestartCount;
  s_runtime.activeBitrateKbps = activeBitrateKbps;
  if (sessionId) {
    strncpy(s_runtime.sessionId, sessionId, sizeof(s_runtime.sessionId) - 1);
    s_runtime.sessionId[sizeof(s_runtime.sessionId) - 1] = '\0';
  } else {
    s_runtime.sessionId[0] = '\0';
  }
  if (vehicleId) {
    strncpy(s_runtime.vehicleId, vehicleId, sizeof(s_runtime.vehicleId) - 1);
    s_runtime.vehicleId[sizeof(s_runtime.vehicleId) - 1] = '\0';
  } else {
    s_runtime.vehicleId[0] = '\0';
  }
  if (lastCanError) {
    strncpy(s_runtime.lastCanError, lastCanError, sizeof(s_runtime.lastCanError) - 1);
    s_runtime.lastCanError[sizeof(s_runtime.lastCanError) - 1] = '\0';
  } else {
    s_runtime.lastCanError[0] = '\0';
  }
  if (lastProbeSummary) {
    strncpy(s_runtime.lastProbeSummary, lastProbeSummary, sizeof(s_runtime.lastProbeSummary) - 1);
    s_runtime.lastProbeSummary[sizeof(s_runtime.lastProbeSummary) - 1] = '\0';
  } else {
    s_runtime.lastProbeSummary[0] = '\0';
  }
}

void wifiLogEvent(const char* message) {
  appendLogLine(message);
}

}  // namespace ev_diag
