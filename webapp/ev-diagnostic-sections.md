# EV Diagnostic System — Documentazione sezioni webapp

> Sistema open source per diagnostica universale auto elettriche (Renault, PSA/Stellantis, Tesla, Hyundai/Kia, VW MEB, Nissan Leaf, ecc.) tramite ESP32-S3 + SN65HVD230, con backend su Vercel + Supabase e AI (Claude API) per analisi in linguaggio naturale.

---

## 📊 Dashboard

La dashboard mostra 4 metriche in tempo reale (SOC, SOH, temperatura, tensione), la griglia delle 96 celle della batteria con colori per temperatura, la lista DTC con severità, e il pannello AI con analisi Claude già formattata in italiano.

**Stack:** Next.js 14 + Tailwind + Recharts per i grafici + Supabase Realtime per gli aggiornamenti live. L'ESP32 fa POST ogni secondo all'endpoint `/api/ingest`, Supabase notifica la webapp via websocket, la pagina si aggiorna senza refresh.

---

## 🔋 Batteria

Le 4 metriche in cima (SOC, SOH, temperatura massima, tensione pack) vengono lette dall'ESP32 con tre chiamate UDS separate: DID `0x2002` per il SOC, `0x2006` per SOH, e `0x4003` per le temperature delle 96 celle in un unico frame ISO-TP multi-segmento.

La mappa termica mostra tutte le 96 celle colorate per temperatura — passa il mouse su una cella per vedere il dettaglio, cliccala per chiedere all'AI se il valore è normale per quel modello.

Il grafico SOH a 24 mesi viene costruito da Supabase aggregando le `battery_readings` storiche — una query con `date_trunc('week', recorded_at)` e `AVG(soh)` produce la curva di degradazione.

### Implementazione

**ESP32 firmware (`battery_reader.cpp`):**
Legge SOC, SOH e temperature celle via UDS SID `0x22`. Loop su DID specifici per modello caricati dal JSON della libreria in SPIFFS. ISO-TP gestisce i frame multi-segmento per le 96 temperature. Dati raw → struttura `BatteryData` → POST a Vercel.

**API Vercel (`/api/battery`):**
Endpoint POST riceve i dati dall'ESP32, li valida con Zod, calcola aggregati (min/max temp, volt delta) e fa insert in Supabase. Endpoint GET restituisce le ultime N letture per la sessione corrente.

**Supabase schema (`battery_readings`):**
Tabella con `soc`, `soh`, `pack_voltage`, `cell_temps` (JSONB array di 96 float), aggregati pre-calcolati (`temp_min`, `temp_max`, `volt_delta`). Indice time-series su `(session_id, recorded_at DESC)`. `REPLICA IDENTITY FULL` per Realtime.

**Hook React (`useRealtimeBattery`):**
Carica ultime letture al mount, poi sottoscrive Supabase Realtime sul canale `battery_readings`. Ogni nuovo insert aggiorna la mappa celle e i grafici senza refresh.

---

## ⚠️ Errori DTC

Il firmware usa `SID 0x19 subfunction 0x02 mask 0xFF` — questo ritorna tutti i DTC indipendentemente dallo stato. La risposta arriva in gruppi da 4 byte: i primi 3 codificano il codice (tipo P/C/B/U + 4 cifre hex secondo ISO 15031-6), il 4° è il byte di stato.

**Il byte di stato è fondamentale:** bit 0 = attivo, bit 5 = in sospeso, bit 6 = confermato, bit 3 = lampeggio MIL. Senza decodificarlo correttamente non si sa se un errore è attuale o storico.

### Implementazione

**ESP32 firmware (`dtc_reader.cpp`):**
Loop su 6–11 indirizzi ECU (da JSON libreria). Ogni ECU: SID `0x19` sub `0x02` mask `0xFF`. Risposta analizzata in gruppi da 4 byte. Timeout 200ms per ECU. Funzione `parseDtcCode()` converte i 3 byte raw nel formato P/C/B/U + 4 cifre. Cancellazione: SID `0x14` con gruppo `0xFFFFFF`.

**API Vercel (`/api/dtc`):**
Riceve array DTC raw dall'ESP32. Arricchisce ogni codice con descrizione dalla tabella `dtc` in Supabase (join per codice). Decodifica `status_byte` in flags booleane (`is_active`, `is_pending`, `is_confirmed`). Se `severity = critical` → trigger automatico Claude API.

**Supabase schema (`dtc_readings`):**
Tabella con `code`, `status_byte`, `ecu_address`, `description_it`, `severity`, `system`, `possible_causes`, flags booleane decodificate, `ai_analysis`. View `active_dtcs` ordinata per severità (critical → warning → info). `REPLICA IDENTITY FULL` per notifiche live.

**Hook React (`useDTCRealtime`):**
Sottoscrive Supabase Realtime su `dtc_readings`. Nuovo DTC critico → banner di allerta immediato + trigger analisi Claude.

---

## 🤖 AI Diagnosi

Il sistema usa Claude API (`claude-sonnet-4-20250514`) per tre tipi di analisi:
1. **Analisi DTC** — risposta JSON strutturata con `urgenza`, `cause_top3`, `azione`, `puoi_guidare` per ogni codice
2. **Chat libera** — risposte in linguaggio naturale basate sul contesto veicolo live
3. **Report fine sessione** — analisi completa di km, consumi, anomalie rilevate

### Trigger automatici

| Trigger | Condizione | Priorità |
|---|---|---|
| DTC critico nuovo | `severity = critical AND NOT was_known` | Immediata |
| SOH sotto soglia | `soh < config.soh_alert_threshold` (default 85%) | Normale |
| Anomalia termica | `temp_max - temp_avg > 3°C` | Normale |
| Fine sessione | `status = completed` | Bassa |

### Implementazione

**Prompt engineering (`claude-prompts.ts`):**
Sistema modulare con `SYSTEM_BASE` condiviso + prompt specifici per tipo di analisi. Il prompt DTC chiede risposta SOLO in JSON con schema fisso. Il prompt chat include contesto veicolo live (SOC, SOH, DTC attivi, trend SOH).

**Streaming (`/api/ai/chat`):**
Forwarding diretto dello stream SSE di Anthropic al browser con `return new Response(anthropicStream.body, {...})`. Nessun buffering su Vercel — la risposta appare carattere per carattere nel client.

**Contesto veicolo (`buildVehicleContext()`):**
Prima di ogni chiamata Claude, assembla da Supabase: ultima lettura batteria, DTC attivi (dalla view), trend SOH ultimi 30 sessioni. Claude riceve dati freschi e specifici al veicolo reale.

**Trigger automatici (`checkTriggers()`):**
Chiamato ad ogni POST dell'ESP32 (`/api/ingest`). Controlla 3 condizioni in parallelo con `Promise.all()`. Lancia analisi Claude solo quando necessario — non ad ogni lettura.

**Supabase schema (`ai_analyses`):**
Tabella con `trigger_type`, `question`, `answer`, `answer_json`, `urgency`, `tokens_used`, `cost_eur`, `vehicle_snapshot` (JSONB contesto al momento dell'analisi). View `monthly_ai_costs` per monitoraggio spesa API mensile.

**Costi stimati:**
- Analisi DTC: ~€0.003 per chiamata
- Report sessione: ~€0.005
- Chat singola: ~€0.0015
- **Totale uso normale: ~€1.80/mese per 100 sessioni**

---

## 📋 Sessioni

Una sessione corrisponde al ciclo di vita completo dal momento in cui l'auto si accende a quando si spegne. L'UUID sessione viene generato sull'ESP32 — questo permette il funzionamento offline con sincronizzazione successiva.

### Ciclo vita sessione

1. **ESP32 rileva ignition on** dal CAN bus (messaggio specifico per modello, es. `0x354` su Renault Zoe)
2. **Genera UUID localmente**, legge SOC e odometro iniziali via UDS
3. **POST `/api/sessions/open`** → Supabase crea riga con `status = active` → Realtime notifica la dashboard
4. **FreeRTOS task separato** legge batteria + DTC ogni 1s e fa POST a `/api/ingest`
5. **Ignition off → POST `/api/sessions/close`** con SOC finale, km percorsi, durata
6. **Server calcola** `kwh_used = (soc_delta/100) * battery_kwh` e `kwh_per_100km`
7. **Trigger automatico** analisi AI Claude per report sessione
8. **Supabase Realtime** notifica dashboard → sessione passa da `active` a `completed`

### Implementazione

**ESP32 (`session_manager.cpp`):**
Classe con metodi `onIgnitionOn()` e `onIgnitionOff()`. UUID generato con `generateUUID()` al boot sessione. Loop di lettura implementato come FreeRTOS task con `xTaskCreate()`. POST asincrono all'apertura per non bloccare l'avvio.

**API Vercel:**
- `POST /api/sessions/open` — crea sessione con ID fornito dall'ESP32
- `POST /api/sessions/close` — aggiorna con statistiche finali, calcola kWh, triggera AI
- `GET /api/sessions` — lista con paginazione cursor-based

**Supabase schema (`sessions`):**
Tabella principale + view `sessions_summary` che aggrega conteggi DTC e letture batteria con un singolo JOIN. Indice parziale `WHERE status = 'completed'` per paginazione veloce. `REPLICA IDENTITY FULL` per aggiornamenti live sullo stato sessione.

**Hook React (`useSessions`):**
Carica ultime 50 sessioni dalla view `sessions_summary`. Sottoscrive Realtime per `INSERT` (nuova sessione → banner live) e `UPDATE` (sessione chiusa → rimuove badge live). Paginazione infinita con cursor sull'ultimo `started_at`.

**Gestione offline:**
Quando WiFi non disponibile, ESP32 bufferizza le letture in SPIFFS o SD card. Al ripristino della connessione, sincronizza tutto in batch con timestamp originali preservati.

---

## 📚 Librerie

Il sistema aggrega segnali UDS (DID + formule di decodifica) da 8 repository GitHub open source, li converte in un formato JSON interno uniforme, li importa in Supabase e li serve agli ESP32 on-demand.

### Sorgenti GitHub

| Repository | Formato | Veicoli coperti | Segnali |
|---|---|---|---|
| OBDb (organizzazione) | JSON signalset v3 | Tutti i brand principali | ~4.820 |
| JejuSoul/OBD-PIDs-for-HKMC-EVs | CSV extendedpids | Hyundai Kona, Kia Niro, Ioniq 5, EV6 | ~2.140 |
| iDoka/awesome-automotive-can-id | DBC + JSON | Tesla Model 3/S, Renault Zoe, VW MEB, PSA | ~3.200 |
| openvehicles/OVMS-3 | C++ modules | Nissan Leaf, Renault Zoe, Tesla S, VW e-Golf | ~1.840 |
| prototux/PSA-CAN-RE | DBC | Peugeot e-208, Citroën e-C4, DS3 Crossback | ~980 |
| todrobbins/dtcdb | JSON | Tutti i brand — codici generici | ~6.847 DTC |
| teslarent/model3-can | DBC | Tesla Model 3, Model Y | ~760 |
| EVNotify/EVNotify | JSON | VW ID.3, ID.4, Skoda Enyaq, Audi Q4 | ~500 |

### Formato interno JSON

```json
{
  "vehicle_id": "renault-zoe-ze50-2020",
  "make": "Renault", "model": "Zoe ZE50",
  "can_speed": 500, "protocol": "UDS",
  "ecus": [{ "name": "BMS", "address": "0x7E4" }],
  "signals": [{
    "did": "0x2002", "ecu": "BMS",
    "name": "SOC", "unit": "%",
    "formula": "A*0.5",
    "category": "battery"
  }],
  "source": "OBDb/Renault-Zoe"
}
```

### Implementazione

**Script sync (`sync-libs.ts`):**
Clona o fa `git pull` su tutti i repo in `libs-sources/`. Dopo sync esegue automaticamente i convertitori e l'import in Supabase. Eseguibile come cron giornaliero su Vercel.

**Convertitori:**
- `jeju-csv.ts` — parser CSV con colonne `PID, Equation, Unit, Min, Max`
- `dbc.ts` — parser DBC che estrae messaggi `BO_` e segnali `SG_` con regex
- `obdb.ts` — parser per JSON signalset v3 OBDb
- `inferCategory()` — assegna categoria da nome segnale con regex (`soc|soh|cell` → battery, `motor|rpm` → motor, ecc.)

**Caricamento ESP32 (`lib_loader.cpp`):**
Controlla cache SPIFFS (TTL 7 giorni). Se scaduta o assente → GET a `/api/libs/[vehicle_id]` con API key header. Salva JSON in SPIFFS. Parsing con `ArduinoJson` in un `DynamicJsonDocument` da 32KB. Popola array `activeSignals` in RAM per accesso veloce durante la lettura.

**API Vercel (`/api/libs/[vehicle_id]`):**
Autenticazione con API key header. Recupera segnali + ECU da Supabase. Risponde con `Cache-Control: max-age=86400` — Vercel CDN serve la risposta senza toccare Supabase per 24h.

**Auto-detect (`/api/libs/detect`):**
Riceve array di CAN ID ascoltati dall'ESP32. Confronta con campo `can_fingerprint[]` di ogni veicolo nel DB. Restituisce il veicolo con il punteggio di match più alto (minimo 3 ID corrispondenti).

**Supabase schema:**
- `vehicles` — metadati veicolo + `can_fingerprint[]` + `battery_kwh`
- `ecus` — indirizzi ECU per veicolo
- `signals` — segnali con DID, formula, unit, category, source_file
- Indice `(vehicle_id, category)` per query ESP32
- Indice GIN full-text su `name` per ricerca dalla UI

---

## ⚙️ Device

Gestione completa del dispositivo ESP32-S3: configurazione WiFi senza reflash, parametri CAN, diagnostica hardware, log seriale remoto, OTA firmware update e registrazione in Supabase.

### Captive Portal (configurazione iniziale)

Al primo boot senza credenziali in NVS, l'ESP32 crea un hotspot `EV-Diagnostic-XXXX` (ultime 4 cifre del MAC address). Il `DNSServer` risponde a qualsiasi dominio con `192.168.4.1`. L'HTML del portale è embedded nel firmware. Il form raccoglie:
- Nome rete WiFi + password
- URL server Vercel
- API key dispositivo
- Nome dispositivo

Al submit → tutto salvato in NVS → `ESP.restart()`.

### NVS (Non-Volatile Storage)

Libreria `Preferences` con namespace `ev_cfg`. Persiste in flash anche dopo spegnimento. Chiavi principali:

| Chiave | Contenuto |
|---|---|
| `wifi_ssid` | Nome rete WiFi |
| `wifi_pass` | Password WiFi |
| `server_url` | URL base Vercel |
| `api_key` | Chiave autenticazione |
| `device_name` | Nome leggibile |
| `device_id` | UUID generato al primo boot (immutabile) |
| `vehicle_id` | Slug auto rilevata (cache) |
| `can_speed` | Velocità CAN in kbps (default 500) |
| `read_ms` | Intervallo lettura in ms (default 1000) |
| `debug` | Flag log verbose 0/1 |

**Logica avvio (`main.cpp`):**
1. `nvs.begin()` → se `!isConfigured()` → captive portal bloccante
2. `connectWiFi()` → se fallisce → `offlineMode = true`
3. `canBus.begin(nvs.get("can_speed"))` → init TWAI
4. `vehicleDetector.detect()` → fingerprint CAN
5. `sessionManager.init()` → pronto per sessioni

### OTA Firmware Update

1. ESP32 fa GET a `/api/firmware/latest` ogni 24h con header `X-FW-Version`
2. Server confronta semver → risponde `update_available: true/false` + URL binario
3. `httpUpdate.update()` scarica `.bin` e flasha la partizione OTA inattiva
4. Reboot automatico sul nuovo firmware
5. Se il boot fallisce 3 volte → bootloader ripristina la versione precedente (rollback automatico)

### Supabase schema (devices + device_commands)

**`devices`:** registra ogni ESP32 con `device_id` unico, `firmware_ver`, `last_seen`, `wifi_rssi`, `heap_free`, `uptime_s`, `config` (JSONB). Aggiornato via upsert ad ogni heartbeat (ogni 60s).

**`device_commands`:** coda comandi remoti dashboard → ESP32. Tipi supportati: `ota_update`, `reset_config`, `rescan_vehicle`, `reboot`. L'ESP32 controlla i comandi pendenti nella risposta al heartbeat — nessuna connessione aperta permanente necessaria.

### Wiring ESP32-S3 + SN65HVD230 + OBD2

| GPIO ESP32-S3 | Connessione | Note |
|---|---|---|
| GPIO17 (TX) | SN65HVD230 TXD | CAN trasmissione |
| GPIO18 (RX) | SN65HVD230 RXD | CAN ricezione |
| 3.3V | SN65HVD230 VCC | Alimentazione transceiver |
| GND | SN65HVD230 GND | Massa comune |
| — | SN65HVD230 CANH → OBD2 pin 6 | CAN-High |
| — | SN65HVD230 CANL → OBD2 pin 14 | CAN-Low |
| — | OBD2 pin 16 → DC-DC → 3.3V | Alimentazione da auto |

**Inizializzazione TWAI (`can_driver.cpp`):**
Usa driver nativo `driver/twai.h`. Supporta 250/500/1000 kbps via macro `TWAI_TIMING_CONFIG_*KBITS()`. Filtro `ACCEPT_ALL` di default — ottimizzabile con filtro hardware per ridurre il carico CPU.

---

## 🏗️ Architettura generale

```
[Auto OBD2/Tesla]
      │ CAN bus
[SN65HVD230 transceiver]
      │
[ESP32-S3] ← TWAI nativo, SPIFFS cache, NVS config, FreeRTOS tasks
      │ WiFi HTTPS
[Next.js API su Vercel]
      │
      ├── [Supabase PostgreSQL]  ← sessions, battery_readings, dtc_readings, ai_analyses, devices
      ├── [Claude API]           ← analisi DTC, chat, report sessione
      └── [GitHub repos]         ← sync librerie DID/DTC via cron
```

**Costi operativi stimati:**

| Servizio | Piano | Costo mensile |
|---|---|---|
| Vercel | Hobby (già attivo) | €0 |
| Supabase | Free (500MB DB) | €0 |
| Claude API | Pay per use | ~€1.80 |
| GitHub | Public repos | €0 |
| **Hardware ESP32** | Una tantum | ~€35–50 |

