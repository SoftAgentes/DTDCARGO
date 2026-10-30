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

// Línea base v3 del checklist real (2026-10-29): ID=días base de cada paso, en orden.
const LINEA_BASE = [
  "0.1=1.25 0.2=0.25 0.3=0.75 0.4=1 0.5=0.25 0.6=1 0.7=0.5 0.8=0.5",
  "1.1=1 1.2=0.5 1.3=0.25 1.4=0.5 1.5=0.75 1.6=0.25 1.7=1.5",
  "2.1=1 2.2=5.5 2.3=5 2.4=2.25 2.5=1.25 2.6=2.25 2.7=2.5 2.8=1",
  "3.1=1 3.2=1 3.3=1.5 3.4=1.5",
  "4.1=0.5 4.2=0.75 4.3=1 4.4=1 4.5=1.25 4.6=1 4.7=0.75 4.8=1.75 4.9=1.75",
  "5.1=0.5 5.2=0.5 5.3=1.5 5.4=1.5 5.5=1.75 5.6=1 5.7=0.5 5.8=0.5",
  "6.1=2 6.2=2 6.3=5 6.4=2 6.5=1.5 6.6=2.5 6.7=2.25",
  "7.1=1 7.2=0.5 7.3=0.5 7.4=1.5 7.5=2 7.6=6.25 7.7=1.75 7.8=1.5 7.9=1.5 7.10=1 7.11=1",
  "8.1=1 8.2=0.5 8.3=0.25 8.4=0.5 8.5=0.5 8.6=0.75 8.7=0.75 8.8=0.25 8.9=0.75 8.10=3.5 8.11=0.5 8.12=0.25 8.13=0.5",
  "9.1=1 9.2=2 9.3=1.5 9.4=2 9.5=1.5 9.6=1",
  "10.1=1.5 10.2=2 10.3=0.5 10.4=1 10.5=1.25 10.6=1",
].join(" ");

describe("avance-checklist", () => {
  // El checklist real cambia cada vez que Sam acepta un paso: aquí solo se fijan invariantes de
  // la línea base, y el % se recalcula en la prueba con un lector propio de las filas.
  it("el checklist real del programa es válido y su % sale solo de los aceptados", () => {
    const r = run(CHECKLIST_REAL, "--json");
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    const ALCANCE = 115.5;
    const ALCANCE_ANTERIOR = 109.25;
    expect(out.lineaBase).toEqual({ version: "v3", fecha: "2026-10-29", alcance: ALCANCE });
    expect(out.anterior).toEqual({ version: "v2", alcance: ALCANCE_ANTERIOR });
    const DIAS_ETAPA = [5.5, 4.75, 20.75, 5, 9.75, 7.75, 17.25, 18.5, 10, 9, 7.25];
    expect(out.etapas.map((e) => e.id)).toEqual(DIAS_ETAPA.map((_, i) => `E${i}`));
    expect(out.etapas.map((e) => e.base)).toEqual(DIAS_ETAPA);
    const pesos = out.etapas.map((e) => (e.base / out.lineaBase.alcance) * 100);
    expect(pesos.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);

    const lineas = readFileSync(CHECKLIST_REAL, "utf8").split(/\r?\n/);
    const filas = lineas
      .filter((l) => /^\| \d+\.\d+ \|/.test(l))
      .map((l) => l.split("|").map((c) => c.trim()))
      .map((c) => ({ id: c[1], etapa: c[2], base: Number(c[5].replace(",", ".")), estado: c[8] }))
      .filter((f) => f.estado !== "descartado");
    const sumar = (xs) => xs.reduce((a, f) => a + f.base, 0);
    expect(sumar(filas)).toBeCloseTo(ALCANCE, 10);
    // Los días base de cada paso son parte de la línea base: moverlos dentro de una etapa no cambia
    // los totales, así que se fija la firma completa. Cambiarla exige una línea base nueva.
    expect(filas.map((f) => `${f.id}=${f.base}`).join(" ")).toBe(LINEA_BASE);
    const aceptado = sumar(filas.filter((f) => f.estado === "aceptado"));
    const pctDe = (alcance) => Math.round((aceptado / alcance) * 100 * 100) / 100;
    expect(out.aceptado).toBeCloseTo(aceptado, 10);
    expect(out.avance).toBe(pctDe(ALCANCE));
    expect(out.avanceAntes).toBe(pctDe(ALCANCE_ANTERIOR));
    expect(out.falta).toBeCloseTo(100 - pctDe(ALCANCE), 10);
    expect(out.avance).toBeGreaterThanOrEqual(0);
    expect(out.avance).toBeLessThanOrEqual(100);

    // Tabla de etapas: sus días cuadran con las filas y sus pesos son el resto mayor en décimas.
    const tabla = lineas
      .filter((l) => /^\| E\d+ \|/.test(l))
      .map((l) => l.split("|").map((c) => c.trim()))
      .map((c) => ({ id: c[1], dias: Number(c[3].replace(",", ".")), peso: c[4] }));
    expect(tabla.map((e) => e.id)).toEqual(out.etapas.map((e) => e.id));
    for (const e of tabla) expect(e.dias).toBeCloseTo(sumar(filas.filter((f) => f.etapa === e.id)), 10);
    const exactos = DIAS_ETAPA.map((d) => (d / ALCANCE) * 1000);
    const decimas = exactos.map(Math.floor);
    const orden = exactos.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of orden.slice(0, 1000 - decimas.reduce((a, b) => a + b, 0))) decimas[i] += 1;
    expect(decimas.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(tabla.map((e) => e.peso)).toEqual(decimas.map((d) => `${(d / 10).toFixed(1).replace(".", ",")} %`));
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
