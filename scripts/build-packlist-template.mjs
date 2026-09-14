#!/usr/bin/env node
/**
 * SDD-0096 · Genera el template Excel BRANDED del packing list + factura del
 * proveedor → public/templates/dtd-packing-list-invoice.xlsx.
 *
 * Reemplaza el .xlsx off-brand por uno con la marca DTD Cargo (wine #7F0F1A /
 * navy #0F1E3D / cream #FBFAF7), formato idéntico al prototipo del Norte
 * (docs/design/studio/_norte/packlist/*.html): header DTD Cargo, título bilingüe
 * 装箱单+商业发票 / Packing List + Factura, grilla de proveedor, tabla de mercancía
 * bilingüe, fila de totales, notas, firmas, celda de moneda.
 * pageSetup → 1 página A4 horizontal.
 *
 * SDD-0468 · Reformulado para que un proveedor chino lo entienda sin ayuda:
 *  - Las columnas con fondo de color (Total uds, Total, Peso, CBM) se calculan
 *    SOLAS por fila (antes eran celdas vacías que había que multiplicar a mano),
 *    con la misma regla del formulario web (packlist-form · computeTotals):
 *    qty = cajas×uds/caja, total = qty×precio, peso = cajas×kg/caja,
 *    CBM = cajas×CBM/caja. Una línea arriba de la tabla lo dice en chino.
 *  - Notas: de 7 a 5, chino primero, una regla por línea. Se quitaron las que
 *    repetían el propio documento («llena este documento», «formulario o Excel»).
 *  - Sin la tarjeta «Shipping Mark» con `DTD-____`: duplicaba el 唛头 que ya viene
 *    pre-llenado en C6 y los guiones invitaban a escribir encima.
 *  - Encabezado sin el eslogan comercial: solo dirección del almacén.
 *
 * Las 5 celdas que pre-llena el GET (lib/studio/prealertas/packlist.ts ·
 * fillPacklist) viven en posiciones FIJAS y conocidas — este rediseño NO las mueve:
 *   C5  = 公司名称 (Proveedor)  → nombre del proveedor
 *   C6  = 唛头 (Shipping Mark)  → MARKBOX del cliente
 *   C7  = 订单 (Compra)         → código de la compra
 *   C8  = 微信 (WeChat)         → WeChat del proveedor
 *   I3  = N.º / 编号 (Folio)    → código de la compra
 * Se siembran con un placeholder (espacio) para que la celda EXISTA en el XML y el
 * regex de setInlineCell la encuentre. Si cambias el layout, actualiza el mapa de
 * fillPacklist (y su test).
 *
 * Uso:  node scripts/build-packlist-template.mjs
 */
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "templates", "dtd-packing-list-invoice.xlsx");
const LOGO = join(ROOT, "public", "brand", "dtdcargo-isologo-primary.png");

// ── Marca (sin alfa "#" → ARGB que pide exceljs) ─────────────────
const WINE = "FF7F0F1A";
const NAVY = "FF0F1E3D";
const WINE_BG = "FFF6EDEE"; // wine al ~6% sobre blanco (computados)
const GREY_100 = "FFF2F0EC";
const GREY_500 = "FF6B6B6B";
const GREY_BORDER = "FFE8E6E2";
const INK_SOFT = "FF333333";

const F_SANS = "Archivo";
const F_MONO = "Consolas"; // mono disponible en Win/Office; el branding es Archivo/JetBrains

const thin = { style: "thin", color: { argb: GREY_BORDER } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

function fill(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/**
 * Fórmula por fila de una columna computada. Devuelve "" mientras falte un
 * operando: una fila vacía no muestra ceros y SUM ignora el texto vacío.
 */
export function rowFormula(target, r) {
  const operands = {
    I: ["G", "H"], // 总数量 = 件数 × 每箱装量
    K: ["I", "J"], // 总金额 = 总数量 × 单价
    M: ["G", "L"], // 总重量 = 件数 × 每箱重
    O: ["G", "N"], // 总体积 = 件数 × 每箱体积
  }[target];
  const [a, b] = operands.map((col) => `${col}${r}`);
  return `IF(OR(${a}="",${b}=""),"",${a}*${b})`;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DTD Cargo";
  wb.created = new Date("2026-06-19T00:00:00Z");
  // Excel/WPS recalculan al abrir: las fórmulas no traen resultado cacheado.
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet("Packing List", {
    properties: { defaultRowHeight: 15 },
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1, // garantiza 1 página de alto aun con las notas
      horizontalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ showGridLines: false }],
  });

  // 16 columnas de datos (A..P) — matchea las del Norte sin la # ni el borrar.
  // A Marca · B Código · C Nombre中文 · D Nombre ES · E Material/HS · F Nº caja
  // G Cajas · H Uds/caja · I Total uds · J P.unit · K Total · L kg/caja
  // M Peso · N CBM/caja · O CBM · (P sobra para respiración)
  const colWidths = [
    13, 12, 16, 16, 12, 8, 8, 9, 10, 9, 12, 9, 10, 9, 10, 3,
  ];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // ── Fila 1-3: header identidad CN (NORTE-SYNC v4.4) + título + folio ──
  ws.mergeCells("A1:E2");
  const brandCell = ws.getCell("A1");
  brandCell.value = {
    richText: [
      { text: "义乌市林冠进出口有限公司", font: { name: F_SANS, bold: true, size: 12, color: { argb: NAVY } } },
      { text: "  ·  ", font: { name: F_SANS, size: 12, color: { argb: GREY_500 } } },
      { text: "DTD", font: { name: F_SANS, bold: true, size: 16, color: { argb: WINE } } },
      { text: " Cargo", font: { name: F_SANS, bold: true, size: 16, color: { argb: NAVY } } },
    ],
  };
  brandCell.alignment = { vertical: "middle", horizontal: "left" };

  // Teléfonos de bodega (fijo + móvil) + email de recepción — v4.4.
  ws.mergeCells("A3:E3");
  const phonesCell = ws.getCell("A3");
  phonesCell.value = {
    richText: [
      { text: "电话 ", font: { name: F_SANS, bold: true, size: 8, color: { argb: WINE } } },
      { text: "0579-8543 1781 · +86 186 0689 1419 · candywu@ywlgcanopy.com", font: { name: F_MONO, size: 8, color: { argb: INK_SOFT } } },
    ],
  };
  phonesCell.alignment = { vertical: "middle", horizontal: "left" };

  // SDD-0468 · Solo la dirección: el eslogan comercial no le sirve al proveedor.
  ws.mergeCells("A4:E4");
  const subCell = ws.getCell("A4");
  subCell.value = {
    richText: [
      { text: "仓库地址 ", font: { name: F_SANS, bold: true, size: 8, color: { argb: INK_SOFT } } },
      { text: "义乌市义乌港二期直通仓2栋2号货7-货11", font: { name: F_SANS, size: 8, color: { argb: INK_SOFT } } },
      { text: " · Dirección del almacén", font: { name: F_SANS, size: 8, color: { argb: GREY_500 } } },
    ],
  };
  subCell.alignment = { vertical: "middle" };

  // Logo (si está disponible) — esquina superior derecha, sin AI-slop.
  if (existsSync(LOGO)) {
    const imgId = wb.addImage({ filename: LOGO, extension: "png" });
    ws.addImage(imgId, {
      tl: { col: 14.1, row: 0.1 },
      ext: { width: 48, height: 48 },
      editAs: "oneCell",
    });
  }

  ws.mergeCells("F1:O1");
  const titZh = ws.getCell("F1");
  titZh.value = "装箱单 + 商业发票";
  titZh.font = { name: F_SANS, bold: true, size: 15, color: { argb: WINE } };
  titZh.alignment = { vertical: "middle", horizontal: "right" };

  ws.mergeCells("F2:O2");
  const titEs = ws.getCell("F2");
  titEs.value = "Packing List + Factura";
  titEs.font = { name: F_SANS, bold: true, size: 12, color: { argb: NAVY } };
  titEs.alignment = { vertical: "middle", horizontal: "right" };

  ws.mergeCells("F3:H3");
  const folioLab = ws.getCell("F3");
  folioLab.value = "编号 · N.º";
  folioLab.font = { name: F_SANS, size: 9, color: { argb: GREY_500 } };
  folioLab.alignment = { vertical: "middle", horizontal: "right" };
  // I3 = folio (PREFILL: código de la compra).
  ws.mergeCells("I3:O3");
  const folioVal = ws.getCell("I3");
  folioVal.value = " ";
  folioVal.font = { name: F_MONO, bold: true, size: 11, color: { argb: WINE } };
  folioVal.alignment = { vertical: "middle", horizontal: "right" };

  // Línea navy bajo el header.
  ["A4", "B4", "C4", "D4", "E4", "F4", "G4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4"].forEach(
    (ref) => {
      ws.getCell(ref).border = { bottom: { style: "medium", color: { argb: NAVY } } };
    },
  );
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 16;

  // ── Filas 5-8: grilla SUPPLIER (izq, prefill) / CLIENT (der) — v4.4 ──
  // ⚠️ Las 5 celdas de prefill que usa fillPacklist viven FIJAS:
  //   C5 = 公司名称 (Proveedor) · C6 = 唛头 (Mark) · C7 = 订单 (Compra)
  //   C8 = 微信 (WeChat) · I3 = folio.  NO mover sin actualizar packlist.ts + test.
  const infoRows = [
    { row: 5, zh: "公司名称", es: "Empresa / Proveedor", prefill: true, mono: false },
    { row: 6, zh: "唛头", es: "Shipping Mark", prefill: true, mono: true },
    { row: 7, zh: "订单", es: "Compra", prefill: true, mono: true },
    { row: 8, zh: "微信", es: "WeChat", prefill: true, mono: false },
  ];
  // Columna derecha de la grilla — datos del proveedor (sin prefill).
  const infoRight = [
    { row: 5, zh: "邮箱", es: "Email" },
    { row: 6, zh: "电话", es: "Teléfono" },
    { row: 7, zh: "地址 / 城市", es: "Dirección / Ciudad" },
    { row: 8, zh: "日期", es: "Fecha" },
  ];

  for (const it of infoRows) {
    ws.mergeCells(`A${it.row}:B${it.row}`);
    const lab = ws.getCell(`A${it.row}`);
    lab.value = { richText: [
      { text: it.zh, font: { name: F_SANS, bold: true, size: 9.5, color: { argb: INK_SOFT } } },
      { text: ` · ${it.es}`, font: { name: F_SANS, size: 8.5, color: { argb: GREY_500 } } },
    ] };
    lab.alignment = { vertical: "middle" };
    lab.fill = fill(GREY_100);
    lab.border = allBorders;

    ws.mergeCells(`C${it.row}:F${it.row}`);
    const val = ws.getCell(`C${it.row}`);
    val.value = " "; // placeholder → la celda existe para el prefill.
    val.font = {
      name: it.mono ? F_MONO : F_SANS,
      bold: true,
      size: 11,
      color: { argb: it.mono ? WINE : NAVY },
    };
    val.alignment = { vertical: "middle" };
    val.border = allBorders;
  }

  for (const it of infoRight) {
    ws.mergeCells(`G${it.row}:H${it.row}`);
    const lab = ws.getCell(`G${it.row}`);
    lab.value = { richText: [
      { text: it.zh, font: { name: F_SANS, bold: true, size: 9.5, color: { argb: INK_SOFT } } },
      { text: ` · ${it.es}`, font: { name: F_SANS, size: 8.5, color: { argb: GREY_500 } } },
    ] };
    lab.alignment = { vertical: "middle" };
    lab.fill = fill(GREY_100);
    lab.border = allBorders;

    ws.mergeCells(`I${it.row}:O${it.row}`);
    const val = ws.getCell(`I${it.row}`);
    val.value = "";
    val.font = { name: F_SANS, size: 11, color: { argb: NAVY } };
    val.alignment = { vertical: "middle" };
    val.border = allBorders;
  }
  [5, 6, 7, 8].forEach((r) => (ws.getRow(r).height = 19));

  // ── Fila 10: título de la tabla + cómo se llena (SDD-0468) ─────
  ws.mergeCells("A10:G10");
  const secT = ws.getCell("A10");
  secT.value = { richText: [
    { text: "货物明细", font: { name: F_SANS, bold: true, size: 11, color: { argb: NAVY } } },
    { text: "  ·  Detalle de mercancía", font: { name: F_SANS, bold: true, size: 10, color: { argb: WINE } } },
  ] };
  secT.alignment = { vertical: "middle" };

  ws.mergeCells("H10:O10");
  const howTo = ws.getCell("H10");
  howTo.value = { richText: [
    { text: "只填白色格子，带底色的列自动计算。", font: { name: F_SANS, bold: true, size: 9, color: { argb: INK_SOFT } } },
    { text: "  Llena las celdas blancas; las de color se calculan solas.", font: { name: F_SANS, size: 8, color: { argb: GREY_500 } } },
  ] };
  howTo.alignment = { vertical: "middle", horizontal: "right" };
  ws.getRow(9).height = 8;
  ws.getRow(10).height = 18;

  // ── Fila 11: encabezados bilingües de la tabla ─────────────────
  const headers = [
    ["品牌", "Marca"],
    ["货号", "Código"],
    ["中文品名", "Nombre 中文"],
    ["英文品名", "Nombre ES"],
    ["材质 / HS", "Material/HS"],
    ["箱号", "Nº caja"],
    ["件数", "Cajas"],
    ["每箱装量", "Uds/caja"],
    ["总数量", "Total uds"],
    ["单价", "P. unit"],
    ["总金额", "Total"],
    ["每箱重", "kg/caja"],
    ["总重量", "Peso"],
    ["每箱体积", "CBM/caja"],
    ["总体积", "CBM"],
  ];
  // Columnas computadas (Total uds=I, Total=K, Peso=M, CBM=O) → wine-bg.
  const CALC_COLS = { 9: "I", 11: "K", 13: "M", 15: "O" };
  const CALC_FORMAT = { I: "#,##0", K: "#,##0.00", M: "#,##0.00", O: "0.000" };

  const headRow = ws.getRow(11);
  headers.forEach(([zh, es], i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = { richText: [
      { text: `${zh}\n`, font: { name: F_SANS, bold: true, size: 9, color: { argb: NAVY } } },
      { text: es, font: { name: F_SANS, bold: true, size: 7.5, color: { argb: GREY_500 } } },
    ] };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    // El encabezado de una columna automática lleva su mismo fondo: se lee
    // como "esta columna entera no se escribe".
    cell.fill = fill(CALC_COLS[i + 1] ? WINE_BG : GREY_100);
    cell.border = allBorders;
  });
  headRow.height = 28;

  // ── Filas 12-27: 16 filas de mercancía ─────────────────────────
  const FIRST_DATA = 12;
  const DATA_ROWS = 16;
  for (let r = FIRST_DATA; r < FIRST_DATA + DATA_ROWS; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      const calc = CALC_COLS[c];
      const isNum = c >= 6; // de Nº caja en adelante
      cell.value = calc ? { formula: rowFormula(calc, r) } : null;
      cell.border = allBorders;
      cell.font = {
        name: isNum ? F_MONO : F_SANS,
        size: 10.5,
        color: { argb: NAVY },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: isNum ? "right" : "left",
      };
      if (calc) {
        cell.fill = fill(WINE_BG);
        cell.numFmt = CALC_FORMAT[calc];
      }
    }
    row.height = 16;
  }

  // ── Fila de totales ────────────────────────────────────────────
  const totalRow = FIRST_DATA + DATA_ROWS; // 28
  ws.mergeCells(`A${totalRow}:F${totalRow}`);
  const totLab = ws.getCell(`A${totalRow}`);
  totLab.value = { richText: [
    { text: "总计", font: { name: F_SANS, bold: true, size: 10, color: { argb: NAVY } } },
    { text: " · Totales", font: { name: F_SANS, bold: true, size: 10, color: { argb: NAVY } } },
  ] };
  totLab.alignment = { vertical: "middle", horizontal: "right" };
  totLab.fill = fill(GREY_100);
  totLab.border = allBorders;
  // Cajas (G), Total uds (I), Total (K), Peso (M), CBM (O) — fórmulas en vivo.
  const sumRange = (col) => `SUM(${col}${FIRST_DATA}:${col}${totalRow - 1})`;
  const totCells = {
    G: sumRange("G"),
    I: sumRange("I"),
    K: sumRange("K"),
    M: sumRange("M"),
    O: sumRange("O"),
  };
  for (let c = 1; c <= 15; c++) {
    const cell = ws.getRow(totalRow).getCell(c);
    if (c === 1) continue; // ya seteado (merge A:F)
    if (c <= 6) {
      cell.fill = fill(GREY_100);
      cell.border = allBorders;
      continue;
    }
    const letter = String.fromCharCode(64 + c);
    cell.border = allBorders;
    cell.fill = fill(GREY_100);
    cell.font = { name: F_MONO, bold: true, size: 10.5, color: { argb: WINE } };
    cell.alignment = { vertical: "middle", horizontal: "right" };
    if (totCells[letter]) {
      cell.value = { formula: totCells[letter], result: 0 };
      if (CALC_FORMAT[letter]) cell.numFmt = CALC_FORMAT[letter];
    }
  }
  ws.getRow(totalRow).height = 18;

  // ── Moneda ─────────────────────────────────────────────────────
  const curRow = totalRow + 1; // 29
  ws.mergeCells(`A${curRow}:B${curRow}`);
  const curLab = ws.getCell(`A${curRow}`);
  curLab.value = { richText: [
    { text: "货币", font: { name: F_SANS, bold: true, size: 9, color: { argb: INK_SOFT } } },
    { text: " · Moneda", font: { name: F_SANS, size: 8.5, color: { argb: GREY_500 } } },
  ] };
  curLab.alignment = { vertical: "middle" };
  ws.mergeCells(`C${curRow}:D${curRow}`);
  const curVal = ws.getCell(`C${curRow}`);
  curVal.value = "USD"; // editable por el usuario (USD/RMB/EUR)
  curVal.font = { name: F_MONO, bold: true, size: 11, color: { argb: NAVY } };
  curVal.alignment = { vertical: "middle" };
  curVal.border = allBorders;
  // Validación de lista (USD/RMB/EUR).
  curVal.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: ['"USD,RMB,EUR"'],
  };
  ws.getRow(curRow).height = 18;

  // ── Notas · SDD-0468: 5 reglas, chino primero, una por línea ──
  // (tuteo venezolano en el español; método nuevo, sin grupo WeChat).
  const notesRow = curRow + 2; // 31
  ws.mergeCells(`A${notesRow}:O${notesRow}`);
  const notesHead = ws.getCell(`A${notesRow}`);
  notesHead.value = { richText: [
    { text: "入仓注意事项", font: { name: F_SANS, bold: true, size: 10, color: { argb: NAVY } } },
    { text: " · Reglas para enviar al almacén", font: { name: F_SANS, bold: true, size: 9.5, color: { argb: WINE } } },
  ] };
  notesHead.alignment = { vertical: "middle" };
  ws.getRow(notesRow).height = 16;

  const notes = [
    ["1. 每个箱子都要写上方的唛头，没有唛头会延误出口。", "Escribe el Shipping Mark de arriba en cada caja; sin él se retrasa la exportación."],
    ["2. 品牌货请填写真实品牌；没有品牌填“无”。", "Si es de marca, declara la marca real; si no, escribe “无”."],
    ["3. 禁止危险品和违禁品入仓。", "No se aceptan mercancías peligrosas ni restringidas."],
    ["4. 卸货由供应商安排并付费；仓库代卸按体积或重量收费。", "La descarga la paga el proveedor; si la hace el almacén, se cobra por volumen o peso."],
    ["5. 有疑问请联系：吴小姐 18606891419 · 微信 DTDLogistic", "Dudas: Srta. Wu."],
  ];
  notes.forEach(([zh, es], i) => {
    const r = notesRow + 1 + i;
    ws.mergeCells(`A${r}:O${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = { richText: [
      { text: zh, font: { name: F_SANS, size: 9, color: { argb: INK_SOFT } } },
      { text: `  ${es}`, font: { name: F_SANS, size: 8, color: { argb: GREY_500 } } },
    ] };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    ws.getRow(r).height = 14;
  });

  // ── Firmas ─────────────────────────────────────────────────────
  const signRow = notesRow + notes.length + 3; // 39
  ws.mergeCells(`A${signRow}:E${signRow}`);
  const s1 = ws.getCell(`A${signRow}`);
  s1.value = { richText: [
    { text: "供应商签字 / 盖章", font: { name: F_SANS, bold: true, size: 8.5, color: { argb: GREY_500 } } },
    { text: " · Proveedor (firma/sello)", font: { name: F_SANS, size: 8, color: { argb: GREY_500 } } },
  ] };
  s1.alignment = { vertical: "top" };
  s1.border = { top: { style: "thin", color: { argb: NAVY } } };

  ws.mergeCells(`G${signRow}:K${signRow}`);
  const s2 = ws.getCell(`G${signRow}`);
  s2.value = { richText: [
    { text: "日期", font: { name: F_SANS, bold: true, size: 8.5, color: { argb: GREY_500 } } },
    { text: " · Fecha", font: { name: F_SANS, size: 8, color: { argb: GREY_500 } } },
  ] };
  s2.alignment = { vertical: "top" };
  s2.border = { top: { style: "thin", color: { argb: NAVY } } };
  ws.getRow(signRow - 1).height = 22; // aire para firmar
  ws.getRow(signRow).height = 14;

  // Print area exacta → fuerza 1 página.
  ws.pageSetup.printArea = `A1:O${signRow}`;

  await wb.xlsx.writeFile(OUT);
  console.log(`[build-packlist-template] escrito: ${OUT}`);
  console.log(
    "[build-packlist-template] prefill cells: C5(proveedor) C6(markbox) C7(compra) C8(wechat) I3(folio)",
  );
}

// Importable sin efectos (`rowFormula` se puede reusar); solo genera al ejecutarse.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("[build-packlist-template] error:", e);
    process.exit(1);
  });
}
