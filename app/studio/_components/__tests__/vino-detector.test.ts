import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cuentaVino } from "./vino-detector";

describe("detector de clases de vino", () => {
  it("conserva clases, variantes encadenadas y selectores arbitrarios", () => {
    for (const clase of ["bg-wine", "hover:focus-within:border-wine-deep", "group-[[open]]:text-wine", "[&>svg]:text-wine", "hover:[&>svg]:fill-wine", "[&[data-open]]:group-[[open]]:hover:text-wine"]) {
      expect(cuentaVino(`className="${clase}"`), clase).toBe(1);
    }
    expect(cuentaVino('className="bg-winery text-wine-500"')).toBe(0);
  });

  it("respeta corchetes escapados y barras escapadas por pares", () => {
    const variantes = [
      String.raw`[&.\[]:`,
      String.raw`[&.\]]:`,
      String.raw`[&.\\[data-open]]:`,
      String.raw`[&.\\]:`,
      String.raw`[&.\\\[]:`,
      String.raw`group-[[data-open]]:[&.\]]:hover:`,
    ];
    for (const variante of variantes) {
      expect(cuentaVino(`${variante}text-wine`), variante).toBe(1);
      expect(cuentaVino(`${variante}text-accion`), variante).toBe(0);
    }
  });

  it("descarta una variante larga sin dos puntos y sigue contando la clase siguiente", () => {
    expect(cuentaVino(`className="${"a".repeat(20000)} bg-wine"`)).toBe(1);
  });
  it("descarta variantes arbitrarias repetidas sin retroceso combinatorio", () => {
    // Proceso aislado: un regreso al patrón ambiguo termina por timeout,
    // sin dejar bloqueado el runner ni ocupar la PC indefinidamente.
    const resultado = spawnSync(process.execPath, ["-e", `
      require("tsx/cjs");
      const { cuentaVino } = require(process.argv[1]);
      const variantes = "[&>svg]:".repeat(64);
      if (cuentaVino(variantes + "text-accion") !== 0) process.exit(1);
      if (cuentaVino(variantes + "text-wine") !== 1) process.exit(2);
    `, join(__dirname, "vino-detector.ts")], { timeout: 5000, encoding: "utf8" });
    expect(resultado.error).toBeUndefined();
    expect(resultado.status, resultado.stderr).toBe(0);
  });
});
