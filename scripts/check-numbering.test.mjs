/**
 * Tests de la decisión del gate `numbering` (scripts/check-numbering.mjs).
 *
 * QUÉ PROTEGEN: las cuatro colisiones del 2026-07-29 (spec 0172 duplicada,
 * migración 0268 duplicada, 0174 esquivada de casualidad, spec 0175 duplicada
 * DESPUÉS de haber chequeado origin/main). Ninguna la cazó el gate.
 *
 * Las dos mitades importan igual: un check que no caza no sirve, y un check
 * ruidoso se ignora. Por eso hay tests de las dos formas de fallar — que grite
 * por lo nuevo, y que NO grite por los cuatro choques históricos que ya están
 * aplicados en prod y no se pueden renumerar.
 */
import { describe, expect, it } from "vitest";
import { findClashes, numberOf } from "./check-numbering.mjs";

const spec = (name, sdd = name.slice(0, 4)) => ({ name, sdd });

describe("numberOf", () => {
  it("saca el prefijo de 4 dígitos", () => {
    expect(numberOf("0175-portal-estado-de-cuenta")).toBe("0175");
    expect(numberOf("0269_prealertas_client_note")).toBe("0269");
  });

  it("conserva los ceros a la izquierda (es string, no número)", () => {
    // Si devolviera un number, "0057" y "57" colisionarían al comparar con el
    // front-matter, que es texto.
    expect(numberOf("0057_seo_drafts_brief_fields")).toBe("0057");
  });

  it("devuelve null si no arranca con NNNN", () => {
    expect(numberOf("init_tenancy")).toBeNull();
    expect(numberOf("README.md")).toBeNull();
  });
});

describe("findClashes · specs duplicadas", () => {
  it("caza dos carpetas de spec con el MISMO número (el caso 0172)", () => {
    const clashes = findClashes(
      [spec("0172-tenant-fixtures-lifecycle"), spec("0172-portal-nueva-compra")],
      [],
      {},
    );
    expect(clashes).toHaveLength(1);
    expect(clashes[0].kind).toBe("spec-duplicada");
    expect(clashes[0].number).toBe("0172");
  });

  it("no grita cuando todas las specs tienen número propio", () => {
    expect(
      findClashes([spec("0173-a"), spec("0174-b"), spec("0175-c")], [], {}),
    ).toEqual([]);
  });

  it("ignora carpetas que no arrancan con NNNN", () => {
    expect(findClashes([{ name: "borradores", sdd: null }], [], {})).toEqual([]);
  });
});

describe("findClashes · sdd ≠ carpeta", () => {
  it("caza la renumeración a medias (carpeta 0177, front-matter 0175)", () => {
    // El residuo exacto que dejó la renumeración del 29-jul si se olvidaba el
    // front-matter: docs:check pasaba verde porque sólo miraba que 'sdd' EXISTA.
    const clashes = findClashes(
      [spec("0177-portal-estado-de-cuenta", "0175")],
      [],
      {},
    );
    expect(clashes).toHaveLength(1);
    expect(clashes[0].kind).toBe("sdd-no-coincide");
  });

  it("no grita cuando el front-matter coincide", () => {
    expect(findClashes([spec("0177-portal-estado-de-cuenta", "0177")], [], {})).toEqual([]);
  });

  it("ignora sdd ausente — ese error lo reporta docs:check, no se duplica", () => {
    expect(findClashes([{ name: "0177-x", sdd: null }], [], {})).toEqual([]);
  });
});

describe("findClashes · migraciones duplicadas", () => {
  it("caza dos migraciones con el mismo número (el caso 0268)", () => {
    const clashes = findClashes(
      [],
      ["0268_tenant_lifecycle_guardrails", "0268_prealertas_client_note"],
      {},
    );
    expect(clashes).toHaveLength(1);
    expect(clashes[0].kind).toBe("migracion-duplicada");
    expect(clashes[0].number).toBe("0268");
  });

  it("el sufijo de letra NO es un choque — 0006b continúa a 0006 a propósito", () => {
    expect(
      findClashes([], ["0006_clients", "0006b_clients_seed_align"], {}),
    ).toEqual([]);
    expect(
      findClashes(
        [],
        ["0020_operario_pins", "0020b_x", "0020c_y", "0020e_z"],
        {},
      ),
    ).toEqual([]);
  });
});

describe("findClashes · choques históricos congelados", () => {
  const HIST = {
    "0247": [
      "0247_client_notifications",
      "0247_grant_next_consolidation_ref_authenticated",
    ],
  };

  it("no grita por un choque declarado (ya aplicado en prod, no se renumera)", () => {
    expect(
      findClashes(
        [],
        ["0247_client_notifications", "0247_grant_next_consolidation_ref_authenticated"],
        HIST,
      ),
    ).toEqual([]);
  });

  it("⭐ vuelve a gritar si aparece un TERCER archivo con ese número", () => {
    // Congelar el número pelado habría abierto un agujero permanente: cualquier
    // migración nueva que cayera en el 0247 entraría gratis. Se exime el SET
    // exacto, no el número.
    const clashes = findClashes(
      [],
      [
        "0247_client_notifications",
        "0247_grant_next_consolidation_ref_authenticated",
        "0247_lo_que_sea_nuevo",
      ],
      HIST,
    );
    expect(clashes).toHaveLength(1);
    expect(clashes[0].number).toBe("0247");
  });

  it("vuelve a gritar si el set declarado ya no coincide (alguien renombró uno)", () => {
    const clashes = findClashes(
      [],
      ["0247_client_notifications", "0247_otro_nombre"],
      HIST,
    );
    expect(clashes).toHaveLength(1);
  });
});

describe("findClashes · salida", () => {
  it("devuelve los choques ordenados por número", () => {
    const clashes = findClashes(
      [spec("0300-a"), spec("0300-b"), spec("0100-x"), spec("0100-y")],
      [],
      {},
    );
    expect(clashes.map((c) => c.number)).toEqual(["0100", "0300"]);
  });

  it("array vacío cuando no hay nada que revisar", () => {
    expect(findClashes([], [], {})).toEqual([]);
  });
});
