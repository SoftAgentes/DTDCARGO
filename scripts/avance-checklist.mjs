#!/usr/bin/env node
/**
 * avance-checklist — calcula el avance de un checklist de programa (SDD-0582).
 *
 *   node scripts/avance-checklist.mjs <checklist.md>          → reporte en texto
 *   node scripts/avance-checklist.mjs <checklist.md> --json   → el mismo cálculo en JSON
 *
 * Regla (spec 0582, «Metodología de avance»): solo suman los pasos `aceptado`, con sus días
 * base, sobre el alcance de la línea base. Días reales y restantes son esfuerzo: se informan
 * aparte y no mueven el %. El alcance declarado tiene que coincidir con la suma de días base
 * de los pasos no descartados; si no, el checklist es inválido (un peso tocado a mano se nota).
 */
import { readFileSync } from "node:fs";

const ESTADOS = ["pendiente", "en curso", "entregado", "aceptado", "bloqueado", "espera externa", "descartado"];
const CERRADOS = new Set(["aceptado", "descartado"]);
const COLUMNAS_PASOS = [
  "ID", "Etapa", "Paso", "Resp.", "Días base", "Días reales", "Días restantes", "Estado", "Puerta / espera", "Evidencia",
];

class ChecklistError extends Error {}

const redondear = (n) => Math.round(n * 100) / 100;
const suma = (xs) => redondear(xs.reduce((a, b) => a + b, 0));

function numero(texto, campo, id) {
  const t = texto.trim();
  if (t === "" || t === "—" || t === "-") return null;
  const v = Number(t.replace(",", "."));
  if (!Number.isFinite(v) || v < 0) throw new ChecklistError(`paso ${id}: '${campo}' no es un número válido ('${t}')`);
  return v;
}

function celdas(linea) {
  const t = linea.trim();
  return t.slice(1, t.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
}

function tablas(lineas) {
  const out = [];
  let actual = null;
  for (const linea of lineas) {
    if (linea.trim().startsWith("|")) {
      if (!actual) out.push((actual = []));
      actual.push(celdas(linea));
    } else {
      actual = null;
    }
  }
  // Fila 0 = encabezado, fila 1 = separador |---|.
  return out.map((filas) => ({ encabezado: filas[0], filas: filas.slice(2) }));
}

function leerChecklist(texto) {
  const lineas = texto.split(/\r?\n/);
  const base = texto.match(/^Línea base:\s*(v\d+)\s*·\s*(\S+)\s*·\s*alcance\s*([\d.,]+)/m);
  if (!base) throw new ChecklistError("falta la línea 'Línea base: vN · AAAA-MM-DD · alcance X persona-días'");
  const anterior = texto.match(/^Línea base anterior:\s*(v\d+)\s*·\s*alcance\s*([\d.,]+)/m);

  const ts = tablas(lineas);
  const tEtapas = ts.find((t) => t.encabezado[0] === "Etapa" && t.encabezado[1] === "Nombre");
  const tPasos = ts.find((t) => t.encabezado[0] === "ID");
  if (!tEtapas) throw new ChecklistError("falta la tabla de etapas (| Etapa | Nombre |)");
  if (!tPasos) throw new ChecklistError("falta la tabla de pasos (| ID | Etapa | … |)");
  if (tPasos.encabezado.join("|") !== COLUMNAS_PASOS.join("|")) {
    throw new ChecklistError(`columnas de pasos inesperadas; se esperaban: ${COLUMNAS_PASOS.join(" | ")}`);
  }

  const etapas = tEtapas.filas.map(([id, nombre]) => ({ id, nombre }));
  const idsEtapa = new Set(etapas.map((e) => e.id));
  const vistos = new Set();
  const pasos = tPasos.filas.map((c) => {
    if (c.length !== COLUMNAS_PASOS.length) {
      throw new ChecklistError(`fila con ${c.length} columnas (se esperaban ${COLUMNAS_PASOS.length}): ${c[0] ?? "?"}`);
    }
    const [id, etapa, paso, , diasBase, diasReales, diasRestantes, estado] = c;
    if (!/^\d+\.\d+$/.test(id)) throw new ChecklistError(`ID de paso inválido: '${id}'`);
    if (vistos.has(id)) throw new ChecklistError(`ID de paso repetido: ${id}`);
    vistos.add(id);
    if (!idsEtapa.has(etapa)) throw new ChecklistError(`paso ${id}: etapa desconocida '${etapa}'`);
    if (!ESTADOS.includes(estado)) {
      throw new ChecklistError(`paso ${id}: estado inválido '${estado}' (válidos: ${ESTADOS.join(", ")})`);
    }
    const base = numero(diasBase, "Días base", id);
    if (base === null || base === 0) throw new ChecklistError(`paso ${id}: 'Días base' es obligatorio y mayor que 0`);
    return {
      id,
      etapa,
      paso,
      base,
      reales: numero(diasReales, "Días reales", id),
      restantes: numero(diasRestantes, "Días restantes", id),
      estado,
    };
  });

  return {
    lineaBase: { version: base[1], fecha: base[2], alcance: Number(base[3].replace(",", ".")) },
    anterior: anterior ? { version: anterior[1], alcance: Number(anterior[2].replace(",", ".")) } : null,
    etapas,
    pasos,
  };
}

function calcularAvance(checklist) {
  const { lineaBase, anterior, etapas, pasos } = checklist;
  const vigentes = pasos.filter((p) => p.estado !== "descartado");
  const sumaBase = suma(vigentes.map((p) => p.base));
  if (sumaBase !== redondear(lineaBase.alcance)) {
    throw new ChecklistError(
      `el alcance declarado (${lineaBase.alcance}) no coincide con la suma de días base de los pasos vigentes (${sumaBase})`,
    );
  }
  if (pasos.some((p) => p.estado === "descartado") && !anterior) {
    throw new ChecklistError("hay pasos descartados sin 'Línea base anterior': un cambio de alcance exige línea base nueva");
  }

  const aceptados = vigentes.filter((p) => p.estado === "aceptado");
  const aceptado = suma(aceptados.map((p) => p.base));
  const avance = redondear((aceptado / lineaBase.alcance) * 100);
  const abiertos = vigentes.filter((p) => !CERRADOS.has(p.estado));
  const restante = suma(abiertos.map((p) => p.restantes ?? p.base));
  const real = suma(pasos.map((p) => p.reales ?? 0));

  const conReal = aceptados.filter((p) => p.reales !== null && p.reales > 0);
  const ritmo = conReal.length
    ? redondear(suma(conReal.map((p) => p.base)) / suma(conReal.map((p) => p.reales)))
    : null;

  const idxActual = etapas.findIndex((e) => abiertos.some((p) => p.etapa === e.id));
  const etapaActual = idxActual === -1 ? null : etapas[idxActual];
  const pasoActual = etapaActual ? abiertos.find((p) => p.etapa === etapaActual.id).id : null;

  return {
    lineaBase,
    anterior,
    avance,
    falta: redondear(100 - avance),
    avanceAntes: anterior ? redondear((aceptado / anterior.alcance) * 100) : null,
    aceptado,
    real,
    restante,
    ritmo,
    diasEstimados: ritmo ? redondear(restante / ritmo) : null,
    etapaActual: etapaActual
      ? { numero: idxActual + 1, total: etapas.length, id: etapaActual.id, nombre: etapaActual.nombre }
      : null,
    pasoActual,
    entregados: vigentes.filter((p) => p.estado === "entregado").map((p) => p.id),
    esperas: vigentes.filter((p) => p.estado === "espera externa").map((p) => p.id),
    bloqueados: vigentes.filter((p) => p.estado === "bloqueado").map((p) => p.id),
    etapas: etapas.map((e) => {
      const deEtapa = vigentes.filter((p) => p.etapa === e.id);
      return {
        id: e.id,
        nombre: e.nombre,
        base: suma(deEtapa.map((p) => p.base)),
        aceptado: suma(deEtapa.filter((p) => p.estado === "aceptado").map((p) => p.base)),
      };
    }),
  };
}

const pct = (n) => `${n.toFixed(1).replace(".", ",")} %`;
const dias = (n) => String(redondear(n)).replace(".", ",");
const lista = (xs) => (xs.length ? xs.join(", ") : "ninguno");

function formatear(r) {
  const cabeza = r.etapaActual
    ? `Etapa ${r.etapaActual.numero} de ${r.etapaActual.total} · ${r.etapaActual.id} ${r.etapaActual.nombre} · paso ${r.pasoActual}`
    : "Programa completo";
  const out = [
    `${cabeza} · Avance ${pct(r.avance)} (falta ${pct(r.falta)}) · Esfuerzo: real ${dias(r.real)} d, restante ${dias(r.restante)} d`,
    `Línea base ${r.lineaBase.version} (${r.lineaBase.fecha}) · alcance ${dias(r.lineaBase.alcance)} d · aceptado ${dias(r.aceptado)} d`,
  ];
  if (r.anterior) {
    out.push(
      `Cambio de alcance: ${r.anterior.version} ${dias(r.anterior.alcance)} d → ${r.lineaBase.version} ${dias(r.lineaBase.alcance)} d · avance antes ${pct(r.avanceAntes)} → ahora ${pct(r.avance)}`,
    );
  }
  out.push(
    r.ritmo
      ? `Ritmo real: ${dias(r.ritmo)} d base por día real · faltan ≈ ${dias(r.diasEstimados)} días de trabajo`
      : "Ritmo real: sin pasos aceptados con días reales todavía",
    `Entregados sin aceptar: ${lista(r.entregados)}`,
    `Esperando: ${lista(r.esperas)}`,
    `Bloqueados: ${lista(r.bloqueados)}`,
    "Por etapa:",
    ...r.etapas.map((e) => `  ${e.id} ${e.nombre}: ${dias(e.aceptado)} de ${dias(e.base)} d (${pct(e.base ? (e.aceptado / e.base) * 100 : 0)})`),
  );
  return out.join("\n");
}

function main(argv) {
  const args = argv.slice(2);
  const ruta = args.find((a) => !a.startsWith("--"));
  if (!ruta) {
    console.error("uso: node scripts/avance-checklist.mjs <checklist.md> [--json]");
    return 2;
  }
  try {
    const r = calcularAvance(leerChecklist(readFileSync(ruta, "utf8")));
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : formatear(r));
    return 0;
  } catch (e) {
    if (e instanceof ChecklistError || e.code === "ENOENT") {
      console.error(`avance-checklist: checklist inválido: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

process.exitCode = main(process.argv);
