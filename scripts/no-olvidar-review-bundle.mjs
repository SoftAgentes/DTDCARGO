/**
 * Ensambla el bundle del code review crypto de SDD-0025 (spec §7.6) en una
 * carpeta lista para comprimir y enviar al revisor externo.
 *
 * Uso:  node scripts/no-olvidar-review-bundle.mjs
 * Sale: no-olvidar-review-out/  (gitignored)
 *
 * Copia SOLO lo necesario para revisar el crypto — no expone secretos ni el
 * resto del repo. NO incluye .env ni el KEK (el KEK vive en Vault).
 */

import { mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "no-olvidar-review-out");

/** Archivos a incluir, con la subcarpeta destino dentro del bundle. */
const FILES = [
  // Primario (lo que el revisor firma)
  ["lib/studio/no-olvidar/crypto.ts", "crypto"],
  ["lib/studio/no-olvidar/key-manager.ts", "crypto"],
  ["lib/studio/no-olvidar/recovery.ts", "crypto"],
  // Contexto de apoyo
  ["lib/studio/no-olvidar/session.ts", "context"],
  ["lib/studio/no-olvidar/audit.ts", "context"],
  ["lib/studio/no-olvidar/totp.ts", "context"],
  ["lib/studio/no-olvidar-types.ts", "context"],
  // Schema + RLS + audit inmutable. La superficie SQL/RLS es PRIMARIA para el
  // review (el review interno del 2026-07-17 halló los graves ahí, no en libsodium).
  ["supabase/migrations/0250_no_olvidar.sql", "schema"],
  ["supabase/migrations/0251_no_olvidar_hardening.sql", "schema"],
  ["supabase/migrations/0252_no_olvidar_authz_hardening.sql", "schema"],
  // Tests (evidencia de comportamiento)
  ["tests/no-olvidar/crypto.test.ts", "tests"],
  ["tests/no-olvidar/recovery.test.ts", "tests"],
  ["tests/no-olvidar/session.test.ts", "tests"],
  ["tests/no-olvidar/totp.test.ts", "tests"],
  ["tests/no-olvidar/_fake-supabase.ts", "tests"],
  // Briefs
  ["docs/no-olvidar/review-bundle/README.md", "."],
  ["lib/studio/no-olvidar/RESUMEN.md", "."],
];

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const included = [];
for (const [rel, sub] of FILES) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.warn(`⚠ falta: ${rel} (se omite)`);
    continue;
  }
  const destDir = join(outDir, sub);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, basename(rel)));
  included.push(rel);
}

// Manifest para el revisor
const manifest = [
  "# No-Olvidar · manifest del bundle de review (SDD-0025 §7.6)",
  "",
  "Empezá por `README.md`. Orden de lectura sugerido:",
  "1. README.md  ·  2. schema/0250_no_olvidar.sql  ·  3. schema/0251 + 0252 (RLS/GRANT)",
  "4. crypto/crypto.ts  ·  5. crypto/key-manager.ts  ·  6. crypto/recovery.ts  ·  7. context/*  ·  8. tests/*",
  "",
  "## Archivos incluidos",
  ...included.map((f) => `- ${f}`),
  "",
  "Generado por scripts/no-olvidar-review-bundle.mjs. NO contiene secretos ni .env.",
].join("\n");
writeFileSync(join(outDir, "MANIFEST.md"), manifest, "utf8");

console.log(`✓ Bundle en: ${outDir}`);
console.log(`  ${included.length} archivos. Comprimí la carpeta y enviala al revisor.`);
console.log("  (carpeta gitignored — no se commitea)");
