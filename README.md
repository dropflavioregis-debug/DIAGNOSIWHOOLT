# EV Universal Diagnostic System

Sistema open source per diagnostica universale auto elettriche (Renault, PSA/Stellantis, Tesla, Hyundai/Kia, VW MEB, Nissan Leaf, ecc.) tramite ESP32-S3 + CAN, con backend Next.js su Vercel e Supabase.

## Struttura

- `web/` — App Next.js (dashboard, API)
- `firmware/` — Firmware ESP32-S3 (PlatformIO)
- `scripts/` — Script sincronizzazione librerie
- `supabase/` — Migrazioni e seed DB
- `docs/ARCHITECTURE_UI_DEVICE.md` — Comunicazione UI ↔ ESP32 e estensione senza reflash (comandi da DB, lib da API/Storage)

## Setup locale (Fase 1 — minimal)

### Web

```bash
cd web
npm install
npm run dev
```

Se `npm install` fallisce per la build nativa di `better-sqlite3` (dipendenza di Corgi), usa `npm install --ignore-scripts`: il backend usa il runtime browser di Corgi con DB da CDN, quindi non serve la build nativa. **Su Vercel** questo è già impostato in `web/vercel.json` (`installCommand`).

App in ascolto su [http://localhost:3000](http://localhost:3000).

### Variabili d'ambiente

Copia `.env.example` in `web/.env.local`. Per le API reali (Fase 4): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`), e `ANTHROPIC_API_KEY` per l’analisi con Claude. Senza queste variabili le API rispondono in modalità stub (dati non persistiti).

### Test manuale API (stub)

Con il dev server avviato:

```bash
# Ingest (POST)
curl -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -d '{"device_id":"test","readings":[]}'

# Vehicle detect (POST)
curl -X POST http://localhost:3000/api/vehicle/detect -H "Content-Type: application/json" -d '{"can_ids":["0x123","0x456"]}'

# Lib per veicolo (GET)
curl http://localhost:3000/api/libs/00000000-0000-0000-0000-000000000001

# Analyze (POST)
curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d '{"raw_dtc":[],"signals":{}}'
```

### Supabase (migrazioni)

Dopo aver creato un progetto su [supabase.com](https://supabase.com):

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

## Firmware (ESP32-S3)

Requisiti: [PlatformIO](https://platformio.org/) (CLI o estensione VSCode/Cursor). Usa un **cavo USB dati** (non solo ricarica): se `pio device monitor` non vede la porta, è quasi sempre per il cavo.

```bash
cd firmware
pio run -t uploadfs && pio run -t upload   # filesystem (LittleFS) + firmware in un colpo
pio device monitor    # monitor seriale 115200
```

Oppure: `make upload_all` (dalla cartella `firmware`). In `platformio.ini` è impostato `board_build.filesystem = littlefs` (LittleFS è più robusto di SPIFFS in caso di power-off). Per passi dettagliati e risoluzione problemi (es. cavo solo ricarica): **SETUP.md**.

### Configurazione iniziale

1. All’avvio senza credenziali WiFi, l’ESP32 crea l’AP `EV-Diagnostic-XXXX` (suffisso da MAC).
2. Connetti il dispositivo all’AP e apri il browser su **http://192.168.4.1**.
3. Compila il form (WiFi SSID, password, Server URL, API Key, nome dispositivo) e salva.
4. Dopo il riavvio il dispositivo si connette in STA e invia i dati al server.

Variabili salvate in NVS: `wifi_ssid`, `wifi_password`, `server_url`, `api_key`, `device_name`, `can_speed_kbps`.

### Payload ingest

Il firmware invia POST a `/api/ingest` con JSON tipo:

```json
{"device_id":"EV-Diag-01","vin":"WF0XXXGAXAB123456","readings":[],"raw_dtc":[]}
```

`device_id` viene da NVS (`device_name`) o da MAC; `vin` (opzionale) è letto via UDS ReadDataByIdentifier (DID 0xF190) su CAN e decodificato lato server con [Corgi](https://github.com/cardog-ai/corgi) (NHTSA VPIC). `readings` e `raw_dtc` sono popolati quando è disponibile la libreria veicolo su LittleFS.

### OTA (aggiornamento firmware via WiFi)

Il firmware controlla periodicamente (ogni 24 h) l’endpoint `GET /api/firmware/latest`. La risposta attesa è JSON: `{ "version": "1.0.1", "url": "https://..." }` dove `url` punta al file `.bin` da flashare. Se `version` è maggiore della versione corrente (definita in `firmware/src/config/config.h` come `FIRMWARE_VERSION`), il dispositivo scarica il binario e si aggiorna da solo, poi si riavvia.

**Backend:** imposta le variabili d’ambiente `FIRMWARE_VERSION` (es. `1.0.1`) e `FIRMWARE_BINARY_URL` (URL pubblico del file `.bin`, es. da Vercel Blob o CDN). Dopo ogni build di firmware, carica il `.bin` generato da `pio run` e aggiorna `FIRMWARE_BINARY_URL` (e `FIRMWARE_VERSION`) in produzione.

### Comandi web → dispositivo (hook)

La webapp può inviare comandi all’ESP32 senza aprire la pagina del dispositivo. L’ESP32 fa **polling** ogni ~15 s su `GET /api/device/commands?device_id=...` (con header `X-API-Key`). I comandi vengono accodati in tabella `device_commands`; la webapp li crea con `POST /api/device/commands` (body: `{ device_id, command [, payload] }`). Comandi supportati dal firmware:

- **`start_session`** — avvia una nuova sessione (stesso effetto del pulsante «Avvia connessione con il veicolo» sulla pagina del dispositivo).

Dalla pagina **Sessioni** → **Avvia diagnosi** puoi scegliere il dispositivo dalla lista e cliccare **Avvia sessione su questo dispositivo**: il comando viene accodato e l’ESP32 lo esegue al prossimo poll. Il sistema è estensibile: in `firmware/src/main.cpp` la funzione `processDeviceCommands()` può gestire altri comandi (es. `reboot`, `sync_config`).

## Deploy su Vercel

1. **Importa il repo** su [vercel.com](https://vercel.com) (Import Git Repository).
2. **Root Directory:** imposta **Root Directory** su **`web`** (Project Settings → General). Obbligatorio: l’app Next.js è in `web/`.
3. **Variabili d'ambiente:** in Project Settings → Environment Variables aggiungi quelle necessarie (vedi `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (obbligatori per DB)
   - `ANTHROPIC_API_KEY` (per analisi AI)
   - `API_KEY` (stessa chiave usata dall’ESP32 per le richieste API)
   - Opzionali: `SITE_PASSWORD`, `FIRMWARE_VERSION`, `FIRMWARE_BINARY_URL`
4. **Deploy:** ogni push sul branch collegato (es. `main`) avvia il build. Il build usa `npm run build` nella cartella `web` e produce l’output in `.next`.

Guida dettagliata: **docs/DEPLOY_VERCEL.md**. Build verificato con `cd web && npm run build`.

## Dashboard e API reali (Fase 4)

Con Supabase e (opzionale) Claude configurati:

- **Dashboard** (`/dashboard`): elenco sessioni da `/api/sessions`, dettaglio da `/api/sessions/[id]` con BatteryCard, DTCList, TrendChart, DiagnosisPanel.
- **Export report PDF**: da pagina **Sessioni** (`/sessions`), espandi una sessione e usa **Scarica report PDF**; l’endpoint `GET /api/sessions/[id]/export` restituisce un PDF con dati sessione, DTC, diagnosi AI e ultime letture.
- **Ingest**: i payload POST a `/api/ingest` vengono salvati in `sessions` e `readings`. Se il body include `vin` (17 caratteri), il server lo decodifica con Corgi e salva `sessions.vin` e `sessions.vin_decoded` (make, model, year, ecc.). Endpoint **VIN decode**: `GET /api/vin/decode?vin=...` o `POST /api/vin/decode` con `{"vin":"..."}`.
- **Vehicle detect**: lookup su tabella `vehicles` per `can_ids`.
- **Libs**: `GET /api/libs/[vehicle_id]` restituisce `signals` e `dtc` da Supabase. Dalla pagina **/libs** puoi importare librerie da URL o caricare file JSON: i file vengono salvati in **Supabase Storage** (bucket `libs`) e i dati in `vehicles`/`signals`/`dtc` per la diagnosi. Funziona anche su Vercel.
- **Analyze**: `POST /api/analyze` con `raw_dtc`/`signals` chiama Claude e può aggiornare `ai_diagnosis` sulla sessione se viene passato `session_id`.

## Scripts (sincronizzazione librerie)

Script in `scripts/` per clonare sorgenti GitHub, convertire CSV/DBC in JSON e **copiare tutto in Supabase** (Database + Storage), così l’app su Vercel ha tutto il necessario:

```bash
cd scripts
npm install
# Variabili d'ambiente (come in web/.env o Vercel):
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Opzione A — tutto in un comando (sync + convert + import in DB + upload in Storage):
npm run sync-to-vercel

# Opzione B — step singoli:
npx tsx sync-libs.ts              # clona repo in ../libs-sources/
npx tsx convert-csv-to-json.ts    # CSV -> libs-sources/converted/
npx tsx convert-dbc-to-json.ts    # DBC -> libs-sources/converted/
npx tsx import-to-supabase.ts     # copia in DB (vehicles, signals, dtc) + Storage (bucket libs)
```

`import-to-supabase.ts` crea il bucket Storage `libs` se manca, carica ogni JSON in Storage e importa veicoli/segnali/DTC nel database. Dopo aver eseguito questi script, il deploy su Vercel usa solo Supabase (nessun file locale). Vedi `libs-sources/README.md` per i dettagli. Le sorgenti includono, tra le altre, **Nissan LEAF** (DBC da dalathegreat/leaf_can_bus_messages) e **OpenInverter CAN tool** per operazioni su inverter (stm32-sine, Foccci/Clara, ecc.) via CAN; istruzioni in `libs-sources/README.md` (sezione OpenInverter CAN tool).

## Roadmap

Vedi `ev-diagnostic-plan.md` per il piano completo e le fasi successive (integrazioni reali, OTA, app mobile).
