/**
 * Tests del núcleo criptográfico del No-Olvidar (SDD-0025 §5 "Sistema").
 * libsodium REAL, sin mocks — validan el contrato que va al review externo.
 */

import { describe, it, expect } from "vitest";
import {
  ready,
  encryptPayload,
  decryptPayload,
  generateDek,
  wrapDek,
  unwrapDek,
  deriveKeyFromMasterPassword,
  hashForVerifier,
  verifyMasterPassword,
  generateRecoveryKit,
  isValidRecoveryKit,
  hashRecoveryKit,
  verifyRecoveryKit,
  generateSalt,
  constantTimeEqual,
  toBase64,
  fromBase64,
  KEY_BYTES,
  NONCE_BYTES,
  NoOlvidarDecryptError,
} from "@/lib/studio/no-olvidar/crypto";

describe("no-olvidar/crypto · AEAD", () => {
  it("encrypt/decrypt roundtrip devuelve el plaintext original", async () => {
    const key = await generateDek();
    const { ciphertext, nonce } = await encryptPayload("clave-super-secreta-123", key);
    expect(nonce.length).toBe(NONCE_BYTES);
    const back = await decryptPayload(ciphertext, nonce, key);
    expect(back).toBe("clave-super-secreta-123");
  });

  it("soporta UTF-8 / unicode", async () => {
    const key = await generateDek();
    const msg = "contraseña ñ 你好 🔐 café";
    const { ciphertext, nonce } = await encryptPayload(msg, key);
    expect(await decryptPayload(ciphertext, nonce, key)).toBe(msg);
  });

  it("decrypt con key incorrecta LANZA (no devuelve basura)", async () => {
    const key = await generateDek();
    const wrong = await generateDek();
    const { ciphertext, nonce } = await encryptPayload("secreto", key);
    await expect(decryptPayload(ciphertext, nonce, wrong)).rejects.toBeInstanceOf(
      NoOlvidarDecryptError,
    );
  });

  it("decrypt con ciphertext alterado LANZA (tag Poly1305 no valida)", async () => {
    const key = await generateDek();
    const { ciphertext, nonce } = await encryptPayload("secreto", key);
    ciphertext[0] ^= 0xff; // flip 1 bit
    await expect(decryptPayload(ciphertext, nonce, key)).rejects.toBeInstanceOf(
      NoOlvidarDecryptError,
    );
  });

  it("dos cifrados del mismo texto usan nonces distintos", async () => {
    const key = await generateDek();
    const a = await encryptPayload("igual", key);
    const b = await encryptPayload("igual", key);
    expect(toBase64(a.nonce)).not.toBe(toBase64(b.nonce));
    expect(toBase64(a.ciphertext)).not.toBe(toBase64(b.ciphertext));
  });

  it("rechaza claves de tamaño inválido", async () => {
    await ready();
    const short = new Uint8Array(16);
    await expect(encryptPayload("x", short)).rejects.toThrow();
  });
});

describe("no-olvidar/crypto · DEK envelope", () => {
  it("generateDek produce 32 bytes", async () => {
    const dek = await generateDek();
    expect(dek.length).toBe(KEY_BYTES);
  });

  it("wrapDek/unwrapDek roundtrip recupera el DEK exacto", async () => {
    const kek = await generateDek();
    const dek = await generateDek();
    const { wrapped, nonce } = await wrapDek(dek, kek);
    const back = await unwrapDek(wrapped, nonce, kek);
    expect(toBase64(back)).toBe(toBase64(dek));
  });

  it("unwrapDek con KEK equivocada LANZA", async () => {
    const kek = await generateDek();
    const otherKek = await generateDek();
    const dek = await generateDek();
    const { wrapped, nonce } = await wrapDek(dek, kek);
    await expect(unwrapDek(wrapped, nonce, otherKek)).rejects.toBeInstanceOf(NoOlvidarDecryptError);
  });

  it("re-wrap simula rotación de KEK sin re-cifrar el payload", async () => {
    // El payload se cifra con el DEK; rotar el KEK solo re-envuelve el DEK.
    const dek = await generateDek();
    const payload = await encryptPayload("dato", dek);

    const kekV1 = await generateDek();
    const kekV2 = await generateDek();
    const wrap1 = await wrapDek(dek, kekV1);

    // rotación: desenvolver con v1, re-envolver con v2
    const dekBack = await unwrapDek(wrap1.wrapped, wrap1.nonce, kekV1);
    const wrap2 = await wrapDek(dekBack, kekV2);

    // el payload sigue descifrando con el mismo DEK obtenido vía v2
    const dekViaV2 = await unwrapDek(wrap2.wrapped, wrap2.nonce, kekV2);
    expect(await decryptPayload(payload.ciphertext, payload.nonce, dekViaV2)).toBe("dato");
  });
});

describe("no-olvidar/crypto · Argon2id master password", () => {
  it("misma (password,salt) → misma clave; distinta salt → clave distinta", async () => {
    const salt1 = await generateSalt();
    const salt2 = await generateSalt();
    const k1a = await deriveKeyFromMasterPassword("Correcto-Caballo-1!", salt1);
    const k1b = await deriveKeyFromMasterPassword("Correcto-Caballo-1!", salt1);
    const k2 = await deriveKeyFromMasterPassword("Correcto-Caballo-1!", salt2);
    expect(toBase64(k1a)).toBe(toBase64(k1b));
    expect(toBase64(k1a)).not.toBe(toBase64(k2));
    expect(k1a.length).toBe(KEY_BYTES);
  });

  it("el verifier NO es igual a la clave de cifrado (dominio-separación)", async () => {
    const salt = await generateSalt();
    const key = await deriveKeyFromMasterPassword("MiClave-Larga-9$", salt);
    const verifier = await hashForVerifier("MiClave-Larga-9$", salt);
    expect(toBase64(verifier)).not.toBe(toBase64(key));
  });

  it("verifyMasterPassword acepta la correcta y rechaza la incorrecta", async () => {
    const salt = await generateSalt();
    const verifier = await hashForVerifier("Password-Real-7#", salt);
    expect(await verifyMasterPassword("Password-Real-7#", salt, verifier)).toBe(true);
    expect(await verifyMasterPassword("Password-Falsa-7#", salt, verifier)).toBe(false);
  });

  it("generateSalt produce el tamaño que exige libsodium", async () => {
    const salt = await generateSalt();
    expect(salt.length).toBeGreaterThanOrEqual(16);
  });
});

describe("no-olvidar/crypto · recovery kit BIP39", () => {
  it("genera 24 palabras válidas", async () => {
    const kit = await generateRecoveryKit();
    expect(kit.split(" ")).toHaveLength(24);
    expect(isValidRecoveryKit(kit)).toBe(true);
  });

  it("hash/verify roundtrip del recovery kit", async () => {
    const kit = await generateRecoveryKit();
    const salt = await generateSalt();
    const hash = await hashRecoveryKit(kit, salt);
    expect(await verifyRecoveryKit(kit, salt, hash)).toBe(true);
  });

  it("un kit distinto NO valida contra el hash", async () => {
    const kit = await generateRecoveryKit();
    const other = await generateRecoveryKit();
    const salt = await generateSalt();
    const hash = await hashRecoveryKit(kit, salt);
    expect(await verifyRecoveryKit(other, salt, hash)).toBe(false);
  });

  it("verifyRecoveryKit devuelve false ante frase inválida en vez de lanzar", async () => {
    const salt = await generateSalt();
    const hash = await hashRecoveryKit(await generateRecoveryKit(), salt);
    expect(await verifyRecoveryKit("no soy una frase bip39", salt, hash)).toBe(false);
  });
});

describe("no-olvidar/crypto · constantTimeEqual + base64", () => {
  it("true para iguales, false para distintos y para longitudes distintas", async () => {
    await ready();
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    const c = new Uint8Array([1, 2, 3, 5]);
    const d = new Uint8Array([1, 2, 3]);
    expect(constantTimeEqual(a, b)).toBe(true);
    expect(constantTimeEqual(a, c)).toBe(false);
    expect(constantTimeEqual(a, d)).toBe(false);
  });

  it("toBase64/fromBase64 roundtrip", async () => {
    const dek = await generateDek();
    expect(toBase64(fromBase64(toBase64(dek)))).toBe(toBase64(dek));
    expect(fromBase64(toBase64(dek)).length).toBe(KEY_BYTES);
  });
});
