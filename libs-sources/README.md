# libs-sources

This directory is populated by the scripts in `scripts/`:

1. **sync-libs.ts** — Clones GitHub repos (from `LIBRARY_SOURCES`) here. Each repo gets a subfolder named after the repo (e.g. `OBD-PIDs-for-HKMC-EVs`, `PSA-CAN-RE`).

2. **convert-csv-to-json.ts** / **convert-dbc-to-json.ts** — Read CSV or DBC files from these clones and write internal JSON into `converted/`.

3. **import-to-supabase.ts** — Imports `converted/*.json` into Supabase: tables `vehicles`, `signals`, `dtc` and **Storage** bucket `libs` (one JSON file per library). Così tutto funziona su Vercel.

This folder is typically gitignored because it contains large cloned repos. To refresh:

```bash
cd scripts
npm install
npx tsx sync-libs.ts
npx tsx convert-csv-to-json.ts
npx tsx convert-dbc-to-json.ts
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then:
npx tsx import-to-supabase.ts
```
