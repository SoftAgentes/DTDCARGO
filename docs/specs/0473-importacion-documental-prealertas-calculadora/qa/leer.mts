/**
 * SDD-0473 · Qué entiende el lector REAL de un Excel tuyo.
 *
 * Esto NO es una maqueta: corre `extractDocument`, el mismo código que corre en
 * producción. Si acá sale bien, sale bien en la pantalla; si acá falta un dato,
 * en la pantalla va a faltar igual.
 *
 * La lectura asistida (IA) está BLOQUEADA a propósito. Si el documento cae ahí,
 * este script lo dice en vez de disimularlo: es la señal de que falta un alias
 * en el diccionario de encabezados, y eso se arregla con una línea.
 *
 * Uso, desde la raíz del worktree (QA es la carpeta de esta spec):
 *
 *   node_modules/.bin/tsx --tsconfig QA/tsconfig.leer.json QA/leer.mts "C:/ruta/archivo.xlsx"
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { computeDocumentTotals } from "../../../../lib/shared/document-import";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Falta la ruta del archivo.\n  tsx leer.ts \"C:/ruta/al/archivo.xlsx\"");
  process.exit(1);
}

/**
 * La lectura asistida queda DESARMADA por construcción: sin `ANTHROPIC_API_KEY`,
 * `extractWithAnthropic` lanza `configuration_missing` antes de llamar a nadie.
 * No hace falta parchear el módulo — basta no darle la llave, y así el camino
 * que corre es exactamente el de producción.
 *
 * Si el documento cae a IA, el error lo dice y este script lo traduce.
 */
delete process.env.ANTHROPIC_API_KEY;
delete process.env.DOCUMENT_IMPORT_MODEL;

const { extractDocument } = await import("../../../../lib/studio/document-import/extract");

const bytes = new Uint8Array(readFileSync(ruta));
const nombre = basename(ruta);
const n = (v: number | null | undefined, dec = 3) =>
  v === null || v === undefined ? "— sin declarar" : new Intl.NumberFormat("es-VE", { maximumFractionDigits: dec }).format(v);

console.log("");
console.log("ARCHIVO: " + nombre + "  (" + n(bytes.length, 0) + " bytes)");
console.log("=".repeat(72));

let draft;
try {
  draft = await extractDocument(bytes, {
    fileName: nombre,
    kind: "unknown",
    sourceId: "local",
    workspaceId: "local",
  });
} catch (error) {
  console.log("");
  console.log("NO SE PUDO LEER.");
  console.log("  Motivo: " + (error instanceof Error ? error.message : String(error)));
  const cayoAIA = error instanceof Error && /configuration_missing|lectura asistida/i.test(error.message);
  if (cayoAIA) {
    console.log("");
    console.log("  El lector determinista NO reconoció la tabla y derivó a lectura asistida.");
    console.log("  Eso casi siempre es un encabezado que falta en el diccionario de alias.");
    console.log("  Volcado de las primeras filas para ver qué encabezados trae:");
    await volcar(bytes);
  }
  process.exit(2);
}

console.log("");
console.log("SE LEYÓ SIN IA — lector determinista.");
console.log("");
console.log("PROVEEDOR");
console.log("  Empresa:   " + (draft.supplier.company || "— vacío"));
console.log("  Contacto:  " + (draft.supplier.contact || "— vacío"));
console.log("  WeChat:    " + (draft.supplier.wechat || "— vacío"));
console.log("  Moneda:    " + (draft.currency || "— sin declarar"));
console.log("  Fecha:     " + (draft.docDate || "— sin declarar"));

console.log("");
console.log("PRODUCTOS LEÍDOS: " + draft.products.length);
for (const p of draft.products) {
  const nombreP = [p.name, p.nameZh].filter(Boolean).join(" / ") || "— sin nombre";
  console.log(
    "  · " + nombreP +
    (p.code ? "  [" + p.code + "]" : "") +
    "   cant: " + n(p.quantity, 2) + " " + (p.unit || "") +
    "   precio: " + n(p.unitPrice, 4) + " " + (p.currency || ""),
  );
}

console.log("");
console.log("GRUPOS DE CAJAS: " + draft.groups.length);
for (const g of draft.groups) {
  console.log(
    "  · " + (g.label || "— sin etiqueta") +
    "   cajas: " + n(g.cartons, 0) +
    "   peso: " + n(g.grossWeightKg) + " kg" +
    "   CBM: " + n(g.cbm) + " m³" +
    "   productos asignados: " + g.items.length,
  );
}

const t = computeDocumentTotals(draft);
console.log("");
console.log("TOTALES QUE SALDRÍAN EN EL COTIZADOR");
console.log("  Cajas:  " + n(t.cartons, 0));
console.log("  Peso:   " + n(t.grossWeightKg) + " kg");
console.log("  CBM:    " + n(t.cbm) + " m³");
console.log("  Valor:  " + (Object.entries(t.amounts ?? {}).map(([m, v]) => m + " " + n(v, 2)).join("  ·  ") || "— sin declarar"));
console.log("");
console.log("  (Un «— sin declarar» NO es un error del lector: es que el documento");
console.log("   no lo dice. El cotizador pide peso y CBM para calcular.)");

if (draft.issues.length) {
  console.log("");
  console.log("LO QUE PIDE REVISIÓN: " + draft.issues.length);
  for (const i of draft.issues) console.log("  [" + i.code + "] " + i.message);
}

console.log("");

/**
 * Vuelca las filas con sus coordenadas, para ver qué encabezados trae.
 *
 * Las celdas COMBINADAS se colapsan: ExcelJS repite el mismo valor en toda la
 * extensión de la combinación, y una fila con 19 copias del mismo texto no deja
 * ver la tabla. Acá se muestra el valor UNA vez con su rango, que es lo que se
 * necesita para comparar contra el diccionario de alias.
 */
async function volcar(bytes: Uint8Array) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const letra = (col: number) => {
    let s = "";
    for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  wb.eachSheet((ws) => {
    console.log("");
    console.log("  --- hoja «" + ws.name + "» · " + ws.rowCount + " filas ---");
    let vistas = 0;
    ws.eachRow({ includeEmpty: false }, (row, numero) => {
      if (vistas >= 40) return;
      const celdas: string[] = [];
      let anterior = "", desde = 0, hasta = 0;
      const cerrar = () => {
        if (!anterior) return;
        const rango = desde === hasta ? letra(desde) : letra(desde) + "–" + letra(hasta);
        celdas.push(rango + numero + "=" + anterior.replace(/\s+/g, " ").slice(0, 30));
      };
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        let v = "";
        try { v = String(cell.text ?? "").trim(); } catch { v = ""; }
        if (!v) return;
        if (v === anterior && col === hasta + 1) { hasta = col; return; }
        cerrar();
        anterior = v; desde = col; hasta = col;
      });
      cerrar();
      if (celdas.length) { console.log("  " + celdas.join(" | ")); vistas++; }
    });
  });
}
