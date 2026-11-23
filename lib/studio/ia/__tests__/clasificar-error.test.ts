import { describe, expect, it } from "vitest";

import { CLASES, clasificarError, entradaDesdeErrorAnthropic, salta } from "../clasificar-error";

const base = { proveedor: "anthropic", operacion: "a1_noticias" };

describe("clasificarError · tabla de la 0638 §5.1", () => {
  const casos: Array<[string, Parameters<typeof clasificarError>[0], string]> = [
    ["402", { ...base, status: 402 }, "falta_de_pago"],
    ["400 con texto de saldo", { ...base, status: 400, texto: "Your credit balance is too low to access the API" }, "falta_de_pago"],
    ["429 con código de saldo (OpenAI)", { proveedor: "openai", operacion: "a3_actas", status: 429, codigo: "insufficient_quota" }, "falta_de_pago"],
    ["código de pago sin status", { ...base, codigo: "billing_error" }, "falta_de_pago"],
    ["401 de cuenta desactivada", { ...base, status: 401, texto: "Your organization has been disabled." }, "cuenta_suspendida"],
    ["403 de cuenta desactivada (OpenAI)", { proveedor: "openai", operacion: "a3_actas", status: 403, codigo: "account_deactivated" }, "cuenta_suspendida"],
    ["401 de llave", { ...base, status: 401, codigo: "authentication_error", texto: "invalid x-api-key" }, "llave_invalida"],
    ["403 sin señal", { ...base, status: 403, codigo: "permission_error" }, "otro"],
    ["429 de ritmo", { ...base, status: 429, codigo: "rate_limit_error" }, "limite_de_uso"],
    ["500", { ...base, status: 500, codigo: "api_error" }, "proveedor_caido"],
    ["529 sobrecargado", { ...base, status: 529, codigo: "overloaded_error" }, "proveedor_caido"],
    ["tiempo agotado", { ...base, fallo: "tiempo_agotado" }, "proveedor_caido"],
    ["conexión", { ...base, fallo: "conexion" }, "proveedor_caido"],
    ["400 de entrada inválida", { ...base, status: 400, codigo: "invalid_request_error", texto: "max_tokens: too large" }, "otro"],
    ["cuerpo vacío", { ...base }, "otro"],
    ["GLM sin saldo, en chino", { proveedor: "zai", operacion: "a8_analisis_chatwoot", status: 429, texto: "余额不足或无可用资源包" }, "falta_de_pago"],
  ];
  for (const [nombre, entrada, clase] of casos) {
    it(nombre, () => {
      expect(clasificarError(entrada).clase).toBe(clase);
    });
  }

  it("precedencia: el código estructurado le gana al status y al texto", () => {
    // Un 429 con código de saldo es falta de pago, no límite de uso.
    expect(clasificarError({ proveedor: "openai", operacion: "x", status: 429, codigo: "insufficient_quota", texto: "rate limit" }).clase).toBe("falta_de_pago");
    // Un 500 con código de pago también.
    expect(clasificarError({ ...base, status: 500, codigo: "billing_error" }).clase).toBe("falta_de_pago");
  });

  it("devuelve proveedor, operación, status y código; nunca el texto ni algo con forma de llave", () => {
    const secreto = "sk-ant-api03-AbCdEf0123456789AbCdEf0123456789AbCdEf0123456789";
    const r = clasificarError({ ...base, status: 401, codigo: secreto, texto: `cuenta de alguien@correo.prueba con ${secreto}` });
    expect(Object.keys(r).sort()).toEqual(["clase", "codigo", "operacion", "proveedor", "status"]);
    expect(r.codigo).toBeNull();
    const todo = JSON.stringify(r);
    expect(todo).not.toContain("alguien@correo.prueba");
    expect(todo).not.toContain(secreto.toLowerCase());
    expect(todo).not.toContain(secreto);
  });

  it("propiedad: con cualquier texto, la salida nunca lo contiene", () => {
    const textos = ["hola mundo", "credit balance is too low para fulano", "账户已被禁用 por tal", "a".repeat(800)];
    for (const t of textos) {
      for (const status of [null, 400, 401, 403, 429, 500]) {
        const r = clasificarError({ ...base, status, texto: t });
        expect(CLASES).toContain(r.clase);
        expect(JSON.stringify(r)).not.toContain(t);
      }
    }
  });
});

describe("qué clases saltan (SDD-0704 §4.1)", () => {
  it("saltan caída, pago, suspensión y llave; no saltan el límite de uso ni otro", () => {
    expect(["proveedor_caido", "falta_de_pago", "cuenta_suspendida", "llave_invalida"].every((c) => salta(c as never))).toBe(true);
    expect(salta("limite_de_uso")).toBe(false);
    expect(salta("otro")).toBe(false);
  });
});

describe("entradaDesdeErrorAnthropic", () => {
  it("lee el status y el tipo del cuerpo de un APIError", () => {
    const err = Object.assign(new Error("529 overloaded"), { status: 529, error: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } });
    expect(clasificarError(entradaDesdeErrorAnthropic(err, "a2_brief"))).toEqual({
      clase: "proveedor_caido", proveedor: "anthropic", operacion: "a2_brief", status: 529, codigo: "overloaded_error",
    });
  });
  it("un error de conexión o de tiempo sin status es caída del proveedor", () => {
    const conexion = Object.assign(new Error("Connection error."), { name: "APIConnectionError" });
    const tiempo = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    expect(clasificarError(entradaDesdeErrorAnthropic(conexion, "a1_noticias")).clase).toBe("proveedor_caido");
    expect(clasificarError(entradaDesdeErrorAnthropic(tiempo, "a1_noticias")).clase).toBe("proveedor_caido");
  });
  it("un error cualquiera (no del SDK) es otro", () => {
    expect(clasificarError(entradaDesdeErrorAnthropic(new TypeError("x is undefined"), "a1_noticias")).clase).toBe("otro");
    expect(clasificarError(entradaDesdeErrorAnthropic("cadena suelta", "a1_noticias")).clase).toBe("otro");
  });
});
