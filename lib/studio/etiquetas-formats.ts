/**
 * Formatos de plancha de etiquetas (SDD-0031) — datos puros, server-safe.
 *
 * Vive en lib/ y no en `_components/Label.tsx` porque ese módulo es
 * `"use client"` (usa qrcode.react): importar de ahí un VALOR desde un server
 * component arrastra el módulo cliente al grafo del servidor. Lo caza el paso
 * `rsc-boundary` del gate. Como esto es solo geometría en milímetros —sin React,
 * sin hooks— puede vivir del lado server y lo consumen ambos lados.
 *
 * Las medidas son en mm reales para que el @page CSS imprima al tamaño exacto.
 */

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
