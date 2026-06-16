import { describe, it, expect } from "vitest";
import {
  mergeServiciosPublicados,
  buildOfferOverrides,
  type PublicServicio,
} from "../servicios-queries";
import { SERVICIOS_DETALLE } from "@/lib/servicios-detalle";

function pub(overrides: Partial<PublicServicio>): PublicServicio {
  return {
    service_key: "puerta-a-puerta-ddp",
    shipment_service: "puerta_a_puerta_DDP",
    title_public: "",
    description_public: "",
    includes_public: [],
    excludes_public: [],
    price_text: "",
    price_table: null,
    charge_moment: null,
    payment_methods: [],
    how_to_request: "",
    timelines_public: "",
    note_public: null,
    condiciones_politicas: null,
    service_state: "activo",
    ...overrides,
  };
}

const ddpEstatico = SERVICIOS_DETALLE.find((s) => s.slug === "dtd-services-lcl")!;

describe("mergeServiciosPublicados", () => {
  it("sin publicados devuelve el estático intacto (cero regresión)", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, []);
    expect(out).toBe(SERVICIOS_DETALLE);
  });

  it("un publicado sobreescribe el contenido de su ficha (mapeo id↔legacySlug)", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, [
      pub({
        service_key: "puerta-a-puerta-ddp",
        description_public: "Descripción nueva desde la DB.",
        includes_public: ["Flete", "Aduana"],
      }),
    ]);
    const ddp = out.find((s) => s.slug === "dtd-services-lcl")!;
    expect(ddp.resumen).toBe("Descripción nueva desde la DB.");
    expect(ddp.incluye).toEqual(["Flete", "Aduana"]);
  });

  it("conserva slug/sede/destacado del estático al sobreescribir", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, [
      pub({ service_key: "puerta-a-puerta-ddp", description_public: "X" }),
    ]);
    const ddp = out.find((s) => s.slug === "dtd-services-lcl")!;
    expect(ddp.slug).toBe("dtd-services-lcl"); // NO el id
    expect(ddp.sede).toBe(ddpEstatico.sede);
    expect(ddp.destacado).toBe(ddpEstatico.destacado);
  });

  it("hace fallback al estático por campo vacío del publicado", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, [
      pub({ service_key: "puerta-a-puerta-ddp", description_public: "" }),
    ]);
    const ddp = out.find((s) => s.slug === "dtd-services-lcl")!;
    // description vacía en DB → mantiene el resumen estático original.
    expect(ddp.resumen).toBe(ddpEstatico.resumen);
  });

  it("agrega un publicado sin ficha estática (servicio nuevo)", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, [
      pub({
        service_key: "cursos-importacion",
        shipment_service: null,
        title_public: "Cursos de importación",
        description_public: "Aprende a importar.",
        service_state: "activo",
      }),
    ]);
    expect(out.length).toBe(SERVICIOS_DETALLE.length + 1);
    const curso = out.find((s) => s.titulo === "Cursos de importación")!;
    expect(curso).toBeDefined();
    expect(curso.resumen).toBe("Aprende a importar.");
  });

  it("no duplica: un publicado que matchea NO se agrega de nuevo", () => {
    const out = mergeServiciosPublicados(SERVICIOS_DETALLE, [
      pub({ service_key: "puerta-a-puerta-ddp", description_public: "X" }),
    ]);
    expect(out.length).toBe(SERVICIOS_DETALLE.length);
  });
});

describe("buildOfferOverrides (SDD-0090)", () => {
  it("sin campos de oferta devuelve {} (forward-compat: 0142 no aplicada)", () => {
    const out = buildOfferOverrides([pub({ service_key: "puerta-a-puerta-ddp" })]);
    expect(out).toEqual({});
  });

  it("mapea suggests_keys/includes_keys/charge_mode a un override", () => {
    const out = buildOfferOverrides([
      pub({
        service_key: "lcl-consolidado",
        suggests_keys: ["transito-aduana", "compra-asistida"],
        includes_keys: ["documentos-importacion"],
        charge_mode: "asesor",
      }),
    ]);
    expect(out["lcl-consolidado"]).toEqual({
      suggests: ["transito-aduana", "compra-asistida"],
      includes: ["documentos-importacion"],
      chargeMode: "asesor",
    });
  });

  it("descarta service_keys que no son del catálogo", () => {
    const out = buildOfferOverrides([
      pub({ service_key: "no-existe", suggests_keys: ["transito-aduana"] }),
    ]);
    expect(out).toEqual({});
  });

  it("filtra claves sugeridas inválidas y charge_mode inválido", () => {
    const out = buildOfferOverrides([
      pub({
        service_key: "puerta-a-puerta-ddp",
        suggests_keys: ["transito-aduana", "basura"],
        charge_mode: "modo-raro",
      }),
    ]);
    expect(out["puerta-a-puerta-ddp"]).toEqual({ suggests: ["transito-aduana"] });
  });
});
