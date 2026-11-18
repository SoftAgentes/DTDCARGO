#!/usr/bin/env node
/**
 * SDD-0646 (D-1, opción C) · corrida ÚNICA para las cuentas del portal que
 * nacieron de un link de registro ANTES de la migración 0559.
 *
 * Esas cuentas quedan «sin comprobar» al aplicar la 0559. Este script completa
 * el paso que la migración no puede hacer: pasa cada cuenta a su dirección
 * interna (la que la 0559 ya le asignó) y lo anota en la base.
 * No manda ningún correo: el enlace de comprobación lo envía el equipo desde
 * «Registros por link» → «Reenviar comprobación».
 *
 * ⚠️ NO LO CORRE UN WORKER. Lo corre el Director General con el OK nominal de
 *    Sam, INMEDIATAMENTE después de aplicar la 0559 y de publicar la app que la
 *    usa, en la misma ventana.
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
 * a correrlo sólo procesa las que falten. Recorre todas las filas por lotes.
 *
 * Una fila cuya cuenta de Auth ya no existe («huérfana») no tiene nada que
 * pasar: se cuenta aparte, no se toca, no se borra y no cuenta como pendiente.
 * El ensayo también las detecta (sólo lee).
 *
 * Código de salida: 0 sólo si no queda ninguna pendiente, ninguna falló y no
 * hay huérfanas; 1 si alguna falló; 3 si después de aplicar siguen quedando
 * pendientes; 4 si lo único que queda son huérfanas (la corrida terminó; esas
 * filas se le informan al equipo y no se reintentan).
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const CORREO_INTERNO = /^c-[0-9a-f]{32}@sin-comprobar\.invalid$/;

const LOTE = 200;

/** Un lote de filas pendientes, después de `despuesDe` (paginación por id). */
async function leerLote(admin, despuesDe) {
  let q = admin
    .from("client_email_checks")
    .select("id, auth_user_id, internal_email")
    .is("verified_at", null)
    .eq("auth_interno", false)
    .order("id", { ascending: true })
    .limit(LOTE);
  if (despuesDe) q = q.gt("id", despuesDe);
  const { data, error } = await q;
  if (error) throw new Error(`no se pudo leer client_email_checks: ${error.code ?? "sin código"}`);
  return data ?? [];
}

/** Recorre TODAS las filas pendientes, lote a lote. */
async function recorrer(admin, cada) {
  let despuesDe = null;
  for (;;) {
    const filas = await leerLote(admin, despuesDe);
    if (filas.length === 0) return;
    for (const fila of filas) await cada(fila);
    despuesDe = filas[filas.length - 1].id;
    if (filas.length < LOTE) return;
  }
}

/**
 * Lógica de la corrida, probada en
 * `lib/studio/__tests__/registro-link-correo-estado.test.ts`.
 *
 * `quedan` = filas que siguen pendientes al terminar (en el ensayo, todas). La
 * corrida sólo está completa con `quedan === 0` y `fallidas === 0`.
 */
export async function pasarCuentas(admin, { aplicar, log = () => {} }) {
  const resumen = { pendientes: 0, pasadas: 0, yaEstaban: 0, fallidas: 0, huerfanas: 0, quedan: 0, aplicar };
  const huerfanas = new Set();

  await recorrer(admin, async (fila) => {
    if (!CORREO_INTERNO.test(fila.internal_email ?? "")) {
      resumen.pendientes += 1;
      resumen.fallidas += 1;
      log(`fila ${fila.id}: dirección interna con forma inesperada; no se toca`);
      return;
    }

    // Leer la cuenta no escribe nada: también en el ensayo.
    const { data: cuenta, error: leerErr } = await admin.auth.admin.getUserById(fila.auth_user_id);
    if (leerErr?.status === 404 || (!leerErr && !cuenta?.user)) {
      resumen.huerfanas += 1;
      huerfanas.add(fila.id);
      log(`fila ${fila.id}: la cuenta de Auth ya no existe; no se toca (revisión del equipo)`);
      return;
    }
    resumen.pendientes += 1;
    if (leerErr) {
      resumen.fallidas += 1;
      log(`fila ${fila.id}: no se pudo leer la cuenta (${leerErr.status ?? "sin estado"})`);
      return;
    }
    if (!aplicar) return;
    const yaInterna = (cuenta.user.email ?? "").toLowerCase() === fila.internal_email;
    if (!yaInterna) {
      const { error: authErr } = await admin.auth.admin.updateUserById(fila.auth_user_id, {
        email: fila.internal_email,
        email_confirm: true,
      });
      if (authErr) {
        resumen.fallidas += 1;
        log(`fila ${fila.id}: Auth rechazó el cambio (${authErr.status ?? "sin estado"})`);
        return;
      }
    }
    const { error: anotarErr } = await admin.rpc("portal_email_check_auth_interno", {
      p_check_id: fila.id,
    });
    if (anotarErr) {
      resumen.fallidas += 1;
      log(`fila ${fila.id}: la base no lo anotó (${anotarErr.code ?? "sin código"})`);
      return;
    }
    if (yaInterna) resumen.yaEstaban += 1;
    else resumen.pasadas += 1;
  });

  // Se vuelve a contar lo que quedó: no se da por hecho.
  if (aplicar) {
    await recorrer(admin, async (fila) => {
      if (!huerfanas.has(fila.id)) resumen.quedan += 1;
    });
  } else {
    resumen.quedan = resumen.pendientes;
  }

  return resumen;
}

/** Código de salida: 0 sólo si no queda nada pendiente y nada falló. */
export function codigoDeSalida(resumen) {
  if (resumen.fallidas > 0) return 1;
  if (resumen.aplicar && resumen.quedan > 0) return 3;
  if (resumen.huerfanas > 0) return 4;
  return 0;
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
  console.log(`Cuentas por link que todavía no pasaron a su dirección interna: ${r.pendientes}`);
  if (aplicar) {
    console.log(`Pasadas a su dirección interna: ${r.pasadas}`);
    console.log(`Ya la llevaban (sólo se anotó): ${r.yaEstaban}`);
  } else {
    console.log("Ensayo: no se cambió nada. Para aplicar, vuelve a correr con --aplicar.");
  }
  console.log(`Con problema (no se tocaron): ${r.fallidas}`);
  console.log(`Su cuenta de Auth ya no existe (no se tocaron ni se borraron; no cuentan como pendientes): ${r.huerfanas}`);
  if (r.aplicar) console.log(`Siguen pendientes después de la corrida: ${r.quedan}`);
  const codigo = codigoDeSalida(r);
  if (codigo === 4) {
    console.log("La corrida terminó. Sólo quedan filas cuya cuenta ya no existe: pásale sus ids al equipo; no se reintentan.");
  } else if (codigo !== 0) {
    console.log("LA CORRIDA NO ESTÁ COMPLETA. Revisa lo anterior y vuelve a correrla.");
  }
  process.exit(codigo);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(`Falló: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
