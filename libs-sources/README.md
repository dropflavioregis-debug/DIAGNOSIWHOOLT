# libs-sources

This directory is populated by the scripts in `scripts/`:

1. **sync-libs.ts** — Clones GitHub repos (from `LIBRARY_SOURCES`) here. Each repo gets a subfolder named after the repo (e.g. `OBD-PIDs-for-HKMC-EVs`, `PSA-CAN-RE`, `awesome-ev-charging`).

2. **convert-csv-to-json.ts** / **convert-dbc-to-json.ts** — Read CSV or DBC files from these clones and write internal JSON into `converted/`.

3. **convert-ovms-vehicles.ts** — After cloning OVMS3 (Open-Vehicle-Monitoring-System-3), run this to generate the vehicle index from `vehicle_*` components (and plugin `v-*`). Writes one JSON per vehicle in `converted/` (signals/dtc empty; use other libs or future C++ extractor for actual signals).

4. **import-to-supabase.ts** — Imports `converted/*.json` into Supabase: tables `vehicles`, `signals`, `dtc` and **Storage** bucket `libs` (one JSON file per library). Così tutto funziona su Vercel.

This folder is typically gitignored because it contains large cloned repos. To refresh:

```bash
cd scripts
npm install
npx tsx sync-libs.ts
npx tsx convert-csv-to-json.ts
npx tsx convert-dbc-to-json.ts
npx tsx convert-ovms-vehicles.ts    # OVMS3 vehicle index → converted/
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then:
npx tsx import-to-supabase.ts
```

**Riferimento protocolli EV (solo lettura):** la cartella `awesome-ev-charging/` contiene una awesome list con specifiche e link a OCPP, OCPI, ISO 15118, OICP, eMI³, Eichrecht e tool/librerie per stazioni di ricarica. Utile per capire i protocolli di comunicazione EV; non viene convertita in JSON (formato `awesome_list`).

**Riferimento linee CAN (solo lettura):** la cartella `HeadlessZombie/` è clonata come riferimento per le linee CAN (VCU ZombieVerter/OpenInverter): include `e39_can_info.txt`, `Parameters/*.json`, `include/*.h` e `src/*.cpp` per BMW E39/E46/E65/E31, VAG, Nissan Leaf, OBD2, OpenInverter. Formato C++/header/parametri; i convertitori CSV/DBC non lo processano.

**Nissan LEAF CAN (DBC):** la cartella `leaf_can_bus_messages/` è clonata da [dalathegreat/leaf_can_bus_messages](https://github.com/dalathegreat/leaf_can_bus_messages). Contiene i file DBC per EV-can (ZE0, AZE0, ZE1), CAR-can, AV-CAN e QC-CAN. Dopo `sync-libs` e `convert-dbc-to-json` si ottiene la libreria **Nissan Leaf** in `converted/leaf_can_bus_messages.json` (make/model impostati a Nissan/Leaf; `can_ids` derivati dagli ID messaggio per il vehicle detection). Gli ID ECU per polling UDS (VCM, BCM, LBC/BMS, INVERTER, HVAC, ecc.) sono in `scripts/data/nissan-leaf-ecu-ids.json` per uso futuro sul firmware.

---

## OpenInverter CAN tool

La cartella `openinverter-can-tool/` contiene il tool Python [openinverter-can-tool](https://github.com/davefiddes/openinverter-can-tool) per configurare e comandare sistemi **OpenInverter** (inverter EV, stm32-sine, Foccci/Clara, Stm32-vcu, Flying ADC BMS) su CAN. Operazioni supportate: lettura/scrittura parametri, comandi start/stop, scan bus, dump parametri, upgrade firmware, error log.

Non viene convertito in JSON né importato in Supabase (formato `python_openinverter_tool`); il clone serve per riferimento al codice e ai protocolli SDO/CANopen, e per eseguire il tool in locale.

### Eseguire il tool dalla copia clonata

**Opzione A — dalla cartella clonata (dopo `npx tsx sync-libs.ts`):**

```bash
cd libs-sources/openinverter-can-tool
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
oic --help
```

**Opzione B — installazione globale (non richiede il clone):**

```bash
pipx install openinverter_can_tool
oic --help
```

Il clone resta utile per consultare il codice (es. `constants.py`, `oi_node.py`) se in futuro si implementa un client OpenInverter sull’ESP32.

### Configurazione CAN

Il tool usa [python-can](https://python-can.readthedocs.io/en/stable/configuration.html). Crea `~/.canrc` (Linux/macOS) o `%USERPROFILE%\can.conf` (Windows). Esempio SocketCAN (Linux):

```ini
[default]
interface = socketcan
channel = can0
bitrate = 500000
```

Esempio SLCAN (adattatore USB tipo GVRET / CANable):

```ini
[default]
interface = slcan
channel = COM8
bitrate = 500000
```

Su Linux avvia prima l’interfaccia SocketCAN (vedi [docs socketcan](https://github.com/davefiddes/openinverter-can-tool/blob/main/docs/socketcan-config.md)).

### Esempi comandi

```bash
oic scan                    # Cerca nodi OpenInverter sul bus
oic read brakeregen         # Legge un parametro
oic write potmode DualChannel
oic cmd start               # Avvia inverter
oic cmd stop                # Ferma inverter
oic dumpall                 # Elenca tutti i parametri/valori
oic upgrade stm32_sine.bin  # Upgrade firmware via CAN
```

---

## ESP32 RET SD (CAN reverse engineering)

La cartella `ESP32_RET_SD/` contiene il firmware [MotorvateDIY/ESP32_RET_SD](https://github.com/MotorvateDIY/ESP32_RET_SD): tool per reverse engineering CAN su ESP32 con logging su SD (formato SavvyCAN CSV/GVRET) e connessione WiFi per SavvyCAN. Utile come riferimento per protocollo GVRET, gestione CAN (es. `esp32_can`), SD e WiFi; non viene convertito né importato in Supabase (formato `esp32_ret_firmware`).

---

## SavvyCAN (formati log CAN)

La cartella `SavvyCAN/` contiene il clone del tool Qt multipiattaforma [SavvyCAN](https://github.com/collin80/SavvyCAN) (C++/Qt). Non viene compilato nel progetto; serve come **riferimento per i formati di log CAN** e per compatibilità con GVRET e con l’output di ESP32_RET_SD.

### Formati rilevanti per il progetto

- **GVRET / SavvyCAN Native CSV**  
  Intestazione: `Time Stamp,ID,Extended,Dir,Bus,LEN,D1,D2,D3,D4,D5,D6,D7,D8`.  
  Ogni riga: timestamp (microsecondi), ID esadecimale, extended (true/false), Dir (Rx/Tx), Bus, lunghezza, byte D1–D8 in hex. È lo stesso formato emesso da ESP32_RET_SD in modalità CSV (vedi `ESP32_RET_SD/gvret_comm.cpp` ~linee 550–584).

- **Generic CSV**  
  Intestazione: `ID,Data Bytes`. Righe: ID hex, poi byte in esadecimale separati da spazio (es. `4f5,ff 34 23 45`).

- **CRTD (OVMS)**  
  Righe con timestamp (decimale o intero), tipo (R/T [+ numero bus]), ID hex, byte separati da spazio.

### Dove trovare le implementazioni nel clone

- `framefileio.cpp` e `framefileio.h`: load/save per tutti i formati (loadNativeCSVFile, loadGenericCSVFile, loadCRTDFile, ecc.).
- `can_structs.h`: definizione frame CAN (Qt QCanBusFrame).

La web app può importare/esportare log in formato SavvyCAN Native CSV tramite il modulo `web/lib/savvycan-csv.ts` (parser ed export in TypeScript, senza usare codice C++/Qt).
