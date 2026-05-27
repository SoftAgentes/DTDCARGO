"use client";

/**
 * Etiqueta individual (SDD-0031).
 *
 * Header bilingüe ES/CN · MARKBOX en JetBrains Mono wine · QR mock 21×21
 * con finder patterns · Box X/Y sobre fondo navy · footer con dirección
 * del warehouse CN destino.
 *
 * Dimensiones en mm reales para que el @page CSS imprima al tamaño exacto.
 */

import type { LabelClient, LabelWarehouseCn } from "../page";

// ─────────────────────────────────────────────────────────────
// Formatos disponibles
// ─────────────────────────────────────────────────────────────

export type LabelFormat = {
  id: string;
  label: string;
  desc: string;
  page: { w: number; h: number; marginX: number; marginY: number };
  cell: {
    w: number;
    h: number;
    cols: number;
    rows: number;
    gutterX: number;
    gutterY: number;
  };
  perPage: number;
};

export const FORMATS: LabelFormat[] = [
  {
    id: "a4-8up",
    label: "A4 · 8 etiquetas",
    desc: "99 × 67,7 mm · plancha estándar (Avery L7165)",
    page: { w: 210, h: 297, marginX: 6, marginY: 14.5 },
    cell: { w: 99, h: 67.7, cols: 2, rows: 4, gutterX: 0, gutterY: 0 },
    perPage: 8,
  },
  {
    id: "a4-4up",
    label: "A4 · 4 etiquetas grandes",
    desc: "99 × 139 mm · más grandes, mejor lectura",
    page: { w: 210, h: 297, marginX: 6, marginY: 9.5 },
    cell: { w: 99, h: 139, cols: 2, rows: 2, gutterX: 0, gutterY: 0 },
    perPage: 4,
  },
  {
    id: "thermal-100x150",
    label: "Térmico 100 × 150 mm",
    desc: "Impresora Zebra / Brother · 1 por página",
    page: { w: 100, h: 150, marginX: 0, marginY: 0 },
    cell: { w: 100, h: 150, cols: 1, rows: 1, gutterX: 0, gutterY: 0 },
    perPage: 1,
  },
  {
    id: "thermal-100x100",
    label: "Térmico 100 × 100 mm",
    desc: "Térmica cuadrada · 1 por página",
    page: { w: 100, h: 100, marginX: 0, marginY: 0 },
    cell: { w: 100, h: 100, cols: 1, rows: 1, gutterX: 0, gutterY: 0 },
    perPage: 1,
  },
];

// ─────────────────────────────────────────────────────────────
// QR mock determinista · djb2 + finder patterns
// ─────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

export function QrMock({ value, size = 64 }: { value: string; size?: number }) {
  const grid = 21;
  const seed = hashStr(value);
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cells: Array<[number, number]> = [];

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // 3 finder patterns (TL · TR · BL)
      const inFinder =
        (r < 7 && c < 7) ||
        (r < 7 && c > grid - 8) ||
        (r > grid - 8 && c < 7);
      if (inFinder) {
        const lr = r < 7 ? r : grid - 1 - r;
        const lc = c < 7 ? c : c > grid - 8 ? grid - 1 - c : c;
        const onRing = lr === 0 || lr === 6 || lc === 0 || lc === 6;
        const inSquare = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
        if (onRing || inSquare) cells.push([c, r]);
        continue;
      }
      // Separador blanco junto a los finders
      const nextToFinder =
        (r === 7 && c < 8) ||
        (c === 7 && r < 8) ||
        (r === 7 && c > grid - 9) ||
        (c === grid - 8 && r < 8) ||
        (r === grid - 8 && c < 8) ||
        (c === 7 && r > grid - 9);
      if (nextToFinder) continue;
      if (rnd() > 0.52) cells.push([c, r]);
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      shapeRendering="crispEdges"
      style={{ display: "block" }}
      aria-label={`QR mock para ${value}`}
    >
      <rect x="0" y="0" width={grid} height={grid} fill="#FFFFFF" />
      {cells.map(([c, r], i) => (
        <rect key={i} x={c} y={r} width="1" height="1" fill="#0F1E3D" />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Warehouse formatting helper
// ─────────────────────────────────────────────────────────────

export type WarehouseAddress = {
  code: string;
  city: string;
  city_cn: string;
  address_cn: string;
  contact_cn: string;
  phone: string;
  wechat: string;
};

const HUB_DATA: Record<string, Omit<WarehouseAddress, "code" | "city" | "city_cn">> = {
  "YIW-A1": {
    address_cn: "义乌市国际商贸城三区 5楼 218号 · DTD-Cargo",
    contact_cn: "王亮 Wang Liang",
    phone: "+86 137 5028 9114",
    wechat: "DTD_CARGO_YIW",
  },
  "GZ-B2": {
    address_cn: "广州市番禺区市桥工业园 12号 B栋 · DTD-Cargo",
    contact_cn: "陈伟 Chen Wei",
    phone: "+86 188 2266 9988",
    wechat: "DTD_CARGO_GZ",
  },
  "SZ-C1": {
    address_cn: "深圳市宝安区福永街道工业区 8栋 · DTD-Cargo",
    contact_cn: "张敏 Zhang Min",
    phone: "+86 159 8842 1107",
    wechat: "DTD_CARGO_SZ",
  },
};

export function warehouseAddress(w: LabelWarehouseCn): WarehouseAddress {
  const fallback = {
    address_cn: w.hub_name_cn ?? w.warehouse_name ?? "DTD-Cargo",
    contact_cn: "DTD-Cargo",
    phone: "—",
    wechat: "—",
  };
  const hub = HUB_DATA[w.code] ?? fallback;
  return {
    code: w.code,
    city: w.city,
    city_cn: w.hub_name_cn ?? w.city,
    ...hub,
  };
}

// ─────────────────────────────────────────────────────────────
// Label component
// ─────────────────────────────────────────────────────────────

export function Label({
  format,
  client,
  warehouse,
  boxIndex,
  totalBoxes,
  qr,
}: {
  format: LabelFormat;
  client: LabelClient;
  warehouse: WarehouseAddress;
  boxIndex: number;
  totalBoxes: number;
  qr: boolean;
}) {
  const isCompact = format.cell.h < 80; // A4-8up + térmica 100×100
  const padding = isCompact ? "7px 9px" : "11px 13px";
  const codeFs = isCompact ? 26 : 36;
  const qrSize = isCompact ? 54 : 78;

  return (
    <div
      className="dtd-label"
      style={{
        width: `${format.cell.w}mm`,
        height: `${format.cell.h}mm`,
        padding,
        background: "#FFFFFF",
        color: "#0F1E3D",
        border: "1.2px solid #0F1E3D",
        borderRadius: 2,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: isCompact ? 4 : 7,
        overflow: "hidden",
        fontFamily: "Archivo, system-ui, sans-serif",
        position: "relative",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* Header bilingüe */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px dashed #0F1E3D",
          paddingBottom: isCompact ? 4 : 6,
        }}
      >
        <div>
          <div
            style={{
              font: `900 ${isCompact ? 11 : 13}px/1 'Archivo Black', Archivo, sans-serif`,
              letterSpacing: "0.02em",
            }}
          >
            SHIPPING TO · DTD Cargo
          </div>
          <div
            style={{
              font: `700 ${isCompact ? 10 : 12}px/1.1 'Noto Sans SC', Archivo, sans-serif`,
              color: "#7F0F1A",
              marginTop: 2,
            }}
          >
            寄至：DTD-Cargo 国际货运
          </div>
        </div>
        <div
          style={{
            background: "#7F0F1A",
            color: "#FFFFFF",
            padding: isCompact ? "3px 6px" : "4px 8px",
            font: `900 ${isCompact ? 9 : 10.5}px/1 'Archivo Black', sans-serif`,
            letterSpacing: "0.08em",
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          {warehouse.code}
        </div>
      </div>

      {/* Cuerpo: izq MARKBOX+cliente · der QR */}
      <div
        style={{
          display: "flex",
          gap: isCompact ? 8 : 12,
          alignItems: "flex-start",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `700 ${isCompact ? 8 : 9}px/1 Archivo, sans-serif`,
              color: "#6B6B6B",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            MARKBOX · 货主代码
          </div>
          <div
            style={{
              font: `900 ${codeFs}px/1 'JetBrains Mono', ui-monospace, monospace`,
              color: "#7F0F1A",
              letterSpacing: "-0.01em",
              marginBottom: isCompact ? 4 : 7,
            }}
          >
            {client.markbox}
          </div>
          <div
            style={{
              font: `700 ${isCompact ? 9 : 10.5}px/1.2 Archivo, sans-serif`,
              color: "#0F1E3D",
            }}
          >
            {client.name}
          </div>
          {client.company && (
            <div
              style={{
                font: `500 ${isCompact ? 8.5 : 10}px/1.2 Archivo, sans-serif`,
                color: "#6B6B6B",
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {client.company}
            </div>
          )}
        </div>

        {qr && (
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <QrMock
              value={`DTD:${client.markbox}|${boxIndex}/${totalBoxes}`}
              size={qrSize}
            />
          </div>
        )}
      </div>

      {/* Box X/Y bilingüe */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isCompact ? "4px 8px" : "6px 10px",
          background: "#0F1E3D",
          color: "#FFFFFF",
          borderRadius: 2,
        }}
      >
        <span
          style={{
            font: `700 ${isCompact ? 8 : 9.5}px/1 Archivo, sans-serif`,
            opacity: 0.8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          BOX · 箱号
        </span>
        <div
          style={{
            font: `900 ${isCompact ? 15 : 19}px/1 'JetBrains Mono', monospace`,
            letterSpacing: "-0.01em",
          }}
        >
          {boxIndex} <span style={{ opacity: 0.55 }}>/</span> {totalBoxes}
        </div>
      </div>

      {/* Footer warehouse */}
      {!isCompact && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 4,
            borderTop: "1px dashed #E8E6E2",
          }}
        >
          <div
            style={{
              font: "600 8px/1.3 'Noto Sans SC', Archivo, sans-serif",
              color: "#0F1E3D",
            }}
          >
            收货地址：{warehouse.address_cn}
          </div>
          <div
            style={{
              font: "500 7.5px/1.3 Archivo, sans-serif",
              color: "#6B6B6B",
              marginTop: 1,
            }}
          >
            联系 / Contacto: {warehouse.contact_cn} · {warehouse.phone} · WeChat{" "}
            {warehouse.wechat}
          </div>
        </div>
      )}
      {isCompact && (
        <div
          style={{
            marginTop: "auto",
            font: "600 7px/1.2 'Noto Sans SC', Archivo, sans-serif",
            color: "#6B6B6B",
            textAlign: "center",
          }}
        >
          {warehouse.city_cn} · WeChat {warehouse.wechat}
        </div>
      )}
    </div>
  );
}
