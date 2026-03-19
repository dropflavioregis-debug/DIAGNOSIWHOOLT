# 🚗 EV Universal Diagnostic System — Piano di Implementazione Cursor

> **Obiettivo:** Sistema open source per diagnostica universale auto elettriche (Renault, PSA/Stellantis, Tesla, Hyundai/Kia, VW MEB, Nissan Leaf, ecc.) tramite ESP32-S3 + SN65HVD230, con backend su Vercel + Supabase e AI (Claude API) per analisi in linguaggio naturale.

---

## 📐 Visione del Progetto

### Cosa fa il sistema
1. **ESP32-S3** si connette via CAN bus (OBD2 o connettore Tesla) all'auto
2. **Auto riconosciuta automaticamente** dal fingerprint CAN
3. **Librerie di definizioni** (DID, DTC, segnali) caricate da GitHub → Supabase → ESP32 cache
4. **Lettura parametri:** batteria (SOC, SOH, temp, celle), DTC, ECU data
5. **Claude API** decodifica e analizza in linguaggio naturale
6. **Dashboard web** (Next.js su Vercel) visualizza tutto in real-time
7. **WiFi/password** configurabili da portale captive (no reflash)

### Stack tecnologico

```
[Auto OBD2/Tesla] ──CAN── [ESP32-S3 + SN65HVD230]
                                    │ WiFi
                           [Next.js API su Vercel]
                                    │
                    ┌───────────────┼───────────────┐
              [Supabase DB]   [Claude API]   [GitHub libs]
              (parametri,     (analisi AI)   (DID/DTC JSON)
               storico,
               configurazioni)
```

### Perché Supabase + Vercel (risposta diretta)
- **Supabase:** perfetto per IoT — ha realtime subscriptions native, PostgreSQL solido, free tier 500MB, auth integrata, storage per file JSON/CSV librerie. È la scelta giusta.
- **Vercel:** hai già il server lì, non cambiare. Supabase si integra nativamente con Vercel con un click (variabili env auto-sincronizzate).
- **Insieme:** stack usato dalla maggior parte degli AI startup 2025-2026. Zero friction.

---

## 📁 Struttura Repository

```
ev-diagnostic/
├── README.md
├── .cursorrules                    ← regole per Cursor AI
├── .env.example
│
├── firmware/                       ← ESP32-S3 (PlatformIO)
│   ├── platformio.ini
│   ├── src/
│   │   ├── main.cpp
│   │   ├── can/
│   │   │   ├── can_driver.cpp      ← TWAI nativo ESP32
│   │   │   ├── can_driver.h
│   │   │   ├── iso_tp.cpp          ← ISO 15765-2 segmentazione
│   │   │   └── iso_tp.h
│   │   ├── uds/
│   │   │   ├── uds_client.cpp      ← UDS ISO 14229
│   │   │   ├── uds_client.h
│   │   │   └── uds_services.h      ← SID 0x10, 0x14, 0x19, 0x22, 0x3E
│   │   ├── vehicle/
│   │   │   ├── fingerprint.cpp     ← auto-detect marca/modello
│   │   │   ├── fingerprint.h
│   │   │   ├── lib_loader.cpp      ← carica JSON da LittleFS
│   │   │   └── lib_loader.h
│   │   ├── wifi/
│   │   │   ├── wifi_manager.cpp    ← captive portal configurazione
│   │   │   └── wifi_manager.h
│   │   ├── api/
│   │   │   ├── api_client.cpp      ← POST dati a Vercel API
│   │   │   └── api_client.h
│   │   └── config/
│   │       ├── config.h            ← costanti e pin definitions
│   │       └── nvs_config.cpp      ← salva config in NVS (WiFi, API key, ecc.)
│   ├── data/                       ← LittleFS filesystem
│   │   ├── config.json             ← config utente (WiFi, server URL)
│   │   └── libs/                   ← cache locale librerie (auto-popolata)
│   │       └── .gitkeep
│   └── lib/
│       └── README.md
│
├── web/                            ← Next.js su Vercel
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                ← dashboard principale
│   │   ├── api/
│   │   │   ├── ingest/
│   │   │   │   └── route.ts        ← riceve dati da ESP32
│   │   │   ├── analyze/
│   │   │   │   └── route.ts        ← chiama Claude API
│   │   │   ├── vehicle/
│   │   │   │   └── route.ts        ← riconosce veicolo
│   │   │   └── libs/
│   │   │       └── route.ts        ← serve librerie a ESP32
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   └── config/
│   │       └── page.tsx            ← config ESP32 da browser
│   ├── components/
│   │   ├── BatteryCard.tsx
│   │   ├── DTCList.tsx
│   │   ├── TrendChart.tsx
│   │   └── DiagnosisPanel.tsx      ← output Claude AI
│   └── lib/
│       ├── supabase.ts
│       ├── claude.ts
│       └── vehicle-detect.ts
│
├── scripts/                        ← script manutenzione librerie
│   ├── sync-libs.ts                ← clona/aggiorna tutti i repo GitHub
│   ├── convert-csv-to-json.ts      ← converte CSV tipo JejuSoul → JSON interno
│   ├── convert-dbc-to-json.ts      ← converte file DBC → JSON interno
│   └── import-to-supabase.ts       ← importa tutto in Supabase
│
├── libs-sources/                   ← sorgenti librerie GitHub (gitignored, generato da sync)
│   └── README.md
│
└── supabase/
    ├── migrations/
    │   ├── 001_vehicles.sql
    │   ├── 002_signals.sql
    │   ├── 003_dtc.sql
    │   ├── 004_sessions.sql
    │   └── 005_readings.sql
    └── seed/
        └── vehicles.sql
```

---

## 🗄️ Schema Database Supabase

```sql
-- Tabella veicoli supportati
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,           -- 'Renault', 'Tesla', 'Peugeot'
  model TEXT NOT NULL,          -- 'Zoe', 'Model 3', 'e-208'
  year_from INT,
  year_to INT,
  can_ids TEXT[],               -- fingerprint CAN IDs per auto-detect
  protocol TEXT DEFAULT 'UDS',  -- 'UDS', 'CAN_RAW', 'KWP2000'
  can_speed INT DEFAULT 500,    -- kbps
  source_repo TEXT,             -- URL repo GitHub sorgente
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segnali / DID per ogni veicolo
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  name TEXT NOT NULL,           -- 'SOC', 'battery_temp', 'cell_voltage_1'
  description TEXT,
  did TEXT,                     -- es. '0x02' o '0x5B3F'
  ecu_address TEXT,             -- es. '0x7E4'
  formula TEXT,                 -- formula decodifica es. 'A*0.5'
  unit TEXT,                    -- '%', '°C', 'V', 'kWh'
  min_value FLOAT,
  max_value FLOAT,
  category TEXT,                -- 'battery', 'motor', 'charging', 'general'
  source_file TEXT              -- file sorgente (per tracciabilità)
);

-- Database DTC
CREATE TABLE dtc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,           -- 'P0A0F', 'U0100'
  vehicle_id UUID REFERENCES vehicles(id),  -- NULL = generico
  description_it TEXT,
  description_en TEXT,
  severity TEXT,                -- 'critical', 'warning', 'info'
  system TEXT,                  -- 'battery', 'motor', 'charging', 'network'
  possible_causes TEXT[],
  source_file TEXT
);

-- Sessioni diagnostica (ogni volta che connetti l'auto)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,      -- ID univoco ESP32
  vehicle_id UUID REFERENCES vehicles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  can_fingerprint JSONB,        -- CAN IDs rilevati
  raw_dtc TEXT[],               -- DTC raw letti
  ai_diagnosis TEXT,            -- output Claude API
  metadata JSONB
);

-- Letture parametri (time series)
CREATE TABLE readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  signal_id UUID REFERENCES signals(id),
  value FLOAT NOT NULL,
  raw_value TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_readings_session ON readings(session_id);
CREATE INDEX idx_readings_signal ON readings(signal_id);
CREATE INDEX idx_readings_time ON readings(recorded_at DESC);
CREATE INDEX idx_signals_vehicle ON signals(vehicle_id);
CREATE INDEX idx_dtc_code ON dtc(code);
```

---

## 📚 Librerie GitHub da Clonare e Importare

### Script `scripts/sync-libs.ts`

```typescript
const LIBRARY_SOURCES = [
  // ── DATABASE DID/SEGNALI EV ──────────────────────────────────────────
  {
    name: "OBDb - Community OBD Database",
    repo: "https://github.com/OBDb",         // organizzazione con 100+ repo per modello
    type: "obdb_org",
    format: "json_signalset_v3",
    priority: 1,
  },
  {
    name: "JejuSoul - Hyundai/Kia EV PIDs",
    repo: "https://github.com/JejuSoul/OBD-PIDs-for-HKMC-EVs",
    type: "single_repo",
    format: "csv_extendedpids",
    covers: ["Hyundai Kona EV", "Kia Niro EV", "Ioniq 5", "EV6"],
    priority: 1,
  },
  {
    name: "iDoka - Awesome Automotive CAN IDs",
    repo: "https://github.com/iDoka/awesome-automotive-can-id",
    type: "single_repo",
    format: "dbc_and_json",
    covers: ["Tesla Model 3", "Tesla Model S", "Renault Zoe", "VW MEB", "PSA"],
    priority: 1,
  },
  {
    name: "OVMS - Open Vehicle Monitoring System",
    repo: "https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3",
    type: "single_repo",
    format: "cpp_vehicle_modules",
    covers: ["Nissan Leaf", "Renault Zoe", "Tesla Model S", "VW e-Golf", "Smart ED"],
    priority: 2,
  },
  {
    name: "prototux - PSA CAN Reverse Engineering",
    repo: "https://github.com/prototux/PSA-CAN-RE",
    type: "single_repo",
    format: "dbc",
    covers: ["Peugeot e-208", "Citroën e-C4", "DS 3 Crossback E-Tense"],
    priority: 1,
  },

  // ── DATABASE DTC GENERICI ─────────────────────────────────────────────
  {
    name: "todrobbins - DTC Database",
    repo: "https://github.com/todrobbins/dtcdb",
    type: "single_repo",
    format: "json_dtc",
    priority: 1,
  },

  // ── SPECIFICI TESLA ───────────────────────────────────────────────────
  {
    name: "teslarent - Tesla Model 3 CAN",
    repo: "https://github.com/teslarent/model3-can",
    type: "single_repo",
    format: "dbc",
    covers: ["Tesla Model 3", "Tesla Model Y"],
    priority: 1,
  },

  // ── SPECIFICI VW MEB ──────────────────────────────────────────────────
  {
    name: "EVNotify - VW MEB Signals",
    repo: "https://github.com/EVNotify/EVNotify",
    type: "single_repo",
    format: "json",
    covers: ["VW ID.3", "VW ID.4", "Skoda Enyaq", "Audi Q4"],
    priority: 2,
  },

  // ── SPECS EV (NON DIAGNOSTICA, MA UTILE PER CONTESTO AI) ─────────────
  {
    name: "OpenEV Data - EV Specifications",
    repo: "https://github.com/open-ev-data/open-ev-data-dataset",
    type: "single_repo",
    format: "json_ev_specs",
    priority: 2,
  },
];
```

---

## 🔧 Firmware ESP32-S3 — Funzionalità Chiave

### 1. Captive Portal (configurazione WiFi/password senza reflash)

All'avvio senza config salvata, ESP32 crea un hotspot `EV-Diagnostic-XXXX`.
L'utente si connette e apre `192.168.4.1` → form web per inserire:
- Nome WiFi + password
- URL server (Vercel)
- API key
- Nome dispositivo

Config salvata in **NVS** (Non-Volatile Storage) dell'ESP32 — persiste ai riavvii.

### 2. Auto-riconoscimento veicolo

```cpp
// fingerprint.cpp
// Ascolta CAN bus per 2 secondi, raccoglie CAN IDs attivi
// Invia al server → risposta: vehicle_id + nome + libreria da caricare
```

### 3. Download libreria on-demand

Quando il veicolo è riconosciuto, ESP32 scarica da Vercel API il JSON
del modello specifico e lo salva in LittleFS. La prossima volta usa la cache.

### 4. Lettura UDS

```
10 03          → DiagnosticSessionControl (extended)
3E 00          → TesterPresent
22 <DID>       → ReadDataByIdentifier
19 02 FF       → ReadDTCInformation
14 FF FF FF    → ClearDTC
```

---

## 🌐 API Vercel — Endpoints

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/ingest` | POST | Riceve dati raw da ESP32 |
| `/api/vehicle/detect` | POST | Riconosce veicolo da fingerprint CAN |
| `/api/libs/[vehicle_id]` | GET | Serve JSON libreria a ESP32 |
| `/api/analyze` | POST | Chiama Claude API per diagnosi |
| `/api/sessions` | GET | Lista sessioni storiche |
| `/api/sessions/[id]` | GET | Dettaglio sessione |

---

## 🤖 Integrazione Claude API

```typescript
// lib/claude.ts
const SYSTEM_PROMPT = `
Sei un esperto diagnostico di veicoli elettrici.
Ti vengono forniti dati tecnici raw letti dal CAN bus di un veicolo.
Rispondi SEMPRE in italiano.
Analizza e fornisci:
1. Stato generale del veicolo
2. Descrizione dei DTC trovati in linguaggio semplice
3. Possibili cause e urgenza intervento
4. Stato batteria con interpretazione (non solo numeri)
5. Raccomandazioni specifiche
Sii conciso ma completo. Usa emoji per indicare severità.
`;
```

---

## ⚙️ File di Configurazione ESP32 (LittleFS `data/config.json`)

```json
{
  "wifi_ssid": "",
  "wifi_password": "",
  "server_url": "https://tuo-progetto.vercel.app",
  "api_key": "",
  "device_name": "EV-Diag-01",
  "can_speed_kbps": 500,
  "auto_detect_vehicle": true,
  "cache_libs_locally": true,
  "send_interval_ms": 1000,
  "debug_serial": true
}
```

---

## 🚀 Setup Iniziale — Step by Step

### 1. Supabase
```bash
# Crea progetto su supabase.com
# Collega il repo al progetto (dalla root del repo)
npx supabase link --project-ref <ref>

# Esegui le migration
npx supabase db push

# Connetti a Vercel (integrazione nativa, 1 click da Vercel marketplace)
```

### 2. Vercel
```bash
# Dal repo: collega il progetto Vercel (o primo deploy con vercel)
cd web
vercel link
# Imposta in Vercel (Dashboard → Settings → Environment Variables) le variabili:
# NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, API_KEY (per ESP32)
vercel env pull .env.local
```

### 3. Sincronizza librerie GitHub
```bash
cd scripts
npm install
npx tsx sync-libs.ts              # clona tutti i repo in ../libs-sources/
npx tsx convert-csv-to-json.ts    # CSV (JejuSoul) → libs-sources/converted/
npx tsx convert-dbc-to-json.ts    # DBC → libs-sources/converted/ (se presenti .dbc)
# Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_*), poi:
npx tsx import-to-supabase.ts     # importa converted/*.json in Supabase
```

### 4. Firmware ESP32
```bash
# Installa PlatformIO in VSCode/Cursor (o CLI)
cd firmware
pio run --target uploadfs    # carica filesystem (data/ → LittleFS, include config.json)
pio run --target upload      # flash firmware
pio device monitor           # monitor seriale 115200
```

### 5. Prima configurazione utente
1. Cerca WiFi `EV-Diagnostic-XXXX` sul telefono
2. Apri browser → `192.168.4.1`
3. Inserisci WiFi casa + URL Vercel + API key
4. Salva → ESP32 si riconnette automaticamente

---

## 📝 `.cursorrules` per il progetto

```
# EV Diagnostic System — Cursor Rules

## Architettura
- Firmware: C++ con PlatformIO per ESP32-S3
- Backend: Next.js 14 App Router su Vercel
- Database: Supabase (PostgreSQL)
- AI: Claude API (claude-sonnet-4-20250514)

## Convenzioni firmware
- Usa TWAI nativo ESP32 (non MCP2515)
- Transceiver: SN65HVD230 su GPIO17 (TX) e GPIO18 (RX)
- Config sempre in NVS, mai hardcoded
- Librerie DID/DTC sempre da LittleFS (filesystem), mai hardcoded
- Gestisci sempre disconnessione WiFi con retry

## Convenzioni backend
- TypeScript strict mode ovunque
- Tutti gli endpoint API autenticati con API key header
- Dati IoT salvati sempre in Supabase prima di processare
- Claude API solo per analisi testuale, mai per logica dati

## Database
- Usa sempre UUID per primary key
- Timestamp sempre TIMESTAMPTZ
- JSONB per dati non strutturati (metadata, fingerprint)

## Librerie veicoli
- Formato interno sempre JSON (anche se sorgente è CSV o DBC)
- Schema: { vehicle_id, signals: [...], dtc: [...] }
- Ogni segnale ha sempre: did, formula, unit, category
```

---

## 💰 Costi Operativi Stimati

| Servizio | Free Tier | Costo stimato uso normale |
|---|---|---|
| **Vercel** | Già hai | €0 |
| **Supabase** | 500MB DB, 1GB storage | €0 per prototipo |
| **Claude API** | Pay per use | ~€2-5/mese (uso normale) |
| **GitHub** | Illimitato pubblico | €0 |
| **ESP32-S3 hardware** | Una tantum | ~€35-50 |

---

## 🔮 Roadmap futura

- [ ] OTA firmware update via WiFi
- [ ] App mobile Flutter/React Native
- [ ] Supporto K-Line (auto pre-2008)
- [ ] Export report PDF diagnosi
- [ ] Multi-device (più ESP32 per officina)
- [ ] Modalità offline completa (senza internet)
