/**
 * Quick sanity check: parse SavvyCAN CSV and re-export.
 * Run from web/: npx tsx scripts/test-savvycan-csv.ts
 */
import { parseSavvyCanNativeCsv, exportToSavvyCanNativeCsv } from "../lib/savvycan-csv";

const csv =
  "Time Stamp,ID,Extended,Dir,Bus,LEN,D1,D2,D3,D4,D5,D6,D7,D8\n" +
  "1000,123,false,Rx,0,3,E8,45,85,\n" +
  "2000,456,true,Rx,0,2,01,02,";

const frames = parseSavvyCanNativeCsv(csv);
console.log("Parsed count:", frames.length);
console.log("First frame:", { id: frames[0]?.id, len: frames[0]?.len, data: frames[0]?.data });
console.log("Second frame:", { id: frames[1]?.id, len: frames[1]?.len, data: frames[1]?.data });

const out = exportToSavvyCanNativeCsv(frames);
const lines = out.split("\n");
console.log("Export lines:", lines.length);
console.log("Export line 2:", lines[1]);
console.log("OK");
