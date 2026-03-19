# Setup EV Diagnostic System

Istruzioni per configurare e programmare l’ESP32-S3 e mettere in funzione il sistema.

---

## Requisiti

- **ESP32-S3 DevKit** (es. ESP32-S3-DevKitC-1) collegato al PC con **cavo USB dati**.
  - **Importante:** molti cavi micro-USB / USB-C sono **solo ricarica** e non trasmettono dati. Se `pio device monitor` non vede la porta o l’upload fallisce, è quasi sempre per questo. Usa un cavo che sai essere dati (es. quello di uno smartphone che fa trasferimento file) o acquistane uno dati.
- **PlatformIO**:
  - **In Cursor/VSCode:** installa l’estensione **PlatformIO IDE**, oppure
  - **Da terminale:** `pip install platformio` e usa i comandi sotto dalla cartella `firmware`.

---

## 1. Caricare il filesystem (file di configurazione)

La cartella `firmware/data/` contiene `config.json` (WiFi, server, API key, ecc.). Va caricata sulla flash **prima** del firmware. Il progetto usa **LittleFS** (in `platformio.ini`: `board_build.filesystem = littlefs`) — più robusto di SPIFFS in caso di power-off e con wear-leveling migliore.

```bash
cd firmware
pio run --target uploadfs
```

In VSCode/Cursor con PlatformIO: **Project Tasks → esp32-s3-devkitc-1 → Upload Filesystem Image**.

Puoi lasciare i campi vuoti in `config.json`: alla prima accensione senza WiFi l’ESP32 aprirà il **captive portal** per configurarli.

---

## 2. Programmare il firmware

Dopo aver caricato il filesystem, carica il programma:

```bash
cd firmware
pio run --target upload
```

In VSCode/Cursor: **Upload** (icona freccia) dalla barra PlatformIO.

Se la porta non viene riconosciuta, controlla il **cavo USB** (Requisiti). In `firmware/platformio.ini` puoi eventualmente impostare:

```ini
upload_port = /dev/cu.usbmodem*   # macOS
; upload_port = COM3              # Windows
```

---

## 3. Ordine consigliato e comando unico

1. Collega l’ESP32-S3 via USB (cavo **dati**, non solo ricarica).
2. **Upload filesystem + firmware in un colpo solo:**
   ```bash
   cd firmware
   pio run --target uploadfs && pio run --target upload
   ```
   Oppure, se hai `make`: `make upload_all`.
3. **Monitor seriale** (115200 baud): `pio device monitor`  
   (in VSCode/Cursor: **PlatformIO → Monitor**).

---

## 4. Prima configurazione (captive portal)

Dopo il primo avvio, se non c’è WiFi configurato, l’ESP32 crea l’hotspot **EV-Diagnostic-XXXX** (XXXX = ultimi 4 caratteri del MAC).

1. Connetti il telefono/PC a quell’WiFi.
2. Apri il browser su **http://192.168.4.1**.
3. Compila il form:
   - Nome WiFi (SSID) e password di casa
   - URL server (es. `https://tuo-progetto.vercel.app`)
   - API key (stessa impostata in Vercel per le API)
   - Nome dispositivo (es. `EV-Diag-01`)
4. Clicca **Salva** → l’ESP32 si riavvia e si connette al WiFi e al server.

La configurazione viene salvata in **NVS** (memoria non volatile) e resta anche dopo lo spegnimento.

---

## 5. Riaprire la pagina di configurazione (cambio WiFi / server / API key)

Quando il dispositivo è già connesso al WiFi, puoi riaprire la pagina di configurazione in qualsiasi momento (es. per cambiare rete WiFi, URL server o API key):

1. Assicurati che PC o telefono siano sulla **stessa rete WiFi** dell’ESP32.
2. Apri il browser e vai all’**IP del dispositivo**:
   - L’IP viene stampato sul **monitor seriale** alla connessione: `Reconfigure: http://192.168.1.xx`
   - Oppure controlla dal router la lista dispositivi connessi (nome tipo EV-Diag-01 o simile).
3. Nella pagina che si apre troverai il pulsante **«Apri configurazione (WiFi / Server / API key)»**.
4. Cliccalo: l’ESP32 si riavvia in hotspot **EV-Diagnostic-XXXX**. Connettiti a quell’WiFi e apri **http://192.168.4.1** per compilare di nuovo il form (WiFi, server, API key, nome dispositivo) e salvare.

Così puoi cambiare impostazioni quando vuoi senza ricollegare il cavo USB.

---

## 6. Copiare le librerie in Supabase (per Vercel)

Per far funzionare tutto su Vercel (diagnosi, pagina Librerie, API libs), database e Storage Supabase devono contenere le librerie. Esegui **una volta** (o quando aggiorni le sorgenti):

```bash
cd scripts
npm install
export SUPABASE_URL="https://tuo-progetto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="la-tua-service-role-key"
npm run sync-to-vercel
```

Questo: clona i repo in `libs-sources/`, converte CSV/DBC in JSON, importa i dati in **Database** (vehicles, signals, dtc) e carica i file in **Storage** (bucket `libs`). Dopo il deploy, Vercel userà solo Supabase.

---

## 7. Protezione con password (sito su Vercel)

Se l’app è pubblica su Vercel e vuoi limitare l’accesso alla sola web UI:

1. In **Vercel** → progetto → **Settings → Environment Variables** aggiungi:
   - Nome: `SITE_PASSWORD`
   - Valore: la password che gli utenti dovranno inserire per accedere
2. Ridistribuisci il deploy.

Quando `SITE_PASSWORD` è impostata, tutte le pagine (home, dashboard, sessioni, ecc.) richiedono l’accesso da **/login**. Le route **/api/*** (ingest, sessions, firmware, vehicle detect, libs, ecc.) **non** sono mai bloccate dal middleware: l’ESP32 continua a funzionare normalmente e può inviare dati a `/api/ingest` e usare le altre API senza cookie di login (eventualmente protette da `API_KEY`). Dalla sidebar dell’app è disponibile il link **Esci** per uscire e richiedere di nuovo la password.

Se `SITE_PASSWORD` non è impostata, il sito resta accessibile senza login.

---

## 8. Riferimenti

- **README.md** — panoramica progetto, web, API, script.
- **ev-diagnostic-plan.md** — piano completo e step (Supabase, Vercel, script, firmware).
- **firmware/data/config.json** — template configurazione (opzionale da editare prima di `uploadfs`).
