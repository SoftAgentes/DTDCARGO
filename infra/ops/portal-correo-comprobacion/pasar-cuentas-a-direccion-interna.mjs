#!/usr/bin/env node
/**
 * SDD-0646 (D-1, opción C) · corrida ÚNICA para las cuentas del portal que
 * nacieron de un link de registro ANTES de la migración 0559.
 *
 * Esas cuentas quedan «sin comprobar» al aplicar la 0559, pero su cuenta de
 * Auth todavía lleva el correo que escribió el cliente. Este script la pasa a
 * su dirección interna (la que la 0559 ya le asignó) y lo anota en la base.
 * No manda ningún correo: el enlace de comprobación lo envía el equipo desde
 * «Registros por link» → «Reenviar comprobación».
 *
 * ⚠️ NO LO CORRE UN WORKER. Lo corre el Director General con el OK nominal de
 *    Sam, después de aplicar la 0559 y de publicar la app que la usa.
 *
 * Por defecto es un ENSAYO: sólo cuenta, no escribe nada. Para escribir hay que
 * pasar `--aplicar`.
 *
 *   node infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs
 *   node infra/ops/portal-correo-comprobacion/pasar-cuentas-a-direccion-interna.mjs --aplicar
 *
 * Lee del entorno (nunca de un archivo del repo, nunca los imprime):
 *   SUPABASE_URL                 URL de la API
 *   SUPABASE_SERVICE_ROLE_KEY    llave de servicio
 *
 * Salida: sólo conteos e ids internos de la fila de comprobación. Ni correos,
 * ni nombres, ni Shipping Marks.
 *
 * Idempotente: una cuenta que ya lleva su dirección interna no se toca; volver
 * a correrlo sólo procesa las que falten.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const CORREO_INTERNO = /^c-[0-9a-f]{32}@sin-comprobar\.invalid$/;

/** Lógica pura, probada en `__tests__/pasar-cuentas.test.mjs`. */
export async function pasarCuentas(admin, { aplicar, log = () => {} }) {
  const resumen = { pendientes: 0, pasadas: 0, yaEstaban: 0, fallidas: 0, aplicar };

  const { data, error } = await admin
    .from("client_email_checks")
    .select("id, auth_user_id, internal_email")
    .is("verified_at", null)
    .eq("auth_interno", false)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`no se pudo leer client_email_checks: ${error.code ?? "sin código"}`);

  const filas = data ?? [];
  resumen.pendientes = filas.length;

  for (const fila of filas) {
    if (!CORREO_INTERNO.test(fila.internal_email ?? "")) {
      resumen.fallidas += 1;
      log(`fila ${fila.id}: dirección interna con forma inesperada; no se toca`);
      continue;
    }
    if (!aplicar) continue;

    const { data: cuenta, error: leerErr } = await admin.auth.admin.getUserById(fila.auth_user_id);
    if (leerErr || !cuenta?.user) {
      resumen.fallidas += 1;
      log(`fila ${fila.id}: no se pudo leer la cuenta`);
      continue;
    }
    const yaInterna = (cuenta.user.email ?? "").toLowerCase() === fila.internal_email;
    if (!yaInterna) {
      const { error: authErr } = await admin.auth.admin.updateUserById(fila.auth_user_id, {
        email: fila.internal_email,
        email_confirm: true,
      });
      if (authErr) {
        resumen.fallidas += 1;
        log(`fila ${fila.id}: Auth rechazó el cambio (${authErr.status ?? "sin estado"})`);
        continue;
      }
    }
    const { error: anotarErr } = await admin.rpc("portal_email_check_auth_interno", {
      p_check_id: fila.id,
    });
    if (anotarErr) {
      resumen.fallidas += 1;
      log(`fila ${fila.id}: la base no lo anotó (${anotarErr.code ?? "sin código"})`);
      continue;
    }
    if (yaInterna) resumen.yaEstaban += 1;
    else resumen.pasadas += 1;
  }

  return resumen;
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    process.exit(2);
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(aplicar ? "MODO: APLICAR (escribe)" : "MODO: ENSAYO (no escribe nada)");
  const r = await pasarCuentas(admin, { aplicar, log: (m) => console.log(`  · ${m}`) });
  console.log(`Cuentas por link cuya cuenta de Auth todavía lleva un correo real: ${r.pendientes}`);
  if (aplicar) {
    console.log(`Pasadas a su dirección interna: ${r.pasadas}`);
    console.log(`Ya la llevaban (sólo se anotó): ${r.yaEstaban}`);
  } else {
    console.log("Ensayo: no se cambió nada. Para aplicar, vuelve a correr con --aplicar.");
  }
  console.log(`Con problema (no se tocaron): ${r.fallidas}`);
  process.exit(r.fallidas > 0 ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`Falló: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
