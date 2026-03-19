#include "wifi_manager.h"
#include "config/config.h"
#include "config/nvs_config.h"
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
  "<form method=\"POST\" action=\"/reconfigure\">"
  "<button type=\"submit\">Apri configurazione (WiFi / Server / API key)</button></form>"
  "<p><small>Il dispositivo si riavvierà in hotspot EV-Diagnostic-XXXX. Connettiti e apri <strong>http://192.168.4.1</strong></small></p>"
  "</body></html>";

static void handleReconfigurePage() {
  if (!s_reconfigureServer) return;
  char buf[640];
  snprintf(buf, sizeof(buf), RECONFIGURE_HTML, WiFi.localIP().toString().c_str());
  s_reconfigureServer->send(200, "text/html", buf);
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
  s_reconfigureServer->on("/reconfigure", HTTP_POST, handleReconfigure);
  s_reconfigureServer->begin();
}

void wifiReconfigureLoop() {
  if (s_reconfigureServer) s_reconfigureServer->handleClient();
}

bool wifiManagerLoop() {
  if (s_apMode && s_dns) s_dns->processNextRequest();
  if (s_apMode && s_server) s_server->handleClient();
  return s_apMode;
}

}  // namespace ev_diag
