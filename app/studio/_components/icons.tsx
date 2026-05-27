/**
 * DTD Studio · Icon set
 *
 * Outline icons, 1.6 stroke, 24×24 grid. Match brand style.
 * Portado 1:1 desde docs/design/v1-studio/source/erp/icons.jsx
 *
 * Uso:
 *   import { Icon } from "@/app/studio/_components/icons";
 *   <span>{Icon.dashboard(18)}</span>
 *
 * Color = currentColor — controlá via `color: var(--*)` del contenedor.
 */

import React from "react";

type Size = number;

const wrap = (size: Size, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
    {children}
  </svg>
);

const P = ({ d }: { d: string }) => (
  <path
    d={d}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const C = ({
  cx,
  cy,
  r,
  fill = "none",
}: {
  cx: number;
  cy: number;
  r: number;
  fill?: string;
}) => (
  <circle
    cx={cx}
    cy={cy}
    r={r}
    fill={fill === "fill" ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.6}
  />
);

const R = ({
  x,
  y,
  w,
  h,
  rx = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
}) => (
  <rect
    x={x}
    y={y}
    width={w}
    height={h}
    rx={rx}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
  />
);

export const Icon = {
  // ── Navigation ──────────────────────────────────────────────
  dashboard: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={3} y={3} w={7} h={9} rx={1.4} />
        <R x={14} y={3} w={7} h={5} rx={1.4} />
        <R x={14} y={12} w={7} h={9} rx={1.4} />
        <R x={3} y={16} w={7} h={5} rx={1.4} />
      </>
    ),
  box: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 8 12 3l9 5v8l-9 5-9-5V8z" />
        <P d="M3 8l9 5 9-5M12 13v10" />
      </>
    ),
  calc: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={4} y={3} w={16} h={18} rx={2} />
        <P d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4" />
      </>
    ),
  users: (s: Size = 18) =>
    wrap(
      s,
      <>
        <C cx={9} cy={8} r={4} />
        <P d="M2 21c0-4 3-7 7-7s7 3 7 7" />
        <P d="M17 11a3 3 0 100-6" />
        <P d="M22 21c0-3-2-5-5-5" />
      </>
    ),
  radar: (s: Size = 18) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={9} />
        <C cx={12} cy={12} r={5} />
        <C cx={12} cy={12} r={1.5} fill="fill" />
        <P d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </>
    ),
  invoice: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M5 3h11l3 3v15H5z" />
        <P d="M16 3v3h3" />
        <P d="M8 11h8M8 15h8M8 19h5" />
      </>
    ),
  doc: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M6 3h9l4 4v14H6z" />
        <P d="M15 3v4h4" />
        <P d="M9 13h6M9 17h6" />
      </>
    ),
  warehouse: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 9l9-5 9 5v12H3z" />
        <P d="M7 21V13h10v8" />
        <P d="M7 17h10" />
      </>
    ),
  truck: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={1} y={7} w={12} h={9} rx={1.4} />
        <P d="M13 10h5l3 4v2h-8z" />
        <C cx={6} cy={18} r={2} />
        <C cx={17} cy={18} r={2} />
      </>
    ),
  tag: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 12V3h9l9 9-9 9z" />
        <C cx={8} cy={8} r={1.5} fill="fill" />
      </>
    ),
  shield: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" />
        <P d="M9 12l2 2 4-4" />
      </>
    ),
  chart: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 3v18h18" />
        <P d="M7 15l3-3 3 3 5-5" />
      </>
    ),
  spark: (s: Size = 18) =>
    wrap(s, <P d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />),
  mail: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={3} y={5} w={18} h={14} rx={2} />
        <P d="M3 7l9 6 9-6" />
      </>
    ),

  // ── Actions ──────────────────────────────────────────────────
  plus: (s: Size = 14) => wrap(s, <P d="M12 5v14M5 12h14" />),
  search: (s: Size = 16) =>
    wrap(
      s,
      <>
        <C cx={11} cy={11} r={7} />
        <P d="M21 21l-5-5" />
      </>
    ),
  filter: (s: Size = 14) => wrap(s, <P d="M3 5h18l-7 9v7l-4-2v-5L3 5z" />),
  more: (s: Size = 14) =>
    wrap(
      s,
      <>
        <C cx={5} cy={12} r={1.4} fill="fill" />
        <C cx={12} cy={12} r={1.4} fill="fill" />
        <C cx={19} cy={12} r={1.4} fill="fill" />
      </>
    ),
  close: (s: Size = 14) => wrap(s, <P d="M6 6l12 12M18 6 6 18" />),
  check: (s: Size = 14) => wrap(s, <P d="M5 12l5 5 9-11" />),
  arrowR: (s: Size = 14) => wrap(s, <P d="M5 12h14M13 6l6 6-6 6" />),
  arrowL: (s: Size = 14) => wrap(s, <P d="M19 12H5M11 6l-6 6 6 6" />),
  chevR: (s: Size = 14) => wrap(s, <P d="M9 6l6 6-6 6" />),
  chevD: (s: Size = 14) => wrap(s, <P d="M6 9l6 6 6-6" />),
  chevU: (s: Size = 14) => wrap(s, <P d="M6 15l6-6 6 6" />),
  download: (s: Size = 14) =>
    wrap(s, <P d="M12 3v12M7 10l5 5 5-5M5 21h14" />),
  upload: (s: Size = 14) => wrap(s, <P d="M12 15V3M7 8l5-5 5 5M5 21h14" />),
  camera: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 8h3l2-3h8l2 3h3v11H3z" />
        <C cx={12} cy={13} r={3.5} />
      </>,
    ),
  edit: (s: Size = 14) => wrap(s, <P d="M16 3l5 5-11 11H5v-5z" />),
  trash: (s: Size = 14) =>
    wrap(s, <P d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />),
  eye: (s: Size = 14) =>
    wrap(
      s,
      <>
        <P d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
        <C cx={12} cy={12} r={3} />
      </>
    ),
  eyeOff: (s: Size = 14) =>
    wrap(
      s,
      <>
        <P d="M3 3l18 18" />
        <P d="M10.6 6.2A10.5 10.5 0 0112 6c6 0 10 7 10 7a16.6 16.6 0 01-3.3 4.1" />
        <P d="M6.1 6.1C3.6 7.7 2 12 2 12s4 7 10 7c1.5 0 2.9-.3 4.1-.8" />
        <P d="M9.9 9.9a3 3 0 104.2 4.2" />
      </>
    ),
  link: (s: Size = 14) =>
    wrap(
      s,
      <>
        <P d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5" />
        <P d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.5-1.5" />
      </>
    ),
  copy: (s: Size = 14) =>
    wrap(
      s,
      <>
        <R x={8} y={8} w={12} h={12} rx={2} />
        <P d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" />
      </>
    ),

  // ── Status / utility ─────────────────────────────────────────
  bell: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8" />
        <P d="M10 21a2 2 0 004 0" />
      </>
    ),
  sun: (s: Size = 16) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={4} />
        <P d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  moon: (s: Size = 16) =>
    wrap(s, <P d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />),
  menu: (s: Size = 18) => wrap(s, <P d="M3 6h18M3 12h18M3 18h18" />),
  panelL: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={3} y={3} w={18} h={18} rx={2} />
        <P d="M9 3v18" />
      </>
    ),
  cog: (s: Size = 16) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={3} />
        <P d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
      </>
    ),
  warn: (s: Size = 14) =>
    wrap(
      s,
      <>
        <P d="M12 3l10 18H2z" />
        <P d="M12 10v5M12 18h.01" />
      </>
    ),
  info: (s: Size = 14) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={9} />
        <P d="M12 8h.01M11 12h1v4h1" />
      </>
    ),
  clock: (s: Size = 14) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={9} />
        <P d="M12 7v5l3 2" />
      </>
    ),
  pin: (s: Size = 14) =>
    wrap(
      s,
      <>
        <P d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z" />
        <C cx={12} cy={9} r={2.5} />
      </>
    ),
  globe: (s: Size = 14) =>
    wrap(
      s,
      <>
        <C cx={12} cy={12} r={9} />
        <P d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
      </>
    ),
  ship: (s: Size = 18) =>
    wrap(
      s,
      <>
        <P d="M3 15l1.5-5h15L21 15M12 5v5" />
        <P d="M3 19s2-1 4-1 3 1 5 1 3-1 5-1 4 1 4 1" />
        <P d="M9 8h6" />
      </>
    ),
  cn: (s: Size = 14) =>
    wrap(
      s,
      <>
        <R x={2} y={4} w={20} h={16} rx={2} />
        <P d="M7 11l1 1 1-2 1 2 1-1M14 11l1 1 1-2 1 2 1-1" />
      </>
    ),
  flag: (s: Size = 14) => wrap(s, <P d="M4 21V4h12l-2 4 2 4H4" />),
  refresh: (s: Size = 14) =>
    wrap(
      s,
      <P d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5" />
    ),
  external: (s: Size = 12) => wrap(s, <P d="M7 17L17 7M9 7h8v8" />),
  star: (s: Size = 14) =>
    wrap(
      s,
      <P d="M12 3l2.9 6 6.1.9-4.5 4.3 1.1 6.3L12 17l-5.6 3.5L7.5 14.2 3 9.9 9.1 9z" />
    ),
  flame: (s: Size = 14) =>
    wrap(
      s,
      <P d="M12 3s4 3 4 8a4 4 0 11-8 0c0-2 1-3 1-3s-1 4 2 4-1-6 1-9z" />
    ),
  lock: (s: Size = 18) =>
    wrap(
      s,
      <>
        <R x={4} y={11} w={16} h={10} rx={2} />
        <P d="M8 11V7a4 4 0 018 0v4" />
        <C cx={12} cy={16} r={1.4} fill="fill" />
      </>
    ),
};

export type IconName = keyof typeof Icon;
