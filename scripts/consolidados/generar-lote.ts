/**
 * SDD-0543 · Excel del almacén de Yiwu → lote SQL de un contenedor.
 *
 * Uso (desde el checkout, con tsx):
 *   pnpm consolidados:lote -- --rastreo "<DTD RASTREO DE CONTENEDORES.xlsx>" \
 *     --packing "<NUEVO FORMATO CONTENEDOR 59.xlsx>" --contenedor 59 \
 *     --eta 2026-10-19 --salida "C:\...\DTD-consolidados\59\2026-10-16" \
 *     [--etd YYYY-MM-DD] [--fecha-carga YYYY-MM-DD] [--entorno prueba|produccion]
 *     [--crear-clientes-faltantes] [--sin-facturas] [--sin-exceso-peso] [--mapa marcas-mapa.json]
 *     [--pol NGB] [--tipo 40HC] [--tenant dtd]
 *
 * Escribe en --salida: previa.sql, aplicar.sql, simulacro.sql, verificar.sql,
 * deshacer.sql, purgar.sql, manifiesto.json, resumen.md y SHA256SUMS. Nada de
 * esto entra a Git: lleva nombres de clientes. Los Excel no se copian.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leerPacking, leerRastreo } from "./leer-excel";
import { agruparLote, ISO_FECHA, normalizarCodigo, type Lote } from "./modelo";
import { generarSql, type OpcionesSql, type SalidaSql } from "./lote-sql";

export interface Argumentos {
  rastreo: string;
  packing: string;
  contenedor: number;
  eta: string;
  salida: string;
  etd?: string;
  fechaCarga?: string;
  entorno: "prueba" | "produccion";
  crearClientesFaltantes: boolean;
  facturas: boolean;
  excesoPeso: boolean;
  mapa?: string;
  pol: string;
  polNombre: string;
  tipo: string;
  tenant: string;
}

const USO = `Uso: generar-lote --rastreo <xlsx> --packing <xlsx> --contenedor <N> --eta YYYY-MM-DD --salida <dir>
      [--etd YYYY-MM-DD] [--fecha-carga YYYY-MM-DD] [--entorno prueba|produccion]
      [--crear-clientes-faltantes] [--sin-facturas] [--sin-exceso-peso] [--mapa marcas-mapa.json] [--pol NGB] [--tipo 40HC] [--tenant dtd]`;

export function parsearArgumentos(argv: string[]): Argumentos {
  const valores = new Map<string, string>();
  const banderas = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`Argumento inesperado: ${a}\n${USO}`);
    const k = a.slice(2);
    if (["crear-clientes-faltantes", "sin-facturas", "sin-exceso-peso"].includes(k)) {
      banderas.add(k);
      continue;
    }
    const v = argv[i + 1];
    if (v == null || v.startsWith("--")) throw new Error(`Falta el valor de --${k}\n${USO}`);
    valores.set(k, v);
    i++;
  }
  const req = (k: string) => {
    const v = valores.get(k);
    if (!v) throw new Error(`Falta --${k}\n${USO}`);
    return v;
  };
  const contenedor = Number(req("contenedor"));
  if (!Number.isInteger(contenedor) || contenedor <= 0) throw new Error("--contenedor debe ser un entero positivo");
  const eta = req("eta");
  if (!ISO_FECHA.test(eta)) throw new Error("--eta debe ser YYYY-MM-DD");
  const entorno = valores.get("entorno") ?? "prueba";
  if (entorno !== "prueba" && entorno !== "produccion") throw new Error("--entorno debe ser prueba o produccion");
  const crear = banderas.has("crear-clientes-faltantes");
  if (crear && entorno !== "prueba") throw new Error("--crear-clientes-faltantes sólo se permite con --entorno prueba");
  for (const k of ["etd", "fecha-carga"]) {
    const v = valores.get(k);
    if (v && !ISO_FECHA.test(v)) throw new Error(`--${k} debe ser YYYY-MM-DD`);
  }
  const pol = normalizarCodigo(valores.get("pol") ?? "NGB");
  return {
    rastreo: req("rastreo"),
    packing: req("packing"),
    contenedor,
    eta,
    salida: req("salida"),
    etd: valores.get("etd"),
    fechaCarga: valores.get("fecha-carga"),
    entorno,
    crearClientesFaltantes: crear,
    facturas: !banderas.has("sin-facturas"),
    excesoPeso: !banderas.has("sin-exceso-peso"),
    mapa: valores.get("mapa"),
    pol,
    polNombre: pol === "NGB" ? "Ningbo" : pol,
    tipo: normalizarCodigo(valores.get("tipo") ?? "40HC"),
    tenant: valores.get("tenant") ?? "dtd",
  };
}

export function sha256(ruta: string): string {
  return createHash("sha256").update(readFileSync(ruta)).digest("hex");
}

export function leerMapa(ruta: string | undefined): Record<string, string> {
  if (!ruta) return {};
  const crudo = JSON.parse(readFileSync(ruta, "utf8")) as unknown;
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) throw new Error("marcas-mapa.json debe ser un objeto { \"MARCA\": \"DTD-NNNN\" }");
  const mapa: Record<string, string> = {};
  for (const [k, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (typeof v !== "string" || !v.trim()) throw new Error(`marcas-mapa.json: el valor de ${k} debe ser un texto`);
    mapa[normalizarCodigo(k)] = normalizarCodigo(v);
  }
  return mapa;
}

export function resumenMarkdown(lote: Lote, salida: SalidaSql, avisosExcel: string[]): string {
  const m = salida.manifiesto;
  const filas = lote.clientes
    .map((c, i) => {
      const etiqueta = salida.manifiesto.clientes[i]?.etiqueta ?? c.clave;
      return `| ${c.clave} | ${etiqueta === c.clave ? "—" : etiqueta} | ${c.marca.nombreExcel || "—"} | ${c.embarques.map((e) => e.remitente).join(", ")} | ${c.cajas} | ${c.cbmFactura} | ${c.pesoKg} | $${c.base.toFixed(2)} | ${c.marca.candidatos.join(" / ")} |`;
    })
    .join("\n");
  const avisos = [...avisosExcel, ...lote.avisos];
  return `# Lote ${m.lote} · contenedor DTD #${m.contenedor.numero} (${m.contenedor.container_no})

- Entorno: **${m.entorno}** · facturas: ${m.opciones.facturas ? "sí (borrador, una por cliente)" : "no"} · exceso de peso: ${m.opciones.excesoPeso ? "se cobra en líneas aparte" : "NO se cobra"} · crear clientes faltantes: ${m.opciones.crearClientesFaltantes ? "sí (sólo prueba)" : "no"}
- Naviera ${m.contenedor.naviera} · ${m.contenedor.pol} → ${m.contenedor.pod} · carga ${m.contenedor.fechaCarga} · recepciones ${m.contenedor.fechaRecepcion} · ETD ${m.contenedor.etd} · ETA ${m.contenedor.eta} · ${m.opciones.containerType}
- Fuentes: rastreo sha256 ${m.fuentes.rastreo.slice(0, 12)}… · packing sha256 ${m.fuentes.packing.slice(0, 12)}…
- Generado ${m.generadoEn}

## Lo que escribe aplicar.sql

| Entidad | Cantidad |
|---|---|
| Envíos (uno por remitente, en tránsito) | ${m.esperado.envios} |
| Recepciones en China (${m.contenedor.fechaRecepcion}, consolidadas) | ${m.esperado.recepciones} |
| Items de recepción (filas del Excel) | ${m.esperado.items} |
| Cajas (las crea el trigger) | ${m.esperado.cajas} |
| Clientes distintos | ${m.esperado.clientes} |
| Facturas en borrador | ${m.esperado.facturas} |
| Σ CBM a factura | ${m.esperado.cbm} |
| Σ kg | ${m.esperado.kg} |
| Σ base facturada | $${m.esperado.base.toFixed(2)} (flete Excel: $${lote.totales.totalFacturadoExcel.toFixed(2)} · excesos de peso: $${lote.totales.excesoPeso.toFixed(2)}) |

## Clientes y embarques

| Marca | Etiqueta en la evidencia | Nombre (Excel) | Embarques | Cajas | CBM | kg | Base | Candidatos a resolver |
|---|---|---|---|---|---|---|---|---|
${filas}

Las marcas sin número (texto del Excel) salen en la evidencia del servidor como etiqueta \`PREFIJO-#n\`; esta tabla es la que las cruza.

## Avisos

${avisos.length ? avisos.map((a) => `- ${a}`).join("\n") : "- Ninguno."}

## Cómo se aplica (prueba)

1. \`previa.sql\` (sólo lee): revisar que \`sin_resolver\` sea 0 y los conflictos 0. Si hay marcas sin resolver, mapearlas en \`marcas-mapa.json\` y volver a generar, o usar \`--crear-clientes-faltantes\` (sólo prueba).
2. \`simulacro.sql\`: corre todo y deshace; tiene que terminar con el \`raise notice\` del lote y \`ROLLBACK\`.
3. \`aplicar.sql\`: la carga real, una transacción.
4. \`verificar.sql\`: PASÓ con los mismos conteos de arriba.
5. \`deshacer.sql\` para volver atrás (borrado lógico; se niega si alguna factura dejó de ser borrador).
6. \`purgar.sql\` para el borrado definitivo en prueba (físico, incluidos los clientes y aliados que creó el lote; se niega fuera de la base de prueba y termina con conteo cero).
`;
}

export async function generar(args: Argumentos): Promise<{ lote: Lote; salida: SalidaSql; archivos: string[] }> {
  for (const ruta of [args.rastreo, args.packing]) {
    if (!existsSync(ruta)) throw new Error(`No existe el archivo ${ruta}`);
  }
  const rastreo = await leerRastreo(args.rastreo, args.contenedor);
  const packing = await leerPacking(args.packing);
  const avisosExcel = [...packing.avisos];
  if (packing.numeroTitulo != null && packing.numeroTitulo !== args.contenedor) {
    throw new Error(`El packing list dice contenedor #${packing.numeroTitulo} y pediste el #${args.contenedor}`);
  }
  const mapa = leerMapa(args.mapa);
  const lote = agruparLote(rastreo, packing.filas, { eta: args.eta, etd: args.etd, fechaCarga: args.fechaCarga, mapa, excesoPeso: args.excesoPeso });
  const fuentes = { rastreo: sha256(args.rastreo), packing: sha256(args.packing) };
  const opciones: OpcionesSql = {
    entorno: args.entorno,
    crearClientesFaltantes: args.crearClientesFaltantes,
    facturas: args.facturas,
    pol: args.pol,
    polNombre: args.polNombre,
    containerType: args.tipo,
    vessel: "Por confirmar",
    lote: `carga-consolidado:${args.contenedor}:${fuentes.packing.slice(0, 8)}`,
    tenantSlug: args.tenant,
  };
  const salida = generarSql(lote, opciones, fuentes);

  mkdirSync(args.salida, { recursive: true });
  const archivos: Record<string, string> = {
    "previa.sql": salida.previa,
    "simulacro.sql": salida.simulacro,
    "aplicar.sql": salida.aplicar,
    "verificar.sql": salida.verificar,
    "deshacer.sql": salida.deshacer,
    "purgar.sql": salida.purgar,
    "manifiesto.json": JSON.stringify(salida.manifiesto, null, 2) + "\n",
    "resumen.md": resumenMarkdown(lote, salida, avisosExcel),
  };
  const sumas: string[] = [];
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const ruta = path.join(args.salida, nombre);
    writeFileSync(ruta, contenido, { encoding: "utf8" });
    sumas.push(`${createHash("sha256").update(contenido).digest("hex")}  ${nombre}`);
  }
  writeFileSync(path.join(args.salida, "SHA256SUMS"), sumas.join("\n") + "\n", { encoding: "utf8" });
  return { lote, salida, archivos: [...Object.keys(archivos), "SHA256SUMS"] };
}

async function main(): Promise<void> {
  const args = parsearArgumentos(process.argv.slice(2));
  const { lote, salida, archivos } = await generar(args);
  const m = salida.manifiesto;
  console.log(`Lote ${m.lote} · contenedor DTD #${m.contenedor.numero} (${m.contenedor.container_no}) · ${m.entorno}`);
  console.log(`  ${m.esperado.envios} envíos · ${m.esperado.recepciones} recepciones · ${m.esperado.items} items · ${m.esperado.cajas} cajas · ${m.esperado.clientes} clientes · ${m.esperado.facturas} facturas`);
  console.log(`  ${m.esperado.cbm} m³ · ${m.esperado.kg} kg · base $${m.esperado.base.toFixed(2)} (Excel $${lote.totales.totalFacturadoExcel.toFixed(2)})`);
  console.log(`  avisos: ${lote.avisos.length} · archivos en ${args.salida}: ${archivos.join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
}
