"use server";

/**
 * Server actions del No-Olvidar interno DTD-CARGO (SDD-0025 Fase 3, backbone).
 *
 * Cablea el crypto (lib/studio/no-olvidar/*) con la DB. Patrón del Studio:
 * "use server" + parsing/validación manual con los validate*Input() de
 * no-olvidar-types (NO Zod) + revalidatePath.
 *
 * Dos clientes Supabase:
 *   - SSR (createClient): respeta RLS → lecturas/escrituras del propio user.
 *   - Admin (createAdminClient, service_role): SOLO para lo que exige bypass —
 *     leer el KEK de Vault, insertar en el audit log (append-only), y las
 *     mutaciones de recovery (approve/execute) que el GRANT restringe a
 *     service_role. NUNCA se usa para leer items de otro user.
 *
 * Modelo V1: el cifrado ocurre acá (server-side); el plaintext llega del form
 * por TLS y se cifra antes de tocar la DB. El material cifrado se guarda como
 * base64 (columnas text). Ver lib/studio/no-olvidar/crypto.ts.
 *
 * ⚠️ No corre en runtime hasta aplicar migraciones 0017+0224 y crear el KEK
 * (runbook §1-2). Es wiring: la corrección del crypto la cubren los tests de
 * lib + el code review externo.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  aadDek,
  aadItem,
  aadTotp,
  decryptPayload,
  encryptPayload,
  fromBase64,
  generateDek,
  generateRecoveryKit,
  generateSalt,
  hashForVerifier,
  hashRecoveryKit,
  toBase64,
  unwrapDek,
  verifyMasterPassword,
  wipe,
  wrapDek,
} from "@/lib/studio/no-olvidar/crypto";
import {
  getActiveKek,
  getKekByVersion,
  reEncryptAllItems,
  rotateKek,
} from "@/lib/studio/no-olvidar/key-manager";
import { logAccess } from "@/lib/studio/no-olvidar/audit";
import {
  incrementFailedAttempt,
  markUnlocked,
  validateUnlockSession,
} from "@/lib/studio/no-olvidar/session";
import {
  approveRecovery,
  executeRecovery,
  rejectRecovery,
  requestRecovery,
  RecoveryPolicyError,
  RecoveryStateError,
} from "@/lib/studio/no-olvidar/recovery";
import { generateTotpSecret, verifyTotpWithStep } from "@/lib/studio/no-olvidar/totp";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateCreateItemInput,
  validateMasterPasswordInput,
  validateRecoveryRequestInput,
  validateUpdateItemInput,
  type NoOlvidarActionState,
  type NoOlvidarCategory,
  type NoOlvidarItemPlaintext,
} from "@/lib/studio/no-olvidar-types";

const BASE_PATH = "/studio/no-olvidar";

// ─── Errores seguros (no filtrar SQL/tabla al cliente) ───────

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** Detecta el caso "módulo sin instalar" (migraciones 0250-0252 / KEK sin aplicar). */
function looksLikeMissingSchema(raw: string): boolean {
  return /schema cache|does not exist|could not find the table|relation .* does not|undefined table/i.test(raw);
}

/**
 * Mensaje de error seguro para el usuario. Loguea el crudo server-side y NUNCA
 * filtra detalles de Postgres/PostgREST (nombres de tabla, schema cache) al
 * cliente (regla del repo: nunca `error.message` crudo). Si el módulo aún no
 * está instalado, lo dice claro en vez del error interno.
 */
function noOlvidarError(friendly: string, e: unknown): string {
  const raw = extractMessage(e);
  console.error(`[no-olvidar] ${friendly} —`, raw);
  if (looksLikeMissingSchema(raw)) {
    return "El No-Olvidar todavía no está disponible: falta completar su instalación. Avisa a un administrador.";
  }
  return friendly;
}

/**
 * Mensaje para errores del flujo de recovery. Solo propaga el texto de errores
 * de DOMINIO conocidos (RecoveryStateError/RecoveryPolicyError, seguros y en
 * es-VE). Cualquier otro Error (DB/PostgREST) se loguea server-side y devuelve
 * genérico — no filtrar nombres de tabla/constraint/schema al cliente (allow-list,
 * no deny-list: el filtro por keyword se saltaba `permission denied`, constraints,
 * etc.). Review 2026-07-18.
 */
function noOlvidarDomainError(e: unknown): string {
  if (e instanceof RecoveryStateError || e instanceof RecoveryPolicyError) {
    return e.message;
  }
  console.error("[no-olvidar] error de recovery —", extractMessage(e));
  return "No se pudo completar la operación de recuperación. Avisa a un administrador.";
}

// ─── Helpers de contexto ─────────────────────────────────────

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function getAuthedUserId(supabase: SupabaseLike): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** ip + user-agent del request (para el audit). Nunca del form. Degrada a null. */
async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0]!.trim() : null;
    const ua = h.get("user-agent")?.slice(0, 300) ?? null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

/**
 * Backstop RBAC server-side (SDD-0085): las server actions son endpoints POST
 * invocables directo, así que el gate de módulo del layout.tsx NO las cubre —
 * cada action debe validar su propio permiso. Devuelve el mensaje de denegación
 * o null. Ver rbac-guard.moduleEditDenial.
 */
async function requireModule(supabase: SupabaseLike): Promise<string | null> {
  return moduleEditDenial(supabase, "no-olvidar");
}

/**
 * Exige que el No-Olvidar esté desbloqueado (sesión 2FA vigente) para el user.
 * Devuelve error listo para la action si no, o null si OK.
 */
async function requireUnlocked(
  supabase: SupabaseLike,
  userId: string,
): Promise<string | null> {
  const state = await validateUnlockSession(supabase, userId);
  if (state.locked) return "Tu No-Olvidar está bloqueado por intentos fallidos. Esperá el desbloqueo.";
  if (!state.unlocked) return "Tu sesión del No-Olvidar expiró. Verificá el 2FA de nuevo.";
  return null;
}

/** Arma el payload plaintext según la categoría, leyendo los campos del form. */
function buildPlaintext(category: NoOlvidarCategory, fd: FormData): NoOlvidarItemPlaintext {
  const s = (k: string) => (fd.get(k)?.toString() ?? "").trim();
  switch (category) {
    case "login":
      return {
        kind: "login",
        password: s("password"),
        ...(s("totp") ? { totp: s("totp") } : {}),
        ...(s("notes") ? { notes: s("notes") } : {}),
      };
    case "card":
      return {
        kind: "card",
        number: s("number"),
        cvc: s("cvc"),
        expiry: s("expiry"),
        holder: s("holder"),
        ...(s("notes") ? { notes: s("notes") } : {}),
      };
    case "note":
      return { kind: "note", body: s("body") };
    case "totp":
      return { kind: "totp", secret: s("secret"), label: s("label") };
  }
}

// ─── Setup wizard ────────────────────────────────────────────

export interface SetupResult extends NoOlvidarActionState {
  /** Recovery kit de 24 palabras — se muestra UNA vez para imprimir. */
  recoveryKit?: string;
}

/**
 * Completa el wizard de primer uso: verifica el TOTP, cifra el secret con el
 * KEK, genera+hashea el recovery kit, fija la master password (opcional) y marca
 * setup_completed. Devuelve el recovery kit para mostrarlo una vez.
 *
 * Espera en el form: `totp_secret` (el generado y mostrado en el QR),
 * `totp_code` (6 dígitos para verificar), `master_password` (opcional),
 * `terms` (= "on").
 */
export async function setupNoOlvidarAction(
  _prev: SetupResult,
  fd: FormData,
): Promise<SetupResult> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  if (fd.get("terms") !== "on") {
    return { fieldErrors: { terms: "Tenés que aceptar los términos para continuar." } };
  }

  // Anti re-enrolamiento del 2FA: si el vault YA está configurado, este flujo no
  // puede correr — verificaría el TOTP contra el secret del propio form (elegido
  // por quien llama) y reabriría la sesión. Re-enrolar el 2FA va por recovery
  // M-of-N. (Review 2026-07-18, hallazgo crítico de toma de vault con sesión
  // robada.)
  const { data: existing } = await supabase
    .from("no_olvidar_user_keys")
    .select("setup_completed")
    .eq("user_id", userId)
    .maybeSingle<{ setup_completed: boolean }>();
  if (existing?.setup_completed) {
    return {
      error:
        "Tu No-Olvidar ya está configurado. Para cambiar el 2FA usá el flujo de recuperación (recovery).",
    };
  }

  const totpSecret = (fd.get("totp_secret")?.toString() ?? "").trim() || generateTotpSecret();
  const totpCode = (fd.get("totp_code")?.toString() ?? "").trim();
  const totpCheck = verifyTotpWithStep(totpCode, totpSecret);
  if (!totpCheck.valid) {
    return { fieldErrors: { totp_code: "El código 2FA no coincide. Reintentá." } };
  }

  // Master password OPCIONAL: si viene, validar.
  const rawPw = fd.get("master_password")?.toString() ?? "";
  let masterVerifier: string | null = null;
  let masterSalt: string | null = null;
  if (rawPw.length > 0) {
    const { input, fieldErrors } = validateMasterPasswordInput({ password: rawPw });
    if (fieldErrors) return { fieldErrors };
    const salt = await generateSalt();
    masterSalt = toBase64(salt);
    masterVerifier = toBase64(await hashForVerifier(input!.password, salt));
  }

  const admin = createAdminClient();
  let totpCiphertext: string;
  let totpNonce: string;
  let totpKeyVersion: number;
  try {
    const { version, key } = await getActiveKek(admin);
    const sealed = await encryptPayload(totpSecret, key, aadTotp(userId));
    totpCiphertext = toBase64(sealed.ciphertext);
    totpNonce = toBase64(sealed.nonce);
    totpKeyVersion = version; // guardar la versión para poder descifrar tras rotar
  } catch (e) {
    return { error: noOlvidarError("No se pudo inicializar el cifrado.", e) };
  }

  // Recovery kit: generar, mostrar una vez, guardar SOLO el hash.
  const recoveryKit = await generateRecoveryKit();
  const kitSalt = await generateSalt();
  const kitHash = toBase64(await hashRecoveryKit(recoveryKit, kitSalt));

  // Escritura de columnas sensibles (role/verifier/totp/setup/last_unlock) va por
  // service_role: authenticated ya NO tiene UPDATE sobre user_keys (migr 0225,
  // cierre de la escalada de privilegios). Scoping por .eq("user_id", userId).
  const { error } = await admin
    .from("no_olvidar_user_keys")
    .update({
      has_master_password: masterVerifier != null,
      master_password_verifier: masterVerifier,
      master_password_salt: masterSalt,
      recovery_kit_hash: kitHash,
      recovery_kit_salt: toBase64(kitSalt),
      totp_secret_ciphertext: totpCiphertext,
      totp_secret_nonce: totpNonce,
      totp_secret_key_version: totpKeyVersion,
      totp_last_step: totpCheck.step, // consumir el código de enrolamiento (anti-replay)
      totp_enabled: true,
      setup_completed: true,
      last_unlock_at: new Date().toISOString(), // el setup deja la sesión abierta
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) return { error: noOlvidarError("No se pudo completar el setup.", error) };

  const meta = await clientMeta();
  await logAccess(admin, { userId, action: "unlock", ip: meta.ip, ua: meta.ua, metadata: { setup: true } });
  revalidatePath(BASE_PATH);
  return { ok: true, recoveryKit };
}

// ─── Unlock (2FA gate) ───────────────────────────────────────

/**
 * Verifica el 2FA (+ master password si el user la configuró) y marca la sesión
 * desbloqueada. Cuenta intentos fallidos (lockout tras el umbral). Espera en el
 * form: `totp_code`, `master_password` (si aplica).
 */
export async function unlockNoOlvidarAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  const state = await validateUnlockSession(supabase, userId);
  if (state.locked) {
    return { error: "Estás bloqueado por intentos fallidos. Esperá al desbloqueo." };
  }

  const { data: keys, error: keysErr } = await supabase
    .from("no_olvidar_user_keys")
    .select(
      "has_master_password, master_password_verifier, master_password_salt, totp_secret_ciphertext, totp_secret_nonce, totp_secret_key_version, totp_last_step",
    )
    .eq("user_id", userId)
    .maybeSingle<{
      has_master_password: boolean;
      master_password_verifier: string | null;
      master_password_salt: string | null;
      totp_secret_ciphertext: string;
      totp_secret_nonce: string;
      totp_secret_key_version: number | null;
      totp_last_step: number | null;
    }>();
  if (keysErr || !keys) return { error: "No se pudo leer tu configuración del No-Olvidar." };

  const admin = createAdminClient();

  // TOTP: descifrar con la MISMA versión de KEK con la que se cifró (no la
  // activa) — si no, tras una rotación el 2FA queda ilegible. Fallback a la
  // activa solo para filas legacy sin versión guardada.
  let totpSecret: string;
  try {
    const kek =
      keys.totp_secret_key_version != null
        ? await getKekByVersion(admin, keys.totp_secret_key_version)
        : (await getActiveKek(admin)).key;
    totpSecret = await decryptPayload(
      fromBase64(keys.totp_secret_ciphertext),
      fromBase64(keys.totp_secret_nonce),
      kek,
      aadTotp(userId),
    );
  } catch (e) {
    return { error: noOlvidarError("No se pudo verificar el 2FA.", e) };
  }

  const totpCheck = verifyTotpWithStep((fd.get("totp_code")?.toString() ?? "").trim(), totpSecret);
  // Anti-replay (§4.5): un código válido de la ventana no se puede reusar. El
  // step que casó debe ser estrictamente mayor al último consumido.
  const replayed =
    totpCheck.valid &&
    keys.totp_last_step != null &&
    totpCheck.step != null &&
    totpCheck.step <= keys.totp_last_step;
  const totpOk = totpCheck.valid && !replayed;

  let pwOk = true;
  if (keys.has_master_password && keys.master_password_verifier && keys.master_password_salt) {
    pwOk = await verifyMasterPassword(
      fd.get("master_password")?.toString() ?? "",
      fromBase64(keys.master_password_salt),
      fromBase64(keys.master_password_verifier),
    );
  }

  if (!totpOk || !pwOk) {
    const r = await incrementFailedAttempt(supabase, userId);
    return {
      error: r.locked
        ? "Demasiados intentos fallidos. Tu No-Olvidar quedó bloqueado temporalmente."
        : "Código 2FA o master password incorrectos.",
    };
  }

  // markUnlocked resetea last_unlock_at/failed_unlock_attempts/locked_until y
  // persiste el step TOTP consumido (anti-replay) → columnas sensibles: va por
  // service_role (authenticated ya no tiene UPDATE sobre user_keys). El TOTP ya
  // se verificó server-side arriba.
  await markUnlocked(admin, userId, totpCheck.step);
  const meta = await clientMeta();
  await logAccess(admin, { userId, action: "unlock", ip: meta.ip, ua: meta.ua });
  revalidatePath(BASE_PATH);
  return { ok: true };
}

// ─── Crear item ──────────────────────────────────────────────

/**
 * Cifra el payload con un DEK nuevo, envuelve el DEK con el KEK activo e inserta
 * el item (RLS exige owner + setup_completed). Audita 'create'.
 */
export async function createItemAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  const gate = await requireUnlocked(supabase, userId);
  if (gate) return { error: gate };

  const category = fd.get("category")?.toString() as NoOlvidarCategory | undefined;
  if (!category) return { fieldErrors: { category: "Categoría requerida." } };

  const admin = createAdminClient();
  let sealedPayload: { ciphertext: string; nonce: string; dekWrapped: string; dekNonce: string; keyVersion: number };
  try {
    const { version, key: kek } = await getActiveKek(admin);
    const dek = await generateDek();
    const plaintext = JSON.stringify(buildPlaintext(category, fd));
    const sealed = await encryptPayload(plaintext, dek, aadItem(userId));
    const wrapped = await wrapDek(dek, kek, aadDek(userId));
    wipe(dek); // el DEK en claro no se necesita más
    sealedPayload = {
      ciphertext: toBase64(sealed.ciphertext),
      nonce: toBase64(sealed.nonce),
      dekWrapped: toBase64(wrapped.wrapped),
      dekNonce: toBase64(wrapped.nonce),
      keyVersion: version,
    };
  } catch (e) {
    return { error: noOlvidarError("No se pudo cifrar el item.", e) };
  }

  const { input, fieldErrors } = validateCreateItemInput({
    name: fd.get("name")?.toString(),
    category,
    url: fd.get("url")?.toString() || undefined,
    username: fd.get("username")?.toString() || undefined,
    notes_preview: fd.get("notes_preview")?.toString() || undefined,
    favorite: fd.get("favorite") === "on",
    ciphertext: sealedPayload.ciphertext,
    nonce: sealedPayload.nonce,
    dek_encrypted: sealedPayload.dekWrapped,
    dek_nonce: sealedPayload.dekNonce,
    key_version: sealedPayload.keyVersion,
  });
  if (fieldErrors) return { fieldErrors };

  const { data, error } = await supabase
    .from("no_olvidar_items")
    .insert({
      user_id: userId,
      name: input!.name,
      category: input!.category,
      url: input!.url ?? null,
      username: input!.username ?? null,
      notes_preview: input!.notes_preview ?? null,
      favorite: input!.favorite ?? false,
      ciphertext: input!.ciphertext,
      nonce: input!.nonce,
      dek_encrypted: input!.dek_encrypted,
      dek_nonce: input!.dek_nonce,
      key_version: input!.key_version,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: noOlvidarError("No se pudo guardar el item.", error) };

  const meta = await clientMeta();
  await logAccess(admin, { userId, itemId: data.id, action: "create", ip: meta.ip, ua: meta.ua });
  revalidatePath(BASE_PATH);
  return { ok: true, itemId: data.id };
}

// ─── Revelar item ────────────────────────────────────────────

export interface RevealResult {
  ok?: boolean;
  error?: string;
  plaintext?: NoOlvidarItemPlaintext;
}

/**
 * Descifra y devuelve el plaintext de un item (owner vía RLS). Audita 'view'.
 * NO cachea nada server-side; el plaintext vive solo en la respuesta.
 */
export async function revealItemAction(itemId: string): Promise<RevealResult> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  const gate = await requireUnlocked(supabase, userId);
  if (gate) return { error: gate };

  const { data: item, error } = await supabase
    .from("no_olvidar_items")
    .select("ciphertext, nonce, dek_encrypted, dek_nonce, key_version")
    .eq("id", itemId)
    .eq("user_id", userId) // defensa en profundidad además de RLS
    .is("deleted_at", null)
    .maybeSingle<{
      ciphertext: string;
      nonce: string;
      dek_encrypted: string;
      dek_nonce: string;
      key_version: number;
    }>();
  if (error || !item) return { error: "Item no encontrado." };

  const admin = createAdminClient();
  try {
    const kek = await getKekByVersion(admin, item.key_version);
    const dek = await unwrapDek(
      fromBase64(item.dek_encrypted),
      fromBase64(item.dek_nonce),
      kek,
      aadDek(userId),
    );
    const raw = await decryptPayload(
      fromBase64(item.ciphertext),
      fromBase64(item.nonce),
      dek,
      aadItem(userId),
    );
    wipe(dek); // el DEK en claro no se necesita más
    const plaintext = JSON.parse(raw) as NoOlvidarItemPlaintext;

    const meta = await clientMeta();
    await logAccess(admin, { userId, itemId, action: "view", ip: meta.ip, ua: meta.ua });
    return { ok: true, plaintext };
  } catch (e) {
    return { error: noOlvidarError("No se pudo descifrar el item.", e) };
  }
}

/** Audita un 'copy' (el copy real lo hace el cliente con navigator.clipboard). */
export async function copyItemFieldAction(itemId: string, field: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return;
  if (await requireModule(supabase)) return;

  // Validar ownership antes de auditar: sin esto un authed inyecta filas 'copy'
  // con cualquier item_id (incluso ajeno) → ruido/envenenamiento del audit log.
  const { data: owned } = await supabase
    .from("no_olvidar_items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (!owned) return;

  const admin = createAdminClient();
  const meta = await clientMeta();
  await logAccess(admin, { userId, itemId, action: "copy", ip: meta.ip, ua: meta.ua, metadata: { field } });
}

// ─── Editar item ─────────────────────────────────────────────

/**
 * Actualiza metadata y/o re-cifra el payload (si vienen campos sensibles).
 * Re-cifra con un DEK nuevo envuelto por el KEK activo. Audita 'edit'.
 */
export async function updateItemAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  const gate = await requireUnlocked(supabase, userId);
  if (gate) return { error: gate };

  const id = fd.get("id")?.toString();
  if (!id) return { fieldErrors: { id: "Falta el id del item." } };
  const category = fd.get("category")?.toString() as NoOlvidarCategory | undefined;
  const reEncrypt = fd.get("re_encrypt") === "on";

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fd.get("name") != null) patch.name = fd.get("name")!.toString().trim();
  if (fd.get("url") != null) patch.url = fd.get("url")!.toString().trim() || null;
  if (fd.get("username") != null) patch.username = fd.get("username")!.toString().trim() || null;
  if (fd.get("notes_preview") != null) patch.notes_preview = fd.get("notes_preview")!.toString().slice(0, 60) || null;
  if (fd.get("favorite") != null) patch.favorite = fd.get("favorite") === "on";

  if (reEncrypt) {
    if (!category) return { fieldErrors: { category: "Categoría requerida para re-cifrar." } };
    const admin = createAdminClient();
    try {
      const { version, key: kek } = await getActiveKek(admin);
      const dek = await generateDek();
      const sealed = await encryptPayload(JSON.stringify(buildPlaintext(category, fd)), dek, aadItem(userId));
      const wrapped = await wrapDek(dek, kek, aadDek(userId));
      wipe(dek); // el DEK en claro no se necesita más
      patch.ciphertext = toBase64(sealed.ciphertext);
      patch.nonce = toBase64(sealed.nonce);
      patch.dek_encrypted = toBase64(wrapped.wrapped);
      patch.dek_nonce = toBase64(wrapped.nonce);
      patch.key_version = version;
    } catch (e) {
      return { error: noOlvidarError("No se pudo re-cifrar el contenido.", e) };
    }
  }

  // Validación (all-or-none del bloque cifrado).
  const { fieldErrors } = validateUpdateItemInput({
    id,
    category,
    name: patch.name as string | undefined,
    ciphertext: patch.ciphertext as string | undefined,
    nonce: patch.nonce as string | undefined,
    dek_encrypted: patch.dek_encrypted as string | undefined,
    dek_nonce: patch.dek_nonce as string | undefined,
  });
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("no_olvidar_items")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId); // defensa en profundidad además de RLS
  if (error) return { error: noOlvidarError("No se pudo actualizar el item.", error) };

  const admin = createAdminClient();
  const meta = await clientMeta();
  await logAccess(admin, { userId, itemId: id, action: "edit", ip: meta.ip, ua: meta.ua });
  revalidatePath(BASE_PATH);
  return { ok: true, itemId: id };
}

/** Soft delete (deleted_at = now). Audita 'delete'. */
export async function softDeleteItemAction(itemId: string): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  // Operación destructiva → exige sesión 2FA vigente, igual que create/reveal/update.
  const gate = await requireUnlocked(supabase, userId);
  if (gate) return { error: gate };

  const { error } = await supabase
    .from("no_olvidar_items")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId); // defensa en profundidad además de RLS
  if (error) return { error: noOlvidarError("No se pudo eliminar el item.", error) };

  const admin = createAdminClient();
  const meta = await clientMeta();
  await logAccess(admin, { userId, itemId, action: "delete", ip: meta.ip, ua: meta.ua });
  revalidatePath(BASE_PATH);
  return { ok: true };
}

// ─── Recovery ────────────────────────────────────────────────

export async function requestRecoveryAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };

  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateRecoveryRequestInput({ reason: fd.get("reason")?.toString() });
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();
  try {
    const req = await requestRecovery(admin, userId, input!.reason);
    revalidatePath(BASE_PATH);
    return { ok: true, recoveryId: req.id };
  } catch (e) {
    return { error: noOlvidarError("No se pudo crear el pedido de recuperación.", e) };
  }
}

export async function approveRecoveryAction(recoveryId: string): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  const admin = createAdminClient();
  const meta = await clientMeta();
  try {
    await approveRecovery(admin, recoveryId, userId, meta.ip ?? undefined);
    revalidatePath(`${BASE_PATH}/admin`);
    return { ok: true, recoveryId };
  } catch (e) {
    return { error: noOlvidarDomainError(e) };
  }
}

export async function rejectRecoveryAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  const recoveryId = fd.get("recovery_id")?.toString();
  if (!recoveryId) return { error: "Falta el id del pedido." };

  const admin = createAdminClient();
  try {
    await rejectRecovery(admin, recoveryId, userId, fd.get("reason")?.toString() ?? "");
    revalidatePath(`${BASE_PATH}/admin`);
    return { ok: true, recoveryId };
  } catch (e) {
    return { error: noOlvidarDomainError(e) };
  }
}

export async function executeRecoveryAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };

  const denial = await requireModule(supabase);
  if (denial) return { error: denial };
  const recoveryId = fd.get("recovery_id")?.toString();
  if (!recoveryId) return { error: "Falta el id del pedido." };
  const { input, fieldErrors } = validateMasterPasswordInput({ password: fd.get("master_password")?.toString() });
  if (fieldErrors) return { fieldErrors };

  const admin = createAdminClient();
  try {
    // El ejecutor debe ser el propio solicitante (fija SU nueva master password).
    // Sin esto, cualquier admin que vea un recovery 'approved' ajeno lo secuestra.
    await executeRecovery(admin, recoveryId, input!.password, userId);
    revalidatePath(BASE_PATH);
    return { ok: true, recoveryId };
  } catch (e) {
    return { error: noOlvidarDomainError(e) };
  }
}

// ─── Admin: rotar KEK + config ───────────────────────────────

export interface RotateKekResult extends NoOlvidarActionState {
  itemsReencrypted?: number;
}

/**
 * Rota el KEK y re-envuelve el DEK de todos los items. Admin-only (el RPC valida
 * admin; además chequeamos acá). Operación cara — la UI debería confirmar.
 */
export async function rotateKekAction(): Promise<RotateKekResult> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  const { data: isAdmin } = await supabase.rpc("no_olvidar_check_admin", { p_user_id: userId });
  if (isAdmin !== true) return { error: "Solo los admins pueden rotar el KEK." };

  const admin = createAdminClient();
  try {
    const { oldVersion, newVersion } = await rotateKek(admin, userId);
    const count = await reEncryptAllItems(admin, oldVersion, newVersion);
    revalidatePath(`${BASE_PATH}/admin`);
    return { ok: true, itemsReencrypted: count };
  } catch (e) {
    return { error: noOlvidarError("Falló la rotación del KEK.", e) };
  }
}

/** Actualiza no_olvidar_config. Admin-only: chequeo TS explícito ADEMÁS de la RLS. */
export async function updateNoOlvidarConfigAction(
  _prev: NoOlvidarActionState,
  fd: FormData,
): Promise<NoOlvidarActionState> {
  const supabase = await createClient();
  const userId = await getAuthedUserId(supabase);
  if (!userId) return { error: "Sesión no válida." };
  const denial = await requireModule(supabase);
  if (denial) return { error: denial };

  // Defensa en profundidad: esta config controla parámetros de SEGURIDAD (umbral
  // M-of-N, lockout, timeout). No confiar solo en la policy RLS (si regresa, un
  // no-admin la degradaría). Chequeo admin explícito, igual que rotateKekAction.
  const { data: isAdmin } = await supabase.rpc("no_olvidar_check_admin", { p_user_id: userId });
  if (isAdmin !== true) return { error: "Solo los admins pueden cambiar la configuración." };

  const num = (k: string, min: number, max: number): number | undefined => {
    const raw = fd.get(k);
    if (raw == null) return undefined;
    const n = Number(raw.toString());
    if (!Number.isFinite(n) || n < min || n > max) return undefined;
    return Math.floor(n);
  };
  const bool = (k: string): boolean | undefined =>
    fd.get(k) == null ? undefined : fd.get(k) === "on";

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: userId };
  const fields: [string, number, number][] = [
    // Piso 2: el M-of-N pierde sentido con 1 (un solo admin resetearía cualquier
    // master password). El threat-model asume ≥2 aprobadores distintos.
    ["recovery_approvals_required", 2, 5],
    ["session_timeout_minutes", 1, 480],
    ["failed_attempts_lockout", 1, 20],
    ["lockout_minutes", 1, 1440],
    ["clipboard_clear_seconds", 5, 300],
    ["reveal_auto_hide_seconds", 1, 60],
  ];
  for (const [k, lo, hi] of fields) {
    const v = num(k, lo, hi);
    if (v !== undefined) patch[k] = v;
  }
  for (const k of ["require_2fa", "hold_to_reveal", "blur_on_window_blur", "forensic_watermark", "block_copy_event", "char_by_char_reveal"]) {
    const v = bool(k);
    if (v !== undefined) patch[k] = v;
  }

  const { error } = await supabase.from("no_olvidar_config").update(patch).eq("id", 1);
  if (error) return { error: noOlvidarError("No se pudo actualizar la configuración.", error) };
  revalidatePath(`${BASE_PATH}/admin`);
  return { ok: true };
}
