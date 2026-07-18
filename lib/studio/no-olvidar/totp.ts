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

/**
 * Shape REAL que devuelve `verifySync` en runtime para TOTP (verificado contra
 * otplib 13.4.1: `{valid, delta, epoch, timeStep}`). Sus tipos públicos NO
 * exponen `timeStep`/`delta` en el resultado, así que lo tipamos acá para el
 * anti-replay. `timeStep + delta` = step absoluto que casó.
 */
interface TotpVerifyRuntimeResult {
  valid: boolean;
  delta?: number;
  timeStep?: number;
}

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

export interface TotpVerification {
  valid: boolean;
  /**
   * Step absoluto (contador de período de 30 s) que casó, o null si no valida.
   * Es `timeStep + delta`: identifica de forma única el código usado dentro de la
   * ventana, para anti-replay (guardar el último consumido y rechazar ≤).
   */
  step: number | null;
}

/**
 * Verifica un código de 6 dígitos contra el secret, con ±30 s de tolerancia, y
 * devuelve el step que casó (para anti-replay §4.5). Constante-en-tiempo lo
 * maneja otplib. Devuelve {valid:false} ante secret/código malformado o si el
 * plugin lanza, en vez de propagar, para que el caller cuente el intento fallido.
 */
export function verifyTotpWithStep(token: string, secret: string): TotpVerification {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return { valid: false, step: null };
  try {
    const r = verifySync({
      token: clean,
      secret,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    }) as unknown as TotpVerifyRuntimeResult;
    if (!r.valid) return { valid: false, step: null };
    const step = r.timeStep != null && r.delta != null ? r.timeStep + r.delta : null;
    return { valid: true, step };
  } catch {
    return { valid: false, step: null };
  }
}

/**
 * Igual que verifyTotpWithStep pero solo la validez — para el enrolamiento
 * (setup) donde no hace falta el step. NO usar en el unlock (ahí sí importa el
 * anti-replay).
 */
export function verifyTotp(token: string, secret: string): boolean {
  return verifyTotpWithStep(token, secret).valid;
}
