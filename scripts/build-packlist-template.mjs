#!/usr/bin/env node
/**
 * SDD-0096 · Genera el template Excel BRANDED del packing list + factura del
 * proveedor → public/templates/dtd-packing-list-invoice.xlsx.
 *
 * Reemplaza el .xlsx off-brand por uno con la marca DTD Cargo (wine #7F0F1A /
 * navy #0F1E3D / cream #FBFAF7), formato idéntico al prototipo del Norte
 * (docs/design/studio/_norte/packlist/*.html): header DTD Cargo, título bilingüe
 * 装箱单+商业发票 / Packing List + Factura, grilla de proveedor, tabla de mercancía
 * bilingüe, fila de totales, notas (en TUTEO venezolano, método nuevo — sin grupo
 * WeChat obligatorio: marca cada caja con el Shipping Mark + declara la marca real),
 * tarjeta Shipping Mark, firmas, celda de moneda. pageSetup → 1 página A4 horizontal.
 *
 * Las 5 celdas que pre-llena el GET (lib/studio/prealertas/packlist.ts ·
 * fillPacklist) viven en posiciones FIJAS y conocidas:
 *   C6  = 唛头 (Shipping Mark)  → MARKBOX del cliente
 *   C7  = 客户 (Cliente)        → nombre del cliente
 *   C5  = 公司名称 (Proveedor)  → nombre del proveedor
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

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DTD Cargo";
  wb.created = new Date("2026-06-19T00:00:00Z");

  const ws = wb.addWorksheet("Packing List", {
    properties: { defaultRowHeight: 15 },
    pageSetup: {
      orientation: "landscape",
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1, // garantiza 1 página de alto aun con las 7 notas
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

  ws.mergeCells("A4:E4");
  const subCell = ws.getCell("A4");
  subCell.value = "仓库地址: 义乌市义乌港二期直通仓2栋2号货7-货11 · Importación puerta a puerta 中国 → 委内瑞拉";
  subCell.font = { name: F_SANS, size: 8, color: { argb: GREY_500 } };
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
  titEs.value = "Packing List + Factura · proveedor → DTD Cargo";
  titEs.font = { name: F_SANS, bold: true, size: 12, color: { argb: NAVY } };
  titEs.alignment = { vertical: "middle", horizontal: "right" };

  ws.mergeCells("F3:H3");
  const folioLab = ws.getCell("F3");
  folioLab.value = "N.º / 编号 · Folio";
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
  // Columna derecha de la grilla — datos del cliente/proveedor (sin prefill).
  const infoRight = [
    { row: 5, zh: "邮箱", es: "Email proveedor" },
    { row: 6, zh: "供应商电话", es: "Tel. proveedor" },
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

  // ── Fila 10: título de la tabla ────────────────────────────────
  ws.mergeCells("A10:O10");
  const secT = ws.getCell("A10");
  secT.value = { richText: [
    { text: "货物明细", font: { name: F_SANS, bold: true, size: 11, color: { argb: NAVY } } },
    { text: "  ·  Detalle de mercancía", font: { name: F_SANS, bold: true, size: 10, color: { argb: WINE } } },
  ] };
  secT.alignment = { vertical: "middle" };
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
  const headRow = ws.getRow(11);
  headers.forEach(([zh, es], i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = { richText: [
      { text: `${zh}\n`, font: { name: F_SANS, bold: true, size: 9, color: { argb: NAVY } } },
      { text: es, font: { name: F_SANS, bold: true, size: 7.5, color: { argb: GREY_500 } } },
    ] };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = fill(GREY_100);
    cell.border = allBorders;
  });
  headRow.height = 28;

  // Columnas computadas (Total uds=I, Total=K, Peso=M, CBM=O) → wine-bg.
  const CALC_COLS = [9, 11, 13, 15];
  // ── Filas 12-27: 16 filas de mercancía vacías ──────────────────
  const FIRST_DATA = 12;
  const DATA_ROWS = 16;
  for (let r = FIRST_DATA; r < FIRST_DATA + DATA_ROWS; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      const isCalc = CALC_COLS.includes(c);
      const isNum = c >= 6; // de Nº caja en adelante
      cell.value = null;
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
      if (isCalc) cell.fill = fill(WINE_BG);
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

  // ── Notas (en TUTEO venezolano · método nuevo, sin grupo WeChat) ──
  const notesRow = curRow + 2; // 31
  ws.mergeCells(`A${notesRow}:I${notesRow}`);
  const notesHead = ws.getCell(`A${notesRow}`);
  notesHead.value = { richText: [
    { text: "入仓注意事项", font: { name: F_SANS, bold: true, size: 10, color: { argb: NAVY } } },
    { text: " · Reglas para enviar a la bodega", font: { name: F_SANS, bold: true, size: 9.5, color: { argb: WINE } } },
  ] };
  notesHead.alignment = { vertical: "middle" };
  ws.getRow(notesRow).height = 16;

  const notes = [
    "1. Marca cada caja con el Shipping Mark del cliente (唛头). Sin él, esto generará retraso en la exportación.  请在每个箱子上写客户唛头；缺唛头会延误出口。",
    "2. Llena este documento antes de enviar y mándalo con la carga, o súbelo en tu link de DTD.  发货前填写本单并随货发送，或在链接上传。",
    "3. Completa el formulario o sube el Excel. Otros originales solo si DTD los solicita.  在线填写或上传 Excel，任选一种。仅在 DTD 要求时提供其他原始单据。",
    "4. Si la mercancía es de marca, declara la marca real; si no, escribe \"无 / ninguna\". Ocultar la marca es riesgo en aduana del proveedor.  品牌货请如实填写品牌，否则填\"无\"。",
    "5. La descarga la organiza y paga el proveedor; si la hace nuestra bodega, se cobra por volumen/peso.  卸货由供应商安排并承担；如由我方卸货，按体积/重量收费。",
    "6. Prohibido enviar mercancía peligrosa o restringida.  禁止危险品、违禁品入仓。",
    `7. Contacto en China: 吴小姐 (Srta. Wu) · 18606891419 · WeChat DTDLogistic.  中国联系人：吴小姐 · 18606891419 · 微信 DTDLogistic。`,
  ];
  notes.forEach((t, i) => {
    const r = notesRow + 1 + i;
    ws.mergeCells(`A${r}:I${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = t;
    cell.font = { name: F_SANS, size: 8.5, color: { argb: INK_SOFT } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    ws.getRow(r).height = 13;
  });

  // ── Tarjeta Shipping Mark (derecha de las notas) ───────────────
  ws.mergeCells(`K${notesRow}:O${notesRow}`);
  const smHead = ws.getCell(`K${notesRow}`);
  smHead.value = { richText: [
    { text: "唛头内容", font: { name: F_SANS, bold: true, size: 10, color: { argb: WINE } } },
    { text: " · Shipping Mark", font: { name: F_SANS, bold: true, size: 9.5, color: { argb: NAVY } } },
  ] };
  smHead.alignment = { vertical: "middle" };
  smHead.border = { top: { style: "medium", color: { argb: NAVY } }, left: { style: "medium", color: { argb: NAVY } }, right: { style: "medium", color: { argb: NAVY } } };

  const smRows = [
    ["MARK", "DTD-____"],
    ["ITEM NO", "____"],
    ["PCS / CTN", "____"],
    ["CARTON NO", "____"],
  ];
  smRows.forEach(([k, v], i) => {
    const r = notesRow + 1 + i;
    ws.mergeCells(`K${r}:L${r}`);
    const kc = ws.getCell(`K${r}`);
    kc.value = k;
    kc.font = { name: F_MONO, size: 9.5, color: { argb: GREY_500 } };
    kc.alignment = { vertical: "middle" };
    kc.border = { left: { style: "medium", color: { argb: NAVY } } };
    ws.mergeCells(`M${r}:O${r}`);
    const vc = ws.getCell(`M${r}`);
    vc.value = v;
    vc.font = { name: F_MONO, bold: true, size: 9.5, color: { argb: NAVY } };
    vc.alignment = { vertical: "middle", horizontal: "right" };
    vc.border = { right: { style: "medium", color: { argb: NAVY } } };
  });
  // Cierre inferior de la tarjeta.
  ["K", "L", "M", "N", "O"].forEach((col) => {
    ws.getCell(`${col}${notesRow + 4}`).border = {
      bottom: { style: "medium", color: { argb: NAVY } },
      left: col === "K" ? { style: "medium", color: { argb: NAVY } } : undefined,
      right: col === "O" ? { style: "medium", color: { argb: NAVY } } : undefined,
    };
  });

  // ── Firmas ─────────────────────────────────────────────────────
  const signRow = notesRow + 8; // ~39
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

main().catch((e) => {
  console.error("[build-packlist-template] error:", e);
  process.exit(1);
});
