// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "avance-checklist.mjs");
const CHECKLIST_REAL = join(REPO_ROOT, "docs", "specs", "0582-chatwoot-piloto", "checklist.md");
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function run(path, ...flags) {
  return spawnSync(process.execPath, [SCRIPT, path, ...flags], { encoding: "utf8" });
}

function fixture(texto) {
  const root = mkdtempSync(join(tmpdir(), "dtd-avance-checklist-"));
  roots.push(root);
  const path = join(root, "checklist.md");
  writeFileSync(path, texto, "utf8");
  return path;
}

const ENCABEZADO = [
  "| ID | Etapa | Paso | Resp. | Días base | Días reales | Días restantes | Estado | Puerta / espera | Evidencia |",
  "|---|---|---|---|---|---|---|---|---|---|",
];

function checklist({ cabecera = "Línea base: v1 · 2026-10-28 · alcance 10 persona-días", filas }) {
  return [
    "# Checklist de prueba",
    "",
    cabecera,
    "",
    "| Etapa | Nombre |",
    "|---|---|",
    "| E0 | Preparación |",
    "| E1 | Instalación |",
    "",
    ...ENCABEZADO,
    ...filas,
    "",
  ].join("\n");
}

// Disposición infeliz: un aceptado con días reales, un entregado con días reales que NO deben
// sumar al %, una espera, un bloqueo y un pendiente en la etapa siguiente.
const FILAS_MIXTAS = [
  "| 0.1 | E0 | Aceptado | IA | 2 | 3 | 0 | aceptado | — | PR #1 |",
  "| 0.2 | E0 | Entregado | IA | 1 | 1 | 0 | entregado | PR → OK | PR #2 |",
  "| 0.3 | E0 | Espera | S | 1 | — | — | espera externa | Espera: Meta | — |",
  "| 1.1 | E1 | Bloqueado | IA | 4 | — | — | bloqueado | OK Sam | — |",
  "| 1.2 | E1 | Pendiente | IA | 2 | — | — | pendiente | — | — |",
];

describe("avance-checklist", () => {
  // El checklist real cambia cada vez que Sam acepta un paso: aquí solo se fijan invariantes de
  // la línea base, y el % se recalcula en la prueba con un lector propio de las filas.
  it("el checklist real del programa es válido y su % sale solo de los aceptados", () => {
    const r = run(CHECKLIST_REAL, "--json");
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.lineaBase).toEqual({ version: "v1", fecha: "2026-10-28", alcance: 99.75 });
    expect(out.etapas.map((e) => e.base)).toEqual([5, 4.75, 17.75, 5, 8, 7.75, 16, 16.5, 10, 9]);
    const pesos = out.etapas.map((e) => (e.base / out.lineaBase.alcance) * 100);
    expect(pesos.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);

    const filas = readFileSync(CHECKLIST_REAL, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^\| \d+\.\d+ \|/.test(l))
      .map((l) => l.split("|").map((c) => c.trim()))
      .map((c) => ({ base: Number(c[5].replace(",", ".")), estado: c[8] }));
    const sumar = (xs) => xs.reduce((a, f) => a + f.base, 0);
    expect(sumar(filas)).toBeCloseTo(99.75, 10);
    const aceptado = sumar(filas.filter((f) => f.estado === "aceptado"));
    const esperado = Math.round((aceptado / 99.75) * 100 * 100) / 100;
    expect(out.aceptado).toBeCloseTo(aceptado, 10);
    expect(out.avance).toBe(esperado);
    expect(out.falta).toBeCloseTo(100 - esperado, 10);
    expect(out.avance).toBeGreaterThanOrEqual(0);
    expect(out.avance).toBeLessThanOrEqual(100);
  });

  it("solo los aceptados suman al %; entregado y días reales son esfuerzo aparte", () => {
    const r = run(fixture(checklist({ filas: FILAS_MIXTAS })), "--json");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.avance).toBe(20);
    expect(out.falta).toBe(80);
    expect(out.aceptado).toBe(2);
    expect(out.real).toBe(4);
    expect(out.restante).toBe(7);
    expect(out.ritmo).toBe(0.67);
    expect(out.entregados).toEqual(["0.2"]);
    expect(out.esperas).toEqual(["0.3"]);
    expect(out.bloqueados).toEqual(["1.1"]);
    expect(out.etapaActual).toMatchObject({ numero: 1, total: 2, id: "E0" });
    expect(out.pasoActual).toBe("0.2");
  });

  it("imprime el reporte en el formato acordado", () => {
    const r = run(fixture(checklist({ filas: FILAS_MIXTAS })));
    expect(r.status).toBe(0);
    expect(r.stdout.split("\n")[0]).toBe(
      "Etapa 1 de 2 · E0 Preparación · paso 0.2 · Avance 20,0 % (falta 80,0 %) · Esfuerzo: real 4 d, restante 7 d",
    );
    expect(r.stdout).toContain("Esperando: 0.3");
    expect(r.stdout).toContain("Bloqueados: 1.1");
  });

  it("una línea base v2 con un paso descartado muestra el % antes y después", () => {
    const filas = FILAS_MIXTAS.map((f) => (f.startsWith("| 1.2 ") ? f.replace("| pendiente |", "| descartado |") : f));
    const texto = checklist({
      cabecera: "Línea base: v2 · 2026-11-15 · alcance 8 persona-días\nLínea base anterior: v1 · alcance 10",
      filas,
    });
    const r = run(fixture(texto), "--json");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.avanceAntes).toBe(20);
    expect(out.avance).toBe(25);
    expect(out.restante).toBe(5);
    expect(run(fixture(texto)).stdout).toContain("avance antes 20,0 % → ahora 25,0 %");
  });

  it("descartar sin línea base nueva es un error", () => {
    const filas = FILAS_MIXTAS.map((f) => (f.startsWith("| 1.2 ") ? f.replace("| pendiente |", "| descartado |") : f));
    const r = run(fixture(checklist({ cabecera: "Línea base: v1 · 2026-10-28 · alcance 8 persona-días", filas })));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("sin 'Línea base anterior'");
  });

  it("control rojo: tocar un peso sin cambiar el alcance invalida el checklist", () => {
    const filas = FILAS_MIXTAS.map((f) => f.replace("| Aceptado | IA | 2 |", "| Aceptado | IA | 3 |"));
    const r = run(fixture(checklist({ filas })));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no coincide con la suma de días base");
  });

  it.each([
    ["estado desconocido", FILAS_MIXTAS.map((f) => f.replace("| pendiente |", "| hecho |")), "estado inválido 'hecho'"],
    ["etapa desconocida", [...FILAS_MIXTAS.slice(0, 4), "| 1.2 | E7 | X | IA | 2 | — | — | pendiente | — | — |"], "etapa desconocida 'E7'"],
    ["ID repetido", [...FILAS_MIXTAS.slice(0, 4), "| 1.1 | E1 | X | IA | 2 | — | — | pendiente | — | — |"], "ID de paso repetido: 1.1"],
    ["días base vacíos", [...FILAS_MIXTAS.slice(0, 4), "| 1.2 | E1 | X | IA | — | — | — | pendiente | — | — |"], "'Días base' es obligatorio"],
    ["columnas de menos", [...FILAS_MIXTAS.slice(0, 4), "| 1.2 | E1 | X | IA | 2 | pendiente |"], "fila con 6 columnas"],
  ])("tabla mal formada (%s) da un error claro", (_, filas, mensaje) => {
    const r = run(fixture(checklist({ filas })));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(mensaje);
  });

  it("sin línea base el error lo dice", () => {
    const r = run(fixture(checklist({ cabecera: "Sin cabecera", filas: FILAS_MIXTAS })));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("falta la línea 'Línea base:");
  });
});
