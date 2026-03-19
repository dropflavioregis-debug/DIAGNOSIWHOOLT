# Test firmware ESP32-S3

## Build (richiede PlatformIO)

```bash
cd firmware
pio run
```

Se PlatformIO non è installato: `pip install platformio` oppure installa l’estensione PlatformIO in VS Code.

## Verifica funzioni principali

### 1. ISO-TP (uds_client.cpp)
- **Flow Control**: dopo il First Frame viene inviato un frame FC (0x30, 0x00, 0x00) su `s_requestId` così l’ECU invia i Consecutive Frame.
- **Sequence number**: `expectedSn = (expectedSn + 1) & 0x0F` (0→1…15→0, ISO 15765-2).
- **isVinChar**: parentesi corrette per evitare warning.

### 2. Vehicle detection (main.cpp + api_client)
- `postVehicleDetectWithResponse` invia il fingerprint e legge la risposta.
- `parseVehicleIdFromResponse` estrae `vehicle_id` dalla risposta.
- L’UUID restituito viene usato per `getLibJson` e `saveLibToSpiffs` (niente più UUID hardcoded).
- `s_vehicle_id` viene impostato e usato in ingest e nel loop di telemetria.

### 3. Telemetria (main.cpp)
- `buildIngestBody` costruisce il JSON con ArduinoJson.
- Se `s_vehicle_id` è impostato e la lib è su LittleFS: carica la lib, per ogni segnale con `did` chiama `readDataByIdentifier(did)`, aggiunge `name`, `value`, `raw_value` a `readings`.
- Chiama `readDTC()`, decodifica i byte in stringhe tipo "P0123" con `decodeDtcResponse`, le mette in `raw_dtc`.
- Payload ingest: `device_id`, `session_id`, `vin`, `vehicle_id`, `readings[]`, `raw_dtc[]`.

### 4. OTA (ota_manager.cpp)
- Prima di `getSize()` viene chiamato `httpBin.GET()` così la risposta (e Content-Length) è disponibile.
- Il download del binario OTA può completarsi correttamente.

### 5. Backend ingest (web)
- Se un reading ha `name` ma non `signal_id`, viene risolto `signal_id` da `session.vehicle_id` + `name` sulla tabella `signals`.
- I readings inviati dal firmware (solo `name` + `value` + `raw_value`) vengono quindi persistiti correttamente.

## Test manuale consigliato

1. **Build**: `pio run` senza errori.
2. **Upload**: collegare ESP32-S3, `pio run -t upload`.
3. **Upload FS**: `pio run -t uploadfs` (config + cartella libs).
4. **Serial**: `pio device monitor` per vedere log (Vehicle detect OK, Lib saved, Ingest OK, eventuali errori UDS/CAN).
5. **Con veicolo**: con CAN collegato e lib con DIDs, verificare che in ingest arrivino `readings` e `raw_dtc` non vuoti (dashboard/session).
