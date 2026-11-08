/**
 * SDD-0618 · 7.4 · contrato de la base canónica de `dtd-bot`.
 *
 *  - El JSON está al día con la base v7 (`scripts/bot-conocimiento.mjs --check`).
 *  - Cada ficha cita su fuente y trae texto.
 *  - Ninguna ficha lleva notas internas ni la dirección completa de recepción con el
 *    contacto de bodega (FAQ #28, Paso 2).
 *  - Sin PII: ni teléfonos que no sean de DTD, ni correos que no sean de dtdcargo.com, ni
 *    números de cédula o RIF.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTACT } from "@/lib/design-tokens";

import base from "../base.json";
// @ts-expect-error -- script .mjs sin tipos
import { DESTINO, extraerFichas, generar, sinEtiquetas } from "../../../../../../scripts/bot-conocimiento.mjs";

const RAIZ = resolve(__dirname, "../../../../../..");

describe("base.json", () => {
  it("está al día con la fuente (no se edita a mano)", () => {
    const enDisco = readFileSync(resolve(RAIZ, DESTINO), "utf8").replace(/\r\n?/g, "\n");
    expect(enDisco).toBe(generar(RAIZ));
  });

  it("tiene las 33 secciones aprobadas más la 25-bis, una vez cada una", () => {
    const ids = base.fichas.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let n = 1; n <= 33; n += 1) expect(ids).toContain(String(n));
    expect(ids).toContain("25-bis");
  });

  it.each(base.fichas.map((f) => [f.id, f] as const))("ficha %s: fuente, grupo, preguntas y texto", (id, f) => {
    expect(f.fuente).toBe(`${base.fuente}#${id}`);
    expect(f.grupo).toMatch(/^[A-F]$/);
    expect(f.preguntas.length).toBeGreaterThan(0);
    expect(f.texto.trim().length).toBeGreaterThan(100);
    expect(f.texto).not.toMatch(/^\s*>/m);
    expect(f.texto).not.toMatch(/Nota interna/i);
    // Etiquetas internas del documento: no son para el cliente (revisión del DG de la #448).
    expect(f.texto).not.toMatch(/founder/i);
    expect(f.texto).not.toMatch(/\*\*(Respuesta|Pregunta de continuación)\s*\(/);
  });
});

describe("sin PII ni la dirección completa", () => {
  // Solo las fichas: la huella sha256 de la fuente parecería un teléfono.
  const todo = JSON.stringify(base.fichas);
  const permitidos = [CONTACT.ve.whatsappRaw, CONTACT.ve.phoneRaw].map((t) => t.replace(/\D/g, ""));

  it("no trae el contacto de bodega ni el detalle de cargo", () => {
    expect(todo).not.toMatch(/林冠|Lin Guan|货\s*7|Cargo 7-11|\+86/);
  });

  it("los únicos teléfonos son los de DTD", () => {
    const telefonos = [...todo.matchAll(/\+?\d[\d\s().-]{7,}\d/g)]
      .map((m) => m[0])
      .filter((t) => !/^\d{4}-\d{2}-\d{2}$/.test(t.trim()))
      .map((t) => t.replace(/\D/g, ""))
      .filter((d) => d.length >= 8);
    expect(telefonos.length).toBeGreaterThan(0);
    for (const t of telefonos) expect(permitidos.some((p) => p.endsWith(t) || t.endsWith(p)), t).toBe(true);
  });

  it("los únicos correos son de dtdcargo.com", () => {
    for (const m of todo.matchAll(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi)) expect(m[1].toLowerCase()).toBe("dtdcargo.com");
  });

  it("no trae números de cédula ni de RIF", () => {
    expect(todo).not.toMatch(/\b[VEJPG][-\s.]?\d{1,2}\.?\d{3}\.?\d{3}\b/);
  });
});

describe("extraerFichas", () => {
  const md = [
    "## A · Comercial",
    "### 1. Uno",
    "**Preguntas:** ¿a? · ¿b?",
    "",
    "**Respuesta:** Hola.",
    "> *Nota interna: no va.*",
    "### 28. Dirección",
    "**Preguntas:** ¿dónde?",
    "**Paso 1:** regístrate.",
    "**Paso 2 — si insiste:** la dirección completa",
    "电话: +86 000",
    "## Otra cosa",
    "### 99. Fuera de los bloques",
  ].join("\n");

  it("separa preguntas, quita notas, corta el Paso 2 y deja fuera lo que no está en A a F", () => {
    const fichas = extraerFichas(md);
    expect(fichas.map((f: { id: string }) => f.id)).toEqual(["1", "28"]);
    expect(fichas[0]).toMatchObject({ grupo: "A", titulo: "Uno", preguntas: ["¿a?", "¿b?"], texto: "**Respuesta:** Hola." });
    expect(fichas[1].texto).not.toContain("+86");
    expect(fichas[1].texto).toContain("pasa la conversación a una persona");
  });
});

describe("sinEtiquetas", () => {
  it.each([
    ["**Respuesta (aprobada · founder 2026-08-06):** Hola.", "**Respuesta:** Hola."],
    ["**Respuesta (escalar · sin precio ni promesa):** Hola.", "**Respuesta:** Hola."],
    ["**Pregunta de continuación (elige UNA):** *¿Y tú?*", "**Pregunta de continuación:** *¿Y tú?*"],
    ["se pide un 50% (founder, 2026-08-20 — ya es público). La razón", "se pide un 50%. La razón"],
    ["tarda (flete interno en China + la espera)", "tarda (flete interno en China + la espera)"],
  ])("%s", (entrada, salida) => {
    expect(sinEtiquetas(entrada)).toBe(salida);
  });
});
