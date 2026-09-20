// @vitest-environment node
/**
 * SDD-0164 — la FUENTE ÚNICA del nombre de cada servicio.
 *
 * Estos tests existen porque el problema que la spec arregla fue de duplicación:
 * el mismo servicio se llamaba distinto en cada pantalla porque cada archivo
 * escribía su propia lista de etiquetas. Acá se fija el contrato:
 *  1. los 5 servicios existen, con nombre y aclaración,
 *  2. las variantes (corta, select) se DERIVAN, no se redefinen,
 *  3. los dos FCL son servicios distintos,
 *  4. ningún archivo del repo vuelve a escribir los literales viejos del enum.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  SHIPMENT_SERVICES,
  SERVICE_LABELS,
  SERVICE_SHORT_LABELS,
  SERVICE_OPTIONS,
  isShipmentService,
  serviceLabel,
} from "../shipment-public";

describe("shipment-public · fuente única de nombres de servicio", () => {
  it("expone los 5 servicios del enum, sin repetidos", () => {
    expect(SHIPMENT_SERVICES).toEqual([
      "puerta_a_puerta_DDP",
      "consolidado_lcl",
      "fcl_directo",
      "fcl_bodega",
      "transporte_terrestre",
    ]);
    expect(new Set(SHIPMENT_SERVICES).size).toBe(SHIPMENT_SERVICES.length);
  });

  it("cada servicio tiene nombre Y aclaración corta, ambos no vacíos", () => {
    for (const svc of SHIPMENT_SERVICES) {
      const l = SERVICE_LABELS[svc];
      expect(l.primary.trim().length).toBeGreaterThan(0);
      expect(l.sub?.trim().length ?? 0).toBeGreaterThan(0);
      expect(SERVICE_SHORT_LABELS[svc].trim().length).toBeGreaterThan(0);
    }
  });

  it("los nombres visibles no se repiten entre servicios", () => {
    const nombres = SHIPMENT_SERVICES.map((s) => SERVICE_LABELS[s].primary);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("ninguna etiqueta dice 'prepago' — se paga al llegar", () => {
    for (const svc of SHIPMENT_SERVICES) {
      const texto = [
        SERVICE_LABELS[svc].primary,
        SERVICE_LABELS[svc].sub ?? "",
        SERVICE_SHORT_LABELS[svc],
      ]
        .join(" ")
        .toLowerCase();
      expect(texto).not.toContain("prepago");
    }
  });

  it("el puerta a puerta no lleva la sigla DDP en el nombre visible", () => {
    expect(SERVICE_LABELS.puerta_a_puerta_DDP.primary).toBe("Puerta a Puerta");
    expect(SERVICE_SHORT_LABELS.puerta_a_puerta_DDP).not.toContain("DDP");
  });

  it("SERVICE_OPTIONS se deriva de SERVICE_LABELS (mismo orden, mismos textos)", () => {
    expect(SERVICE_OPTIONS.map((o) => o.value)).toEqual([...SHIPMENT_SERVICES]);
    for (const o of SERVICE_OPTIONS) {
      expect(o.label).toBe(SERVICE_LABELS[o.value].primary);
      expect(o.hint).toBe(SERVICE_LABELS[o.value].sub);
    }
  });

  it("los dos FCL son servicios distintos, con nombre distinto", () => {
    expect(SERVICE_LABELS.fcl_directo.primary).not.toBe(
      SERVICE_LABELS.fcl_bodega.primary,
    );
    expect(SERVICE_SHORT_LABELS.fcl_directo).not.toBe(
      SERVICE_SHORT_LABELS.fcl_bodega,
    );
    // El directo se carga en la fábrica; el de bodega se consolida en Yiwu.
    expect(SERVICE_LABELS.fcl_directo.sub?.toLowerCase()).toContain("origen");
    expect(SERVICE_LABELS.fcl_bodega.sub?.toLowerCase()).toContain("yiwu");
  });
});

describe("isShipmentService / serviceLabel", () => {
  it("acepta los valores del enum y rechaza el resto", () => {
    for (const svc of SHIPMENT_SERVICES) expect(isShipmentService(svc)).toBe(true);
    for (const basura of ["consolidacion", "reserva_FCL", "all", "", null, 7, {}])
      expect(isShipmentService(basura)).toBe(false);
  });

  it("serviceLabel devuelve el nombre, y el crudo si llega basura de la DB", () => {
    expect(serviceLabel("consolidado_lcl")).toBe("Consolidado LCL");
    expect(serviceLabel("lo-que-sea")).toBe("lo-que-sea");
  });
});

/**
 * Guardia anti-regresión. Barato y evita que el rename se deshaga de a pedacitos:
 * si alguien vuelve a escribir `"consolidacion"` o `"reserva_FCL"` como valor de
 * servicio en cualquier .ts/.tsx del repo, este test falla y nombra el archivo.
 *
 * Solo mira literales ENTRECOMILLADOS: la palabra "consolidación" en prosa, el
 * estado de bodega `pendiente_consolidacion` y los slugs de marketing
 * (`consolidacion-bodega-yiwu`) son legítimos y no matchean.
 */
describe("ningún archivo reintroduce los literales viejos del enum", () => {
  const RAIZ = path.resolve(__dirname, "../../..");
  // Este propio archivo los nombra a propósito (en los tests de rechazo).
  const ESTE = path.resolve(__filename);
  const ESTE_RELATIVO = path.relative(RAIZ, ESTE).replace(/\\/g, "/");
  // Se construyen por partes para que el propio guardia no se detecte.
  const CONSOLIDACION = ["consolida", "cion"].join("");
  const RESERVA_FCL = ["reserva_", "FCL"].join("");
  const VIEJOS = new RegExp(`["'](${CONSOLIDACION}|${RESERVA_FCL})["']`);

  function ejecutarGit(args: string[]) {
    const resultado = spawnSync("git", args, {
      cwd: RAIZ,
      encoding: "utf8",
      windowsHide: true,
    });
    if (resultado.error) throw resultado.error;
    return resultado;
  }

  function archivosVersionadosConLiteralesViejos(): string[] {
    const resultado = ejecutarGit([
      "grep",
      "-I",
      "-l",
      "-E",
      VIEJOS.source,
      "--",
      "*.ts",
      "*.tsx",
      `:(exclude)${ESTE_RELATIVO}`,
    ]);

    // `git grep` usa 1 para indicar que no encontró coincidencias.
    if (resultado.status === 1) return [];
    if (resultado.status !== 0) {
      throw new Error(
        `git grep falló (${resultado.status ?? "sin estado"}): ${resultado.stderr.trim()}`,
      );
    }

    return resultado.stdout
      .split(/\r?\n/)
      .map((archivo) => archivo.trim())
      .filter(Boolean);
  }

  function archivosNoVersionadosConLiteralesViejos(): string[] {
    const resultado = ejecutarGit([
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "*.ts",
      "*.tsx",
    ]);
    if (resultado.status !== 0) {
      throw new Error(
        `git ls-files falló (${resultado.status ?? "sin estado"}): ${resultado.stderr.trim()}`,
      );
    }

    return resultado.stdout
      .split("\0")
      .filter(Boolean)
      .filter((archivo) => archivo.replace(/\\/g, "/") !== ESTE_RELATIVO)
      .filter((archivo) =>
        VIEJOS.test(fs.readFileSync(path.join(RAIZ, archivo), "utf8")),
      );
  }

  it("no queda ningún \"consolidacion\" ni \"reserva_FCL\" entrecomillado", () => {
    const culpables = [
      ...archivosVersionadosConLiteralesViejos(),
      ...archivosNoVersionadosConLiteralesViejos(),
    ].sort();
    expect(culpables).toEqual([]);
  });
});
