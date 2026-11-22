/**
 * SDD-0626 · La cuenta de Chatwoot del cable es SOLO `OFICINA_CHATWOOT_ACCOUNT_ID` (decisión del DG, 17/11/2026).
 *
 * En producción `CHATWOOT_ACCOUNT_ID` es la cuenta real del ERP (la Bandeja, el portal, los leads) y la bandeja de
 * prueba vive en otra cuenta. El cable (webhook, despachador, lectura y envío) nunca cae a la variable del ERP: si la
 * suya falta, está vacía o no es un entero positivo, no hay configuración y no corre nada (falla hacia apagado).
 * Estas pruebas fallan si el cable vuelve a usar la cuenta del ERP o si acepta una cuenta inválida.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatwootConfig, chatwootWebhookConfig } from "@/lib/studio/chatwoot/config";

import { configWebhookOficina } from "../config";
import { configDespachador } from "../despachador-config";
import { configEnvio } from "../envio";

const BASE = {
  OFICINA_WEBHOOK_ACTIVO: "1",
  OFICINA_WEBHOOK_SECRET: "secreto-sintetico",
  OFICINA_CHATWOOT_INBOX_PRUEBA: "11",
  OFICINA_DESPACHADOR_ACTIVO: "1",
  OFICINA_VACIADO_ACTIVO: "1",
  OFICINA_RUNTIME_URL: "http://runtime.prueba:18642",
  OFICINA_RUNTIME_TOKEN: "llave-sintetica",
  OFICINA_CHATWOOT_TOKEN_LECTURA: "lectura-sintetica",
  OFICINA_CHATWOOT_API_URL: "http://chatwoot.prueba:3000",
  OFICINA_ENVIO_ACTIVO: "1",
  OFICINA_CHATWOOT_TOKEN_ENVIO: "escritura-sintetica",
  // La cuenta real del ERP, siempre presente en producción.
  CHATWOOT_ACCOUNT_ID: "1",
};

const tresConfigs = (env: Record<string, string | undefined>) => ({
  webhook: configWebhookOficina(env).cuenta,
  despachador: configDespachador(env).chatwoot,
  envio: configEnvio(env).chatwoot,
});

describe("la cuenta del cable: OFICINA_CHATWOOT_ACCOUNT_ID, nunca CHATWOOT_ACCOUNT_ID", () => {
  it("(i) con solo la cuenta del ERP: el webhook no tiene cuenta y el despachador y el envío no tienen Chatwoot", () => {
    expect(tresConfigs(BASE)).toEqual({ webhook: null, despachador: null, envio: null });
  });

  it("(i) con las dos: manda la del cable, en las tres piezas", () => {
    const env = { ...BASE, OFICINA_CHATWOOT_ACCOUNT_ID: "2" };
    expect(configWebhookOficina(env).cuenta).toBe(2);
    expect(configDespachador(env).chatwoot).toMatchObject({ cuenta: 2, bandeja: 11 });
    expect(configEnvio(env).chatwoot).toMatchObject({ cuenta: 2, bandeja: 11 });
  });

  it.each(["", "   ", "0", "-2", "2.5", "1e3", "dos", "2abc", " 2 3"])(
    "(ii) OFICINA_CHATWOOT_ACCOUNT_ID=%j (cadena, no undefined): nada queda configurado",
    (valor) => {
      expect(tresConfigs({ ...BASE, OFICINA_CHATWOOT_ACCOUNT_ID: valor })).toEqual({
        webhook: null,
        despachador: null,
        envio: null,
      });
    },
  );

  it("los bloqueos de siempre siguen: una bandeja del ERP anula la de prueba aunque la cuenta sea la del cable", () => {
    for (const v of ["CHATWOOT_INBOX_PORTAL_ID", "CHATWOOT_INBOX_CLIENTES_ID", "CHATWOOT_INBOX_LEADS_ID"]) {
      const env = { ...BASE, OFICINA_CHATWOOT_ACCOUNT_ID: "2", [v]: "11" };
      expect(configWebhookOficina(env).bandejaPrueba).toBeNull();
      expect(configDespachador(env).chatwoot).toBeNull();
      expect(configEnvio(env).chatwoot).toBeNull();
    }
  });
});

describe("con las dos variables puestas, cada uno ve solo la suya", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("cable = 2 (OFICINA_CHATWOOT_ACCOUNT_ID) y la Bandeja del ERP = 1 (CHATWOOT_ACCOUNT_ID)", () => {
    vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", "2");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "1");
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "token-sintetico-erp");
    vi.stubEnv("CHATWOOT_WEBHOOK_SECRET", "secreto-sintetico-erp");
    vi.stubEnv("CHATWOOT_TENANT_ID", "00000000-0000-4000-8000-000000000001");
    const env = { ...BASE, OFICINA_CHATWOOT_ACCOUNT_ID: "2" };
    expect(configWebhookOficina(env).cuenta).toBe(2);
    expect(configDespachador(env).chatwoot?.cuenta).toBe(2);
    expect(configEnvio(env).chatwoot?.cuenta).toBe(2);
    // La Bandeja del ERP no se entera de la variable del cable.
    expect(chatwootConfig()?.accountId).toBe(1);
    expect(chatwootWebhookConfig()?.accountId).toBe(1);
  });

  it("la Bandeja del ERP no cae a la variable del cable cuando falta la suya", () => {
    vi.stubEnv("OFICINA_CHATWOOT_ACCOUNT_ID", "2");
    vi.stubEnv("CHATWOOT_ACCOUNT_ID", "");
    vi.stubEnv("CHATWOOT_PLATFORM_TOKEN", "token-sintetico-erp");
    expect(chatwootConfig()).toBeNull();
  });
});

describe("(i) en el código del cable no queda ningún uso de la cuenta del ERP", () => {
  const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const CARPETAS = ["lib/studio/oficina", "app/api/oficina"];
  const cronDelCable = readdirSync(join(RAIZ, "app/api/cron")).filter((d) => d.startsWith("oficina-"));

  function fuentes(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === "__tests__" ? [] : fuentes(p);
      return /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : [];
    });
  }

  const archivos = [...CARPETAS, ...cronDelCable.map((d) => `app/api/cron/${d}`)].flatMap((c) => fuentes(join(RAIZ, c)));

  it("hay archivos que revisar (el webhook, el despachador, la lectura, el envío y sus crons)", () => {
    expect(cronDelCable).toEqual(expect.arrayContaining(["oficina-despachador", "oficina-envio"]));
    expect(archivos.length).toBeGreaterThan(10);
  });

  it("ninguno nombra CHATWOOT_ACCOUNT_ID ni importa la configuración de la Bandeja del ERP", () => {
    const usos = archivos.flatMap((p) => {
      const texto = readFileSync(p, "utf8");
      const r: string[] = [];
      if (/(?<!OFICINA_)CHATWOOT_ACCOUNT_ID/.test(texto)) r.push(`${relative(RAIZ, p)}: CHATWOOT_ACCOUNT_ID`);
      if (/@\/lib\/studio\/chatwoot\/config["']/.test(texto)) r.push(`${relative(RAIZ, p)}: importa chatwoot/config`);
      return r;
    });
    expect(usos).toEqual([]);
  });
});
