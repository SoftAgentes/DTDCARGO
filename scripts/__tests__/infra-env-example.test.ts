// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0505 · el `.env.example` del servidor (infra/dtd-cargo/) no puede
 * quedarse atrás del de la raíz.
 *
 * Son dos archivos para un mismo contenedor: el de la raíz documenta lo que la
 * app lee (lo vigila `env-example-contract.test.ts`); el de infra es lo que de
 * verdad se copia a /srv/dtd-cargo/.env. Si alguien agrega una variable a la
 * raíz y no a infra, el servidor arranca sin ella y la función que la usa se
 * apaga en silencio. Acá eso es rojo.
 *
 * Y al revés de lo que se podría pensar, también se vigila que infra no traiga
 * valores: la plantilla lleva nombres y placeholders, nunca una clave que
 * funcione (las demo del compose oficial de Supabase funcionan tal cual).
 */
const RAIZ = join(process.cwd(), ".env.example");
const INFRA = join(process.cwd(), "infra/dtd-cargo/.env.example");

function nombres(texto: string): string[] {
  return [...new Set([...texto.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]))];
}

describe("SDD-0505 · .env.example del servidor", () => {
  it("documenta toda variable del .env.example de la raíz (por nombre)", async () => {
    const [raiz, infra] = await Promise.all([readFile(RAIZ, "utf8"), readFile(INFRA, "utf8")]);
    // Límite de palabra, no `includes`: FOO no cuenta como documentada porque
    // exista FOO_BAR (mismo criterio que env-example-contract.test.ts).
    const documentada = (v: string) => new RegExp(`\\b${v}\\b`).test(infra);
    const faltantes = nombres(raiz).filter((v) => !documentada(v)).sort();
    expect(faltantes).toEqual([]);
  });

  it("no trae claves que funcionen: ni JWT, ni PAT de Supabase, ni demo del upstream", async () => {
    const infra = await readFile(INFRA, "utf8");
    expect(infra).not.toMatch(/eyJhbGci/); // cabecera base64 de un JWT firmado
    expect(infra).not.toMatch(/sbp_[A-Za-z0-9]/); // PAT de Supabase
    expect(infra).not.toMatch(/super-secret|this_password_is_insecure/); // demo del compose oficial
    // Las secciones que la spec exige (app + GOTRUE_* + SMTP_* + Storage) existen.
    for (const v of [
      "APP_ENV",
      "APP_URL",
      "REQUEST_IP_HEADER",
      "CRON_SECRET",
      "JWT_SECRET",
      "ANON_KEY",
      "SERVICE_ROLE_KEY",
      "SITE_URL",
      "ADDITIONAL_REDIRECT_URLS",
      "MAILER_OTP_EXP",
      "SMTP_HOST",
      "SMTP_PASS",
      "FUNCTIONS_VERIFY_JWT",
      "STORAGE_S3_BUCKET",
      "DASHBOARD_PASSWORD",
    ]) {
      expect(nombres(infra), `falta ${v}`).toContain(v);
    }
    // Las cuatro funciones de Kommo se autentican solas: el router no verifica JWT.
    expect(infra).toMatch(/^FUNCTIONS_VERIFY_JWT=false$/m);
  });

  it("el compose declara las variables críticas con fallo cerrado (`:?`)", async () => {
    const [app, supabase] = await Promise.all([
      readFile(join(process.cwd(), "infra/dtd-cargo/compose.yml"), "utf8"),
      readFile(join(process.cwd(), "infra/dtd-cargo/compose.supabase.yml"), "utf8"),
    ]);
    for (const v of ["CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "APP_ENV", "APP_URL"]) {
      expect(app, `${v} sin :? en compose.yml`).toMatch(new RegExp(`\\$\\{${v}:\\?`));
    }
    for (const v of ["POSTGRES_PASSWORD", "JWT_SECRET", "ANON_KEY", "SERVICE_ROLE_KEY", "DASHBOARD_PASSWORD"]) {
      expect(supabase, `${v} sin :? en compose.supabase.yml`).toMatch(new RegExp(`\\$\\{${v}:\\?`));
    }
    // Aislamiento de la spec: ni puertos publicados ni container_name.
    expect(app).not.toMatch(/^\s+ports:/m);
    expect(supabase).not.toMatch(/^\s+ports:/m);
    expect(app).not.toMatch(/container_name:/);
    expect(supabase).not.toMatch(/container_name:/);
    // Postgres conserva el config_file del upstream (sin él no cargan pg_cron/pg_net/vault).
    expect(supabase).toContain('"config_file=/etc/postgresql/postgresql.conf"');
  });
});
