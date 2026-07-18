/**
 * Núcleo criptográfico del No-Olvidar interno DTD-CARGO (SDD-0025 Fase 2).
 *
 * ┌─ IMPORTANTE PARA EL REVIEW EXTERNO ─────────────────────────────────────┐
 * │ Este archivo (+ key-manager.ts + recovery.ts) es el bundle que va a code │
 * │ review crypto externo ANTES de mergear a main (spec §7.6). Cambios acá   │
 * │ requieren re-review.                                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Modelo V1 (custodial, server-side — spec §4.1/§4.3/§4.4):
 *   - Cifrado SIMÉTRICO con libsodium XChaCha20-Poly1305 (AEAD IETF, nonce
 *     192 bits → sin riesgo de colisión de nonce nunca).
 *   - Envelope encryption: KEK maestra (en Supabase Vault) envuelve un DEK por
 *     item; el DEK cifra el payload. Rotar KEK = re-envolver N DEKs, no
 *     re-cifrar N payloads (ver key-manager.reEncryptAllItems).
 *   - El cifrado ocurre SERVER-SIDE: solo el service_role alcanza el KEK en
 *     Vault. El plaintext viaja del browser al server por TLS y se cifra acá.
 *     (El comentario "el cliente cifra" en no-olvidar-types.ts describe el
 *     modelo zero-knowledge V2 — NO aplica a V1.)
 *
 * Derivación de master password:
 *   - Argon2id vía libsodium `crypto_pwhash` (ALG_ARGON2ID13). Se usa
 *     libsodium en vez de node-argon2 (nativo) para (a) mantener TODO el
 *     crypto sobre una sola librería auditada — abarata el review — y (b)
 *     evitar el build nativo que rompe en Windows.
 *   - Params: memlimit = 64 MiB, opslimit = 3 (≈ Argon2id m=64MB, t=3).
 *     DESVIACIÓN vs spec §4.4 (pedía p=4): libsodium fija p=1 internamente.
 *     Con m=64MB/t=3 la fortaleza es equivalente y supera el mínimo OWASP.
 *   - Del masterKey se derivan por separado (BLAKE2b con contexto) la clave de
 *     cifrado y el verifier, para que el verifier almacenado NO revele la clave.
 *
 * Nada en este archivo toca la DB ni la red. Es puro cómputo → testeable sin
 * mocks (ver tests/no-olvidar/crypto.test.ts).
 */

// SUMO build: el build estándar de libsodium-wrappers NO trae crypto_pwhash
// (Argon2id) ni crypto_kdf — esos viven solo en -sumo. No cambiar a la variante
// estándar sin re-implementar la derivación de master password.
import sodium from "libsodium-wrappers-sumo";
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "bip39";

// ─── Constantes ──────────────────────────────────────────────

/** Tamaño de clave simétrica (KEK y DEK): 32 bytes / 256 bits. */
export const KEY_BYTES = 32;
/** Tamaño de nonce XChaCha20-Poly1305 IETF: 24 bytes / 192 bits. */
export const NONCE_BYTES = 24;
/** Entropía del recovery kit BIP39: 32 bytes → 24 palabras. */
export const RECOVERY_ENTROPY_BYTES = 32;

/**
 * Params Argon2id (ver nota de cabecera). opslimit=3 t, memlimit=64 MiB.
 * NO bajar sin re-review: son el costo que frena fuerza bruta offline del
 * verifier si la DB se filtra.
 */
const ARGON2_OPSLIMIT = 3;
// 128 MiB (2× el baseline original de 64, muy por encima del mínimo OWASP de
// 19 MiB). Sube el costo de la fuerza bruta offline del verifier si la DB se
// filtra, sin el costo/DoS de MODERATE (256 MiB) — que además hacía flaky al
// gate por timeout bajo carga de workers. El riesgo de DoS por memoria queda
// acotado por el lockout server-side (5 intentos / 15 min, §4.5) y lo
// infrecuente del unlock (1 vez por sesión de 30 min).
const ARGON2_MEMLIMIT = 128 * 1024 * 1024; // 128 MiB

/** Contextos de dominio-separación para derivar subclaves del masterKey. */
const CTX_ENC = "no-olv/e"; // clave de cifrado (8 bytes exactos, req. de crypto_kdf)
const CTX_VRF = "no-olv/v"; // verifier

// ─── Init ────────────────────────────────────────────────────

let _ready: Promise<void> | null = null;

/**
 * Espera a que libsodium esté inicializado (WASM). Idempotente: la primera
 * llamada arranca la init, las demás reusan la promesa. TODA función pública
 * de este módulo la llama antes de operar.
 */
export async function ready(): Promise<void> {
  if (!_ready) _ready = sodium.ready;
  await _ready;
}

// ─── Encoding helpers (base64 estándar, para guardar bytea) ──

/** Uint8Array → base64 estándar (con padding). Formato de guardado en bytea. */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** base64 estándar → Uint8Array. Inversa de toBase64. */
export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** string UTF-8 → Uint8Array del realm de Node (ver nota en encryptPayload). */
function bytesFromUtf8(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "utf8"));
}

// ─── AAD (additional authenticated data) ─────────────────────
//
// El AEAD ata el ciphertext a un CONTEXTO (dominio + user). Sin AAD, un atacante
// con escritura a la DB (sin la KEK) podía copiar la tupla (dek, ciphertext) de
// otro user a un item propio y descifrarla → fuga cross-user (review 2026-07-18,
// hallazgo AEAD-sin-AAD). Atamos `user_id`: el unwrap/decrypt de la víctima
// falla el tag bajo el AAD del atacante. NO atamos `key_version` a propósito —
// así la rotación (reEncryptAllItems) re-envuelve con el MISMO AAD sin recomputar
// (el downgrade same-user/same-version queda cubierto por el column key_version,
// no por el AAD).

const AAD_SEP = "\x1f"; // unit separator: separa las partes sin ambigüedad

/** AAD canónico a partir de (dominio ∥ ids). Determinista. */
export function aadFor(...parts: (string | number)[]): Uint8Array {
  return bytesFromUtf8(parts.map(String).join(AAD_SEP));
}

/** AAD del DEK envuelto por la KEK (atado al dueño del item). */
export function aadDek(userId: string): Uint8Array {
  return aadFor("no-olv/dek", userId);
}
/** AAD del payload del item cifrado por su DEK (atado al dueño). */
export function aadItem(userId: string): Uint8Array {
  return aadFor("no-olv/item", userId);
}
/** AAD del secret TOTP cifrado por la KEK (atado al dueño). */
export function aadTotp(userId: string): Uint8Array {
  return aadFor("no-olv/totp", userId);
}

// ─── AEAD: XChaCha20-Poly1305 ────────────────────────────────

export interface Sealed {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Cifra `plaintext` con `key` (32 bytes) usando XChaCha20-Poly1305 IETF.
 * Genera un nonce aleatorio de 24 bytes por llamada (nunca reusar nonce con
 * la misma key — el nonce de 192 bits hace la colisión aleatoria imposible en
 * la práctica). El tag Poly1305 va embebido en `ciphertext` (detached=false).
 */
export async function encryptPayload(
  plaintext: string,
  key: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<Sealed> {
  await ready();
  assertKey(key);
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    // Buffer (no TextEncoder): garantiza un Uint8Array del realm de Node, que
    // es el que valida el `instanceof` interno de libsodium. Bajo jsdom un
    // TextEncoder de otro realm lo hace fallar con "unsupported input type".
    bytesFromUtf8(plaintext),
    aad, // additional authenticated data (atado al contexto; ver aadFor)
    null, // nsec (no usado)
    nonce,
    key,
  );
  return { ciphertext, nonce };
}

/**
 * Descifra y VERIFICA (`ciphertext`, `nonce`) con `key`. Si la key es
 * incorrecta o el ciphertext/nonce fue alterado, el tag Poly1305 no valida y
 * libsodium lanza — nunca devuelve plaintext basura. Traducimos el error a uno
 * limpio para no filtrar detalles internos.
 */
export async function decryptPayload(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<string> {
  await ready();
  assertKey(key);
  assertNonce(nonce);
  let out: Uint8Array;
  try {
    out = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // nsec
      ciphertext,
      aad, // debe coincidir con el AAD usado al cifrar, o el tag no valida
      nonce,
      key,
    );
  } catch {
    throw new NoOlvidarDecryptError();
  }
  return Buffer.from(out).toString("utf8");
}

// ─── DEK (envelope) ──────────────────────────────────────────

/** Genera un DEK aleatorio de 32 bytes (una por item). */
export async function generateDek(): Promise<Uint8Array> {
  await ready();
  return sodium.randombytes_buf(KEY_BYTES);
}

/**
 * Envuelve (cifra) un DEK con la KEK. El "wrapped" resultante + su nonce se
 * guardan en la fila del item (dek_encrypted / dek_nonce). El DEK plaintext
 * nunca se persiste.
 */
export async function wrapDek(
  dek: Uint8Array,
  kek: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<{ wrapped: Uint8Array; nonce: Uint8Array }> {
  assertKey(dek);
  const sealed = await encryptPayloadBytes(dek, kek, aad);
  return { wrapped: sealed.ciphertext, nonce: sealed.nonce };
}

/** Desenvuelve (descifra) un DEK con la KEK. Lanza si la KEK o el AAD no coinciden. */
export async function unwrapDek(
  wrapped: Uint8Array,
  nonce: Uint8Array,
  kek: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<Uint8Array> {
  await ready();
  assertKey(kek);
  assertNonce(nonce);
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, wrapped, aad, nonce, kek);
  } catch {
    throw new NoOlvidarDecryptError("No se pudo desenvolver el DEK (¿KEK equivocada?).");
  }
}

// ─── Master password: Argon2id + dominio-separación ──────────

/** Genera un salt de master password del tamaño que exige libsodium (16 bytes). */
export async function generateSalt(): Promise<Uint8Array> {
  await ready();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

/**
 * Deriva el masterKey (32 bytes) desde la master password con Argon2id.
 * Operación cara a propósito (~cientos de ms). Determinista: misma
 * (password, salt) → mismo masterKey; distinta salt → masterKey distinto.
 *
 * De este masterKey NO se usa nada directamente como clave ni como verifier;
 * usar `deriveEncKey` / `deriveVerifier` para obtener valores dominio-separados.
 */
async function deriveMasterKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  await ready();
  if (salt.length !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error(`Salt debe ser ${sodium.crypto_pwhash_SALTBYTES} bytes (Argon2id libsodium).`);
  }
  return sodium.crypto_pwhash(
    KEY_BYTES,
    password,
    salt,
    ARGON2_OPSLIMIT,
    ARGON2_MEMLIMIT,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** BLAKE2b(masterKey, subkey_id, context) — subclave dominio-separada. */
function subkey(masterKey: Uint8Array, id: number, context: string): Uint8Array {
  return sodium.crypto_kdf_derive_from_key(KEY_BYTES, id, context, masterKey);
}

/**
 * Deriva la CLAVE DE CIFRADO desde la master password. Es la que envuelve la
 * private_key del user (reservada sharing V2). Distinta del verifier: filtrar
 * el verifier no revela esta clave.
 */
export async function deriveKeyFromMasterPassword(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const mk = await deriveMasterKey(password, salt);
  const k = subkey(mk, 1, CTX_ENC);
  sodium.memzero(mk); // el masterKey no se necesita más → limpiar del heap
  return k;
}

/**
 * Deriva el VERIFIER (32 bytes) que se guarda en no_olvidar_user_keys para
 * comprobar la master password en el unlock, sin poder reconstruir la clave de
 * cifrado. Verificación = derivar de nuevo + `constantTimeEqual`.
 */
export async function hashForVerifier(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const mk = await deriveMasterKey(password, salt);
  const v = subkey(mk, 2, CTX_VRF);
  sodium.memzero(mk); // el masterKey no se necesita más → limpiar del heap
  return v;
}

/**
 * Comprueba una master password contra el verifier almacenado en tiempo
 * constante. Conveniencia sobre hashForVerifier + constantTimeEqual.
 */
export async function verifyMasterPassword(
  password: string,
  salt: Uint8Array,
  expectedVerifier: Uint8Array,
): Promise<boolean> {
  const v = await hashForVerifier(password, salt);
  return constantTimeEqual(v, expectedVerifier);
}

// ─── Recovery kit (BIP39 24 palabras) ────────────────────────

/**
 * Genera un recovery kit de 24 palabras BIP39 (256 bits de entropía), usando
 * entropía de libsodium (no el RNG por defecto de bip39). One-time al setup;
 * se muestra al user para imprimir y NUNCA se guarda en plaintext — solo su
 * hash (hashRecoveryKit) va a la DB.
 */
export async function generateRecoveryKit(): Promise<string> {
  await ready();
  const entropy = sodium.randombytes_buf(RECOVERY_ENTROPY_BYTES);
  return entropyToMnemonic(Buffer.from(entropy));
}

/** true si la frase tiene checksum BIP39 válido (24 palabras del wordlist). */
export function isValidRecoveryKit(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim());
}

/**
 * Hash del recovery kit para guardar en no_olvidar_user_keys.recovery_kit_hash.
 * Se normaliza la frase a su entropía canónica (tolera espacios/casing) y se
 * pasa por Argon2id con `salt` — mismo costo que la master password.
 */
export async function hashRecoveryKit(mnemonic: string, salt: Uint8Array): Promise<Uint8Array> {
  if (!isValidRecoveryKit(mnemonic)) {
    throw new Error("Recovery kit inválido (checksum BIP39 no valida).");
  }
  const entropyHex = mnemonicToEntropy(mnemonic.trim());
  return hashForVerifier(entropyHex, salt);
}

/** Verifica un recovery kit contra su hash almacenado, en tiempo constante. */
export async function verifyRecoveryKit(
  mnemonic: string,
  salt: Uint8Array,
  expectedHash: Uint8Array,
): Promise<boolean> {
  if (!isValidRecoveryKit(mnemonic)) return false;
  const entropyHex = mnemonicToEntropy(mnemonic.trim());
  const h = await hashForVerifier(entropyHex, salt);
  return constantTimeEqual(h, expectedHash);
}

// ─── Comparación en tiempo constante ─────────────────────────

/**
 * Igualdad en tiempo constante (sin early-return por byte) sobre `sodium.memcmp`.
 * Longitudes distintas → false inmediato (la longitud no es secreta). Usar para
 * comparar verifiers / hashes; NUNCA usar `===` sobre secretos.
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return sodium.memcmp(a, b);
}

/**
 * Pone en cero un buffer de material sensible (KEK/DEK/masterKey) cuando ya no se
 * necesita, para reducir la ventana en que vive en el heap (defensa contra
 * heap-dump/memory-scraping). No-op seguro si sodium no está listo todavía.
 */
export function wipe(bytes: Uint8Array): void {
  try {
    sodium.memzero(bytes);
  } catch {
    bytes.fill(0); // fallback si el WASM no cargó aún
  }
}

// ─── Internos ────────────────────────────────────────────────

/** Igual que encryptPayload pero sobre bytes crudos (para envolver el DEK). */
async function encryptPayloadBytes(
  plainBytes: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array | null = null,
): Promise<Sealed> {
  await ready();
  assertKey(key);
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plainBytes,
    aad,
    null,
    nonce,
    key,
  );
  return { ciphertext, nonce };
}

function assertKey(key: Uint8Array): void {
  if (!(key instanceof Uint8Array) || key.length !== KEY_BYTES) {
    throw new Error(`Clave inválida: se esperaban ${KEY_BYTES} bytes.`);
  }
}

function assertNonce(nonce: Uint8Array): void {
  if (!(nonce instanceof Uint8Array) || nonce.length !== NONCE_BYTES) {
    throw new Error(`Nonce inválido: se esperaban ${NONCE_BYTES} bytes.`);
  }
}

/** Error de descifrado — no filtra si fue key mala, nonce alterado o tag inválido. */
export class NoOlvidarDecryptError extends Error {
  constructor(message = "No se pudo descifrar (clave incorrecta o datos alterados).") {
    super(message);
    this.name = "NoOlvidarDecryptError";
  }
}
