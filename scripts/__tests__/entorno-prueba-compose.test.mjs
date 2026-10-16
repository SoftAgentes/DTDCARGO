// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { aMiB, revisar, TOPE_MIB } from "../../infra/ops/tests/revisar-compose-prueba.mjs";

/**
 * SDD-0540 · Fase 1 · el overlay del entorno de prueba (infra/dtd-cargo/compose.staging.yml).
 *
 * Sin Docker: une en memoria compose.yml + compose.supabase.yml + compose.staging.yml
 * con las reglas de compose que importan aquí (etiquetas y entorno se unen por
 * clave; `command` y la memoria los reemplaza el último archivo) y pasa el
 * resultado por el mismo revisor que usa infra/ops/tests/prueba-compose-prueba.sh
 * con la salida real de `docker compose config`.
 */

// ESLint ya declara js-yaml (mismo criterio que ci-workflow-contract.test.mjs).
const fromEslint = createRequire(createRequire(import.meta.url).resolve("eslint/package.json"));
const { load: loadYaml } = fromEslint("js-yaml");

const DIR = resolve("infra/dtd-cargo");
const leer = (f) => readFileSync(resolve(DIR, f), "utf8");
const PROYECTO = "dtd-cargo-staging";

function comoMapa(v) {
  if (!v) return {};
  if (Array.isArray(v)) {
    return Object.fromEntries(
      v.map((x) => {
        const i = x.indexOf("=");
        return i < 0 ? [x, ""] : [x.slice(0, i), x.slice(i + 1)];
      }),
    );
  }
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)]));
}

const conProyecto = (s) => s.split("${COMPOSE_PROJECT_NAME}").join(PROYECTO);

function unir(archivos) {
  const services = {};
  for (const f of archivos) {
    const doc = loadYaml(leer(f));
    for (const [nombre, s] of Object.entries(doc.services ?? {})) {
      const actual = (services[nombre] ??= {});
      const etiquetas = Object.fromEntries(
        Object.entries(comoMapa(s.labels)).map(([k, v]) => [conProyecto(k), conProyecto(v)]),
      );
      actual.labels = { ...(actual.labels ?? {}), ...etiquetas };
      actual.environment = { ...(actual.environment ?? {}), ...comoMapa(s.environment) };
      if (s.command) actual.command = s.command;
      if (s.profiles) actual.profiles = s.profiles;
      const memoria = s.deploy?.resources?.limits?.memory;
      if (memoria) actual.deploy = { resources: { limits: { memory: String(memoria) } } };
    }
  }
  return { services };
}

const ARCHIVOS_PRUEBA = ["compose.yml", "compose.supabase.yml", "compose.staging.yml"];

describe("SDD-0540 · overlay del entorno de prueba", () => {
  it("cumple todas las reglas del revisor y suma exactamente 3.072 MiB", () => {
    const { lineas, fallas, totalMiB } = revisar(unir(ARCHIVOS_PRUEBA));
    expect(lineas.filter((l) => !l.ok).map((l) => l.msg)).toEqual([]);
    expect(fallas).toBe(0);
    expect(totalMiB).toBe(TOPE_MIB);
  });

  it("la puerta del web es obligatoria (`:?`) y ya no hay lista de IP", () => {
    const staging = leer("compose.staging.yml");
    expect(staging).toMatch(/\$\{PRUEBA_WEB_USUARIOS:\?/);
    expect(staging).not.toMatch(/STAGING_ALLOWED_IPS|STAGING_INTERNAL_IPS|ipallowlist/i);
    expect(staging).toMatch(/basicauth\.removeheader=true/);
    expect(staging).not.toMatch(/^\s+ports:/m);
    expect(staging).not.toMatch(/container_name:/);
  });

  it("producción no cambia: sin el overlay sigue en 9.728 MiB", () => {
    const { services } = unir(["compose.yml", "compose.supabase.yml"]);
    const total = Object.values(services)
      .filter((s) => !s.profiles?.length)
      .reduce((t, s) => t + aMiB(s.deploy?.resources?.limits?.memory), 0);
    expect(total).toBe(9728);
  });

  // Controles rojos: si el revisor no detecta estas roturas, no prueba nada.
  it.each([
    ["la API sin su noindex", (c) => {
      c.services["api-gw"].labels[`traefik.http.routers.${PROYECTO}-supabase.middlewares`] = "security-headers@file";
    }],
    ["el web sin la clave", (c) => {
      c.services.web.labels[`traefik.http.routers.${PROYECTO}-web.middlewares`] = `${PROYECTO}-prueba-noindex@docker`;
    }],
    ["el buzón sin la clave", (c) => {
      c.services.mailpit.labels[`traefik.http.routers.${PROYECTO}-correo.middlewares`] = `${PROYECTO}-prueba-noindex@docker`;
    }],
    ["la base con el límite de producción", (c) => {
      c.services.db.deploy = { resources: { limits: { memory: "4g" } } };
    }],
    ["un servicio sin límite", (c) => {
      delete c.services.mailpit.deploy;
    }],
    ["una lista de IP", (c) => {
      c.services.web.labels[`traefik.http.middlewares.${PROYECTO}-ips.ipallowlist.sourcerange`] = "1.2.3.4/32";
    }],
    ["Mailpit con relay", (c) => {
      c.services.mailpit.environment.MP_SMTP_RELAY_HOST = "smtp.resend.com";
    }],
    ["GoTrue con el SMTP de producción", (c) => {
      c.services.auth.environment.GOTRUE_SMTP_HOST = "smtp.resend.com";
    }],
    ["la base sin config_file", (c) => {
      c.services.db.command = ["postgres", "-c", "shared_buffers=256MB", "-c", "max_connections=60"];
    }],
  ])("detecta %s", (_nombre, romper) => {
    const c = unir(ARCHIVOS_PRUEBA);
    romper(c);
    expect(revisar(c).fallas).toBeGreaterThan(0);
  });
});
