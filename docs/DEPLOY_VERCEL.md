# Deploy su Vercel

Checklist per mettere in produzione l’app Next.js su Vercel.

## 1. Root Directory

- In **Vercel** → Project **Settings** → **General** → **Root Directory** imposta **`web`**.
- Il build deve partire da `web/` (dove si trovano `package.json` e `next.config.js`). Non usare la root del repo.

## 2. Variabili d’ambiente

In **Settings** → **Environment Variables** aggiungi (per **Production**, e opzionalmente Preview/Development):

| Variabile | Obbligatoria | Descrizione |
|-----------|--------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sì | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sì | Chiave anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sì | Service role key (operazioni server) |
| `API_KEY` | Consigliata | Chiave per ESP32 (header `X-API-Key`) |
| `ANTHROPIC_API_KEY` | Per AI | Per `/api/analyze` (Claude) |
| `SITE_PASSWORD` | No | Password per proteggere la UI (/login) |
| `FIRMWARE_VERSION` | No | Versione firmware OTA |
| `FIRMWARE_BINARY_URL` | No | URL pubblico del `.bin` per OTA |
| `VIN_DECODER_DATABASE_URL` | No | Override DB Corgi (default: CDN) |

Riferimento: `.env.example` in root (senza valori reali).

## 3. Build

- **Build Command:** `npm run build` (default con preset Next.js).
- **Output:** Vercel usa automaticamente `.next` per Next.js.
- Verifica in locale: `cd web && npm run build`.

## 4. Comportamento su Vercel

- **Import locale libs:** la route `/api/libs/import-local` (lettura da `libs-sources/converted`) su Vercel risponde con errore esplicito: usare **Import da URL** o **upload file** dalla pagina Libs.
- **CAN Sniffer (memoria):** i frame in memoria non sono condivisi tra istanze serverless; la persistenza avviene su tabella `can_frames` quando configurata.
- **Analisi AI:** `/api/analyze` ha `maxDuration = 60`; su piani con limite 10s la richiesta può andare in timeout (considerare piano Pro per timeout maggiori).

## 5. ESP32 dopo il deploy

- Nell’ESP32 (captive portal o riconfigurazione) imposta **URL server** con l’URL della deployment Vercel (es. `https://tuo-progetto.vercel.app`).
- Usa la stessa **API_KEY** configurata in Vercel nell’header `X-API-Key` delle richieste dal dispositivo.
