// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESEND_SIMULADO_PRUEBA,
  resendBatchSend,
  resendGetReceivedEmail,
  resendSend,
  type ResendSendInput,
} from "../resend-api";
import { getEnvStatus } from "@/lib/studio/env-status";

/**
 * SDD-0544 · en el entorno de prueba los correos de la app no salen (D9).
 *
 * Prueba va a tener consolidados reales con correos de clientes reales. Con
 * `APP_ENV=staging`, `resendSend` y `resendBatchSend` no llaman a
 * `api.resend.com` aunque haya llave: devuelven `mock_no_key`, que los
 * consumidores ya tratan como «registrado, no enviado» (`send-email.ts` deja el
 * `mail_log` en `queued` con `error: "no_key"`). Producción no cambia.
 *
 * La llave de estas pruebas es sintética: nunca sale de este archivo porque
 * `fetch` es un doble.
 */

const LLAVE = "re_SINTETICA_0544";
const CORREO: ResendSendInput = {
  from: "DTD Cargo <noreply@example.test>",
  to: "cliente@example.test",
  subject: "Asunto sintético",
  html: "<p>cuerpo</p>",
};

const fetchDoble = vi.fn();

beforeEach(() => {
  fetchDoble.mockReset();
  fetchDoble.mockImplementation(async (url: string) => {
    const lote = String(url).endsWith("/emails/batch");
    return new Response(
      JSON.stringify(lote ? { data: [{ id: "lote-1" }] } : { id: "msg-1" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetchDoble);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function entorno(appEnv: string, llave: string | undefined) {
  vi.stubEnv("APP_ENV", appEnv);
  vi.stubEnv("RESEND_API_KEY", llave);
}

describe("SDD-0544 · Resend en el entorno de prueba", () => {
  it("staging con llave: resendSend no llama a Resend y queda simulado", async () => {
    entorno("staging", LLAVE);
    const r = await resendSend(CORREO);
    expect(fetchDoble).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: "mock_no_key", code: RESEND_SIMULADO_PRUEBA });
  });

  it("staging con llave: resendBatchSend tampoco", async () => {
    entorno("staging", LLAVE);
    const r = await resendBatchSend([CORREO], "lote-sintetico-0544");
    expect(fetchDoble).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: "mock_no_key", code: RESEND_SIMULADO_PRUEBA });
  });

  it("staging sin llave: el modo mock de siempre, sin red", async () => {
    entorno("staging", undefined);
    expect(await resendSend(CORREO)).toEqual({ ok: false, error: "mock_no_key" });
    expect(fetchDoble).not.toHaveBeenCalled();
  });

  it("producción sin cambios: con llave envía a api.resend.com", async () => {
    entorno("production", LLAVE);
    const r = await resendSend(CORREO);
    expect(r).toEqual({ ok: true, id: "msg-1" });
    expect(fetchDoble).toHaveBeenCalledTimes(1);
    expect(fetchDoble.mock.calls[0][0]).toBe("https://api.resend.com/emails");
  });

  it("producción sin cambios: el lote también sale", async () => {
    entorno("production", LLAVE);
    expect(await resendBatchSend([CORREO], "lote-sintetico-0544")).toEqual({ ok: true, ids: ["lote-1"] });
    expect(fetchDoble.mock.calls[0][0]).toBe("https://api.resend.com/emails/batch");
  });

  it("producción sin llave: mock_no_key como antes", async () => {
    entorno("production", undefined);
    expect(await resendSend(CORREO)).toEqual({ ok: false, error: "mock_no_key" });
    expect(fetchDoble).not.toHaveBeenCalled();
  });

  it("leer un correo entrante no envía nada y no cambia en staging", async () => {
    entorno("staging", LLAVE);
    await resendGetReceivedEmail("correo-entrante-sintetico");
    expect(fetchDoble).toHaveBeenCalledTimes(1);
    expect(String(fetchDoble.mock.calls[0][0])).toContain("/emails/receiving/");
  });
});

describe("SDD-0544 · el panel de entorno muestra Resend en mock en staging", () => {
  it("staging con llave → mock", () => {
    entorno("staging", LLAVE);
    expect(getEnvStatus().integrations.resend).toBe("mock");
  });

  it("producción con llave → active, como antes", () => {
    entorno("production", LLAVE);
    expect(getEnvStatus().integrations.resend).toBe("active");
  });
});
