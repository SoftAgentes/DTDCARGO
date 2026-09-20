// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateServicioConfigInput,
  servicioPublishReadiness,
  parseOfferMatrixInput,
  chargeMomentLabel,
  CHARGE_MOMENT_OPTIONS,
  type ServicioConfigInput,
} from "../types";

describe("validateServicioConfigInput", () => {
  it("rechaza un servicio sin nombre", () => {
    const { fieldErrors } = validateServicioConfigInput({ title_public: "  " });
    expect(fieldErrors?.title_public).toBeTruthy();
  });

  it("acepta el mínimo (solo nombre) y normaliza el resto", () => {
    const { input, fieldErrors } = validateServicioConfigInput({
      title_public: "Puerta a puerta DDP",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.title_public).toBe("Puerta a puerta DDP");
    expect(input?.includes_public).toEqual([]);
    expect(input?.payment_methods).toEqual([]);
    expect(input?.service_state).toBe("activo");
    expect(input?.charge_moment).toBeNull();
  });

  it("filtra los items de alcance vacíos", () => {
    const { input } = validateServicioConfigInput({
      title_public: "X",
      includes_public: ["Flete", "   ", "Aduana"],
      excludes_public: [""],
    });
    expect(input?.includes_public).toEqual(["Flete", "Aduana"]);
    expect(input?.excludes_public).toEqual([]);
  });

  it("rechaza un momento de cobro inválido", () => {
    const { fieldErrors } = validateServicioConfigInput({
      title_public: "X",
      charge_moment: "manana" as unknown as ServicioConfigInput["charge_moment"],
    });
    expect(fieldErrors?.charge_moment).toBeTruthy();
  });

  it("rechaza un método de pago inválido", () => {
    const { fieldErrors } = validateServicioConfigInput({
      title_public: "X",
      payment_methods: ["bitcoin"] as unknown as ServicioConfigInput["payment_methods"],
    });
    expect(fieldErrors?.payment_methods).toBeTruthy();
  });

  it("acepta un charge_moment y métodos válidos", () => {
    const { input, fieldErrors } = validateServicioConfigInput({
      title_public: "X",
      charge_moment: "contra_entrega",
      payment_methods: ["zelle", "usdt"],
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.charge_moment).toBe("contra_entrega");
    expect(input?.payment_methods).toEqual(["zelle", "usdt"]);
  });
});

describe("servicioPublishReadiness (guardrail anti 'solo contable')", () => {
  const full = {
    title_public: "Puerta a puerta DDP",
    description_public: "Traemos tu carga de China a tu puerta.",
    includes_public: ["Flete", "Aduana"],
    how_to_request: "Escríbenos por WhatsApp.",
  };

  it("listo cuando lo descriptivo está completo", () => {
    expect(servicioPublishReadiness(full).ready).toBe(true);
    expect(servicioPublishReadiness(full).missing).toEqual([]);
  });

  it("NO publica con solo el nombre (faltan descripción, alcance, cómo se solicita)", () => {
    const r = servicioPublishReadiness({
      title_public: "Servicio X",
      description_public: "",
      includes_public: [],
      how_to_request: "",
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("descripción");
    expect(r.missing).toContain("qué incluye (alcance)");
    expect(r.missing).toContain("cómo se solicita");
  });

  it("NO publica sin alcance aunque tenga descripción", () => {
    const r = servicioPublishReadiness({ ...full, includes_public: [] });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["qué incluye (alcance)"]);
  });
});

describe("parseOfferMatrixInput (SDD-0090)", () => {
  it("núcleo: limpia claves inválidas y deduplica suggests/includes", () => {
    const out = parseOfferMatrixInput(
      {
        suggests: ["transito-aduana", "basura", "transito-aduana", "compra-asistida"],
        includes: ["documentos-importacion", "xyz"],
        charge_mode: "calculadora",
      },
      true,
    );
    expect(out.suggests_keys).toEqual(["transito-aduana", "compra-asistida"]);
    expect(out.includes_keys).toEqual(["documentos-importacion"]);
    expect(out.charge_mode).toBe("calculadora");
  });

  it("add-on: fuerza suggests/includes a [] aunque el form mande algo", () => {
    const out = parseOfferMatrixInput(
      { suggests: ["transito-aduana"], includes: ["compra-asistida"], charge_mode: "asesor" },
      false,
    );
    expect(out.suggests_keys).toEqual([]);
    expect(out.includes_keys).toEqual([]);
    expect(out.charge_mode).toBe("asesor");
  });

  it("charge_mode inválido o vacío → null", () => {
    expect(parseOfferMatrixInput({ charge_mode: "raro" }, true).charge_mode).toBeNull();
    expect(parseOfferMatrixInput({ charge_mode: null }, true).charge_mode).toBeNull();
    expect(parseOfferMatrixInput({}, true).charge_mode).toBeNull();
  });

  it("'incluido' gana sobre 'ofrecer': una clave en ambos sale solo de includes", () => {
    const out = parseOfferMatrixInput(
      {
        suggests: ["transito-aduana", "compra-asistida"],
        includes: ["transito-aduana"],
      },
      true,
    );
    expect(out.includes_keys).toEqual(["transito-aduana"]);
    expect(out.suggests_keys).toEqual(["compra-asistida"]);
  });
});

describe("chargeMomentLabel", () => {
  it("mapea valores conocidos", () => {
    expect(chargeMomentLabel("contra_entrega")).toBe(
      CHARGE_MOMENT_OPTIONS.find((o) => o.value === "contra_entrega")!.label,
    );
  });
  it("devuelve '' para null/vacío", () => {
    expect(chargeMomentLabel(null)).toBe("");
    expect(chargeMomentLabel("")).toBe("");
  });
});
