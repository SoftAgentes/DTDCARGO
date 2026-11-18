// @vitest-environment node
/**
 * SDD-0608 · Firma Ed25519 de Discord: con una llave real generada en la
 * prueba. Cada caso inválido cambia UNA cosa respecto del válido.
 */
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DESFASE_MAXIMO_S, verificarFirmaDiscord, type FirmaDiscord } from "../firma";

function llaves() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publica = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");
  return { publica, privateKey };
}

const AHORA_MS = 1_800_000_000_000;
const TS = String(AHORA_MS / 1000);
const CUERPO = new TextEncoder().encode('{"type":1,"nombre":"Peña"}');

describe("verificarFirmaDiscord", () => {
  const { publica, privateKey } = llaves();
  const firmar = (ts: string, cuerpo: Uint8Array) =>
    sign(null, Buffer.concat([Buffer.from(ts), Buffer.from(cuerpo)]), privateKey).toString("hex");
  const firma = firmar(TS, CUERPO);
  const base = { clavePublicaHex: publica, firmaHex: firma, timestamp: TS, cuerpo: CUERPO, ahoraMs: AHORA_MS };

  it("acepta la firma válida (control verde)", () => {
    expect(verificarFirmaDiscord(base)).toBe(true);
  });

  it("rechaza un cuerpo alterado en un byte", () => {
    const alterado = new Uint8Array(CUERPO);
    alterado[2] ^= 1;
    expect(verificarFirmaDiscord({ ...base, cuerpo: alterado })).toBe(false);
  });

  it("rechaza otra llave pública", () => {
    expect(verificarFirmaDiscord({ ...base, clavePublicaHex: llaves().publica })).toBe(false);
  });

  it("rechaza un timestamp distinto del firmado", () => {
    expect(verificarFirmaDiscord({ ...base, timestamp: String(Number(TS) + 1) })).toBe(false);
  });

  it("rechaza un pedido viejo aunque la firma sea buena (repetición)", () => {
    const viejo = String(Number(TS) - DESFASE_MAXIMO_S - 1);
    expect(verificarFirmaDiscord({ ...base, timestamp: viejo, firmaHex: firmar(viejo, CUERPO) })).toBe(false);
    const justo = String(Number(TS) - DESFASE_MAXIMO_S);
    expect(verificarFirmaDiscord({ ...base, timestamp: justo, firmaHex: firmar(justo, CUERPO) })).toBe(true);
  });

  it.each<[string, Partial<FirmaDiscord>]>([
    ["sin llave", { clavePublicaHex: undefined }],
    ["llave vacía", { clavePublicaHex: "" }],
    ["llave corta", { clavePublicaHex: publica.slice(2) }],
    ["llave no hex", { clavePublicaHex: "z".repeat(64) }],
    ["sin firma", { firmaHex: null }],
    ["firma corta", { firmaHex: firma.slice(2) }],
    ["firma de ceros", { firmaHex: "0".repeat(128) }],
    ["sin timestamp", { timestamp: null }],
    ["timestamp no numérico", { timestamp: "abc" }],
  ])("falla cerrado: %s", (_n, cambio) => {
    expect(verificarFirmaDiscord({ ...base, ...cambio })).toBe(false);
  });
});
