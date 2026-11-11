#!/usr/bin/env node
/**
 * Smoke de la guía dentro de Chatwoot (SDD-0589, paso 9.4) · corrida de E3.
 *
 * Entra al panel de un Chatwoot con un agente de prueba, abre una conversación
 * y comprueba que cada ancla de `lib/studio/guia/chatwoot-selectores.json`
 * aparece. Sale con 1 si falta una ancla obligatoria; las condicionales (las
 * plantillas solo existen en una bandeja de WhatsApp, la pestaña «Ficha DTD»
 * solo con la Dashboard App registrada) se informan sin fallar.
 *
 * Dónde se corre (runbook `docs/runbooks/chatwoot-versiones.md`):
 *   - §4, contra el ensayo local con la imagen nueva y datos sintéticos;
 *   - S13 de §6, opcional, contra el panel ya actualizado con el agente de la
 *     bandeja de prueba. Nunca con la cuenta de una persona del equipo.
 *
 * Variables (ninguna se imprime):
 *   CHATWOOT_URL         origen del panel (por defecto http://localhost:3000)
 *   SMOKE_EMAIL          correo del agente de prueba
 *   SMOKE_CLAVE          su clave
 *   SMOKE_CUENTA         id de la cuenta
 *   SMOKE_CONVERSACION   id de una conversación de prueba
 *   SMOKE_JSON=1         además, imprime el resultado en JSON
 *
 * Uso: node infra/chatwoot/pruebas/smoke-guia.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatear, resolverAnclas, resumir } from "./smoke-guia-nucleo.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARCHIVO = JSON.parse(readFileSync(resolve(RAIZ, "lib/studio/guia/chatwoot-selectores.json"), "utf8"));

function requerida(nombre) {
  const v = process.env[nombre];
  if (!v) {
    console.error(`[smoke-guia] falta ${nombre}`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const origen = (process.env.CHATWOOT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const email = requerida("SMOKE_EMAIL");
  const clave = requerida("SMOKE_CLAVE");
  const cuenta = requerida("SMOKE_CUENTA");
  const conversacion = requerida("SMOKE_CONVERSACION");
  if (!/^\d+$/.test(cuenta) || !/^\d+$/.test(conversacion)) {
    console.error("[smoke-guia] SMOKE_CUENTA y SMOKE_CONVERSACION son números");
    process.exit(2);
  }

  const { chromium } = await import("@playwright/test");
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
    await pagina.goto(`${origen}/app/login`);
    await pagina.locator('input[name="email_address"]').fill(email);
    await pagina.locator('input[name="password"]').fill(clave);
    await pagina.locator('button[type="submit"]').click();
    await pagina.waitForURL(/\/app\/accounts\/\d+\//, { timeout: 30_000 });

    await pagina.goto(`${origen}/app/accounts/${cuenta}/conversations/${conversacion}`);
    // El composer es la última pieza que pinta la conversación; si no llega, se
    // mide igual y el smoke dirá qué falta.
    await pagina.locator(".reply-box").first().waitFor({ timeout: 30_000 }).catch(() => undefined);

    const resultados = await pagina.evaluate(resolverAnclas, ARCHIVO);
    const resumen = resumir(resultados);
    console.log(formatear(resultados, ARCHIVO.version));
    if (process.env.SMOKE_JSON === "1") console.log(JSON.stringify({ version: ARCHIVO.version, resultados, resumen }));
    if (!resumen.ok) {
      console.error(`[smoke-guia] faltan anclas obligatorias: ${resumen.faltanObligatorias.join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(`[smoke-guia] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});
