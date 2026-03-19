#!/usr/bin/env npx tsx
/**
 * Clone or update GitHub repos from LIBRARY_SOURCES into ../libs-sources/
 * Usage: npx tsx sync-libs.ts
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_SOURCES, type LibrarySource } from "./sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIBS_SOURCES_DIR = path.join(ROOT, "libs-sources");

function slugFromRepo(repo: string): string {
  const match = repo.match(/\/([^/]+?)(?:\.git)?$/);
  return match ? match[1] : repo.replace(/[^a-zA-Z0-9-]/g, "_");
}

function slugFromName(name: string): string {
  return name
    .replace(/\s*[-–]\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function cloneOrPull(repo: string, destDir: string, src?: LibrarySource): boolean {
  if (fs.existsSync(destDir)) {
    try {
      execSync("git pull --rebase", { cwd: destDir, stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }
  try {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    const sparse = src?.sparseCheckout?.length;
    const noSubmodules = src?.format === "can_reference";
    if (sparse) {
      execSync(
        `git clone --depth 1 --filter=blob:none --sparse "${repo}" "${destDir}"`,
        { stdio: "pipe" }
      );
      execSync(`git sparse-checkout set ${src!.sparseCheckout!.join(" ")}`, {
        cwd: destDir,
        stdio: "pipe",
      });
    } else if (noSubmodules) {
      execSync(`git clone --depth 1 --no-recurse-submodules "${repo}" "${destDir}"`, {
        stdio: "pipe",
      });
    } else {
      execSync(`git clone --depth 1 "${repo}" "${destDir}"`, { stdio: "pipe" });
    }
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(LIBS_SOURCES_DIR)) {
    fs.mkdirSync(LIBS_SOURCES_DIR, { recursive: true });
  }

  for (const src of LIBRARY_SOURCES) {
    if (src.type === "obdb_org") {
      console.log(`Skip (org): ${src.name} — clone repos manually if needed`);
      continue;
    }
    const slug = slugFromRepo(src.repo) || slugFromName(src.name);
    const dest = path.join(LIBS_SOURCES_DIR, slug);
    const ok = cloneOrPull(src.repo, dest, src);
    console.log(ok ? `OK ${slug}` : `FAIL ${slug} (${src.repo})`);
  }

  console.log("Done. Output under libs-sources/");
}

main();
