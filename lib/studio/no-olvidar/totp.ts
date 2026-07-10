/**
 * TOTP (2FA obligatorio) del No-Olvidar — SDD-0025 §4.5.
 *
 * Adición al listado de 5 archivos de la spec: la spec asigna la funcionalidad
 * TOTP (§4.5) pero no le dio archivo propio. Va acá para mantener crypto.ts
 * puro-libsodium y session.ts puro-DB.
 *
 * El secret TOTP se guarda CIFRADO con la KEK (no_olvidar_user_keys.
 * totp_secret_ciphertext), nunca en plaintext — el cifrado/descifrado lo hace
 * crypto.ts; acá solo se genera el secret y se verifican códigos.
 *
 * API funcional de otplib v13 (generateSecret / generateSync / verifySync /
 * generateURI). Puro cómputo — sin DB ni red.
 */

import { generateSecret, generateURI, verifySync } from "otplib";

/** Emisor mostrado en la app de autenticación (Google Authenticator, Authy…). */
const TOTP_ISSUER = "DTD Cargo · No-Olvidar";

/**
 * Tolerancia de reloj, en SEGUNDOS: acepta el período anterior y el siguiente
 * (±30 s = 1 paso TOTP) para absorber desfase de reloj. No subir sin
 * re-evaluar: cada segundo extra amplía la ventana de fuerza bruta del código.
 */
const EPOCH_TOLERANCE_SECONDS = 30;

/** Genera un secret TOTP nuevo (base32, 160 bits). Se cifra con KEK antes de guardar. */
export function generateTotpSecret(): string {
  return generateSecret({ length: 20 }); // 20 bytes = 160 bits
}

/**
 * URI `otpauth://` para pintar el QR del setup wizard. `accountLabel` suele ser
 * el email del empleado. El secret va embebido — el QR es sensible (equivale al
 * secret), mostrarlo solo durante el wizard.
 */
export function buildTotpUri(secret: string, accountLabel: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: accountLabel, secret });
}

/**
 * Verifica un código de 6 dígitos contra el secret, con ±30 s de tolerancia.
 * Constante-en-tiempo lo maneja otplib. Devuelve false ante secret/código
 * malformado en vez de lanzar, para que el caller cuente el intento fallido.
 */
export function verifyTotp(token: string, secret: string): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return false;
  try {
    return verifySync({ token: clean, secret, epochTolerance: EPOCH_TOLERANCE_SECONDS }).valid;
  } catch {
    return false;
  }
}
