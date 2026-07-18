/**
 * Gestión del KEK (Key Encryption Key) del No-Olvidar — SDD-0025 §4.2/§4.10.
 *
 * ┌─ REVIEW EXTERNO ─────────────────────────────────────────────────────────┐
 * │ Parte del bundle de code review crypto (spec §7.6): este archivo maneja  │
 * │ el material de clave maestra. Cambios requieren re-review.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * El KEK vive en Supabase Vault (extensión `vault`), NUNCA en .env/código/repo.
 * Solo se alcanza con service_role, vía la vista `vault.decrypted_secrets`. Por
 * eso TODAS las funciones acá exigen un cliente Supabase service_role (el que
 * devuelve lib/db/admin.ts::createAdminClient). Pasar el cliente SSR normal
 * (RLS) hará que las lecturas al schema `vault` devuelvan vacío.
 *
 * El KEK se guarda en Vault como base64 de 32 bytes (así se crea en el setup
 * post-deploy, spec §7.1: `encode(gen_random_bytes(32),'base64')`).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { aadDek, fromBase64, generateDek, KEY_BYTES, toBase64, unwrapDek, wrapDek } from "./crypto";

// ─── Caché in-memory del KEK activo (TTL 5 min, spec §lib crypto) ──

interface KekCacheEntry {
  version: number;
  key: Uint8Array;
  expiresAt: number;
}

const KEK_CACHE_TTL_MS = 5 * 60 * 1000;
/** Caché por versión de KEK. La versión activa se resuelve aparte (RPC). */
const kekByVersion = new Map<number, KekCacheEntry>();

/** Vacía la caché — llamar tras rotar el KEK para no servir la versión vieja. */
export function invalidateKekCache(): void {
  kekByVersion.clear();
}

// ─── Lectura del KEK ─────────────────────────────────────────

export interface ActiveKek {
  version: number;
  key: Uint8Array;
}

/**
 * Devuelve el KEK activo (versión + clave de 32 bytes). Cachea 5 min por
 * versión. Lanza si el No-Olvidar no está inicializado (KEK no creada
 * post-deploy — spec §7.1) o si el secret no aparece en Vault.
 *
 * @param supabase cliente service_role (createAdminClient).
 */
export async function getActiveKek(supabase: SupabaseClient): Promise<ActiveKek> {
  const { data: version, error } = await supabase.rpc("no_olvidar_get_active_kek_version");
  if (error) {
    throw new Error(`No se pudo leer la versión activa del KEK: ${error.message}`);
  }
  if (version == null) {
    throw new NoOlvidarNotInitializedError();
  }
  const key = await getKekByVersion(supabase, version as number);
  return { version: version as number, key };
}

/**
 * Devuelve la clave KEK de una versión concreta (para descifrar items legacy
 * tras una rotación). Cachea 5 min. Lanza si la versión no existe o el secret
 * no está en Vault.
 */
export async function getKekByVersion(
  supabase: SupabaseClient,
  version: number,
): Promise<Uint8Array> {
  const cached = kekByVersion.get(version);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // 1) nombre del secret en Vault para esa versión
  const { data: row, error: rowErr } = await supabase
    .from("no_olvidar_kek_versions")
    .select("kek_secret_name")
    .eq("version", version)
    .maybeSingle<{ kek_secret_name: string }>();
  if (rowErr) throw new Error(`Error leyendo no_olvidar_kek_versions: ${rowErr.message}`);
  if (!row) throw new Error(`No existe versión de KEK ${version}.`);

  // 2) secret descifrado desde Vault (requiere service_role)
  const { data: secretRow, error: secretErr } = await supabase
    .schema("vault")
    .from("decrypted_secrets")
    .select("decrypted_secret")
    .eq("name", row.kek_secret_name)
    .maybeSingle<{ decrypted_secret: string }>();
  if (secretErr) {
    throw new Error(
      `No se pudo leer el KEK '${row.kek_secret_name}' de Vault (¿service_role? ¿schema vault expuesto?): ${secretErr.message}`,
    );
  }
  if (!secretRow?.decrypted_secret) {
    throw new Error(`Vault no devolvió el secret '${row.kek_secret_name}'.`);
  }

  const key = fromBase64(secretRow.decrypted_secret.trim());
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `El KEK '${row.kek_secret_name}' mide ${key.length} bytes, se esperaban ${KEY_BYTES}.`,
    );
  }

  kekByVersion.set(version, { version, key, expiresAt: Date.now() + KEK_CACHE_TTL_MS });
  return key;
}

// ─── Rotación del KEK (§4.10) ────────────────────────────────

export interface RotateResult {
  oldVersion: number;
  newVersion: number;
  secretName: string;
}

/**
 * Rota el KEK: genera uno nuevo (32 bytes), lo guarda en Vault y marca el
 * anterior como legacy vía RPC `no_olvidar_rotate_kek`. NO re-envuelve items —
 * eso lo hace `reEncryptAllItems` a continuación (el caller orquesta ambos).
 *
 * @param actor uuid del admin que dispara la rotación (validado admin en el RPC).
 */
export async function rotateKek(
  supabase: SupabaseClient,
  actor: string,
): Promise<RotateResult> {
  // versión nueva = max(version)+1
  const { data: maxRow } = await supabase
    .from("no_olvidar_kek_versions")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>();
  const oldVersion = maxRow?.version ?? 0;
  const newVersion = oldVersion + 1;
  const secretName = `no_olvidar_kek_v${newVersion}`;

  // 1) crear el secret nuevo en Vault vía RPC restringido a service_role
  //    (no_olvidar_create_kek_secret, migración 0224) — así no hay que exponer
  //    el schema `vault` a PostgREST.
  const newKek = await generateDek(); // 32 bytes random del CSPRNG de libsodium
  const { error: createErr } = await supabase.rpc("no_olvidar_create_kek_secret", {
    p_name: secretName,
    p_secret: toBase64(newKek),
    p_description: `KEK No-Olvidar v${newVersion} · rotada por ${actor}`,
  });
  if (createErr) {
    throw new Error(`No se pudo crear el secret '${secretName}' en Vault: ${createErr.message}`);
  }

  // 2) marcar viejo legacy + registrar la nueva versión (RPC valida admin)
  const { error: rotErr } = await supabase.rpc("no_olvidar_rotate_kek", {
    p_new_secret_name: secretName,
    p_actor: actor,
  });
  if (rotErr) {
    throw new Error(`RPC no_olvidar_rotate_kek falló: ${rotErr.message}`);
  }

  invalidateKekCache();
  return { oldVersion, newVersion, secretName };
}

/**
 * Re-envuelve todos los items de `fromVersion` con el KEK de `toVersion`:
 * desenvuelve el DEK con el KEK viejo y lo vuelve a envolver con el nuevo. El
 * payload (ciphertext) NO se toca — sigue cifrado con el mismo DEK. Idempotente:
 * solo mira `key_version = fromVersion`, así que re-correrlo encuentra 0.
 *
 * Devuelve la cantidad de items re-envueltos. No audita: la rotación ya quedó
 * registrada (action=kek_rotated) por el RPC en rotateKek; el caller (Fase 3)
 * puede añadir un audit con el count final si lo desea.
 */
export async function reEncryptAllItems(
  supabase: SupabaseClient,
  fromVersion: number,
  toVersion: number,
): Promise<number> {
  if (fromVersion === toVersion) return 0;
  const oldKek = await getKekByVersion(supabase, fromVersion);
  const newKek = await getKekByVersion(supabase, toVersion);

  const PAGE = 200;
  let migrated = 0;

  // Se pagina siempre desde offset 0: cada UPDATE saca la fila del filtro
  // (key_version deja de ser fromVersion), así el "siguiente" lote vuelve a
  // ser el primero. Evita saltarse filas por desplazamiento de offset.
  for (;;) {
    const { data, error } = await supabase
      .from("no_olvidar_items")
      .select("id, user_id, dek_encrypted, dek_nonce")
      .eq("key_version", fromVersion)
      .limit(PAGE);
    if (error) throw new Error(`Error leyendo items para re-encrypt: ${error.message}`);
    const rows = (data ?? []) as {
      id: string;
      user_id: string;
      dek_encrypted: string;
      dek_nonce: string;
    }[];
    if (rows.length === 0) break;

    for (const row of rows) {
      // El AAD del DEK está atado al dueño (no a la versión) → el re-wrap usa el
      // MISMO AAD con la KEK nueva. Ver aadDek en crypto.ts.
      const dekAad = aadDek(row.user_id);
      const dek = await unwrapDek(
        fromBase64(row.dek_encrypted),
        fromBase64(row.dek_nonce),
        oldKek,
        dekAad,
      );
      const rewrapped = await wrapDek(dek, newKek, dekAad);
      const { error: upErr } = await supabase
        .from("no_olvidar_items")
        .update({
          dek_encrypted: toBase64(rewrapped.wrapped),
          dek_nonce: toBase64(rewrapped.nonce),
          key_version: toVersion,
        })
        .eq("id", row.id)
        .eq("key_version", fromVersion); // guard anti-carrera: no re-tocar si ya migró
      if (upErr) throw new Error(`Error re-envolviendo item ${row.id}: ${upErr.message}`);
      migrated += 1;
    }
  }

  return migrated;
}

// ─── Errores ─────────────────────────────────────────────────

/** El No-Olvidar no tiene KEK activo → setup post-deploy pendiente (§7.1). */
export class NoOlvidarNotInitializedError extends Error {
  constructor() {
    super(
      "No-Olvidar no inicializado: no hay KEK activo. Ejecutá el setup post-deploy (spec §7.1).",
    );
    this.name = "NoOlvidarNotInitializedError";
  }
}
