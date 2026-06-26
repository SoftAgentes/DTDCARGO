/**
 * CSS del preview de reportes de inspección (SDD-0066 · Fase 2/3).
 *
 * Portado de `docs/design/studio/_norte/reportes/report.css`, SCOPEADO bajo
 * `.dtd-report` para no contaminar el resto del Studio. Reusa los tokens del
 * sistema (var(--*) de tokens.css) — cero hex inventados salvo los neutros de
 * impresión que ya traía la hoja del Norte (fondo gris del lienzo, sombreado de
 * tabla). El `@media print` queda GLOBAL: al imprimir solo deben verse las hojas.
 *
 * Se inyecta vía <style> en ReportPreview (no es un import .css global) para que
 * el scope quede garantizado y el bundle no lo aplique a otras rutas.
 */

export const REPORT_CSS = String.raw`
.dtd-report { background:#6B6B6B; padding:18px 0; }
.dtd-report .sheet {
  position:relative; width:210mm; min-height:297mm; margin:0 auto 18px;
  background:var(--bg-surface); box-shadow:var(--shadow-lg);
  padding:16mm 15mm 22mm; overflow:hidden; color:var(--ink);
  font-family:var(--f-sans);
}
.dtd-report .sheet > * { position:relative; z-index:1; }

/* Cabecera (lockup + meta) */
.dtd-report .rp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--s-6); padding-bottom:var(--s-4); border-bottom:2px solid var(--ink); margin-bottom:var(--s-6); }
.dtd-report .rp-lockup { display:flex; align-items:center; gap:12px; }
.dtd-report .rp-lockup .dtd-iso { width:38px; height:39px; position:relative; flex-shrink:0; }
.dtd-report .rp-lockup .dtd-iso img { width:100%; height:100%; object-fit:contain; }
.dtd-report .wordmark { font-family:var(--f-display); font-weight:900; letter-spacing:-0.02em; line-height:1; font-size:21px; }
.dtd-report .wordmark .w-dtd { color:var(--wine); }
.dtd-report .wordmark .w-sep { display:inline-block; width:0.15em; }
.dtd-report .wordmark .w-cargo { color:var(--ink); }
.dtd-report .rp-lockup .lk-sub { font:600 9px/1.1 var(--f-sans); letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-soft); margin-top:3px; }
.dtd-report .rp-meta { text-align:right; font-size:10.5px; color:var(--ink-soft); }
.dtd-report .rp-meta .doc-type { font:700 11px/1.2 var(--f-display); color:var(--ink); text-transform:uppercase; letter-spacing:0.04em; }
.dtd-report .rp-meta .mono { font-family:var(--f-mono); color:var(--ink); font-weight:600; }
.dtd-report .rp-meta dl { margin:6px 0 0; display:grid; grid-template-columns:max-content max-content; justify-content:end; column-gap:14px; row-gap:3px; }
.dtd-report .rp-meta dt { color:var(--ink-mute); text-align:right; white-space:nowrap; }
.dtd-report .rp-meta dd { margin:0; color:var(--ink); font-weight:600; text-align:right; }

/* Títulos */
.dtd-report .eyebrow { font:700 10px/1 var(--f-sans); letter-spacing:0.14em; text-transform:uppercase; color:var(--wine); }
.dtd-report h1.rp-title { font:800 26px/1.1 var(--f-display); color:var(--ink); margin:4px 0 2px; letter-spacing:-0.01em; }
.dtd-report .rp-title-sub { font-size:12.5px; color:var(--ink-soft); margin:0 0 var(--s-5); }
.dtd-report h2.sec { font:700 14px/1.2 var(--f-display); color:var(--ink); margin:var(--s-6) 0 var(--s-3); padding-bottom:6px; border-bottom:1px solid var(--border-strong); display:flex; align-items:center; gap:8px; }
.dtd-report h2.sec .sec-no { font-family:var(--f-mono); font-size:11px; color:#fff; background:var(--ink); border-radius:var(--r-sm); padding:2px 7px; font-weight:700; }
.dtd-report h3.sub { font:700 11.5px/1.2 var(--f-sans); color:var(--ink); margin:var(--s-4) 0 var(--s-2); letter-spacing:0.01em; }

/* Tablas */
.dtd-report table.dt { width:100%; border-collapse:collapse; font-size:11px; margin:var(--s-2) 0 var(--s-4); }
.dtd-report table.dt th, .dtd-report table.dt td { border:1px solid var(--border-strong); padding:6px 9px; text-align:left; vertical-align:top; }
.dtd-report table.dt th { background:var(--bg-elevated); color:var(--ink); font-weight:700; font-size:10px; letter-spacing:0.02em; }
.dtd-report table.dt tr:nth-child(even) td { background:#FCFBF9; } /* zebra · neutro de impresión del Norte */
.dtd-report table.dt td.mono, .dtd-report table.dt .mono { font-family:var(--f-mono); font-weight:600; }
.dtd-report table.dt td.num { text-align:right; font-family:var(--f-mono); }

/* Badges */
.dtd-report .badge { display:inline-flex; align-items:center; gap:5px; font:700 10px/1 var(--f-sans); letter-spacing:0.03em; padding:4px 9px; border-radius:var(--r-pill); white-space:nowrap; }
.dtd-report .badge.success { color:var(--success); background:var(--success-bg); }
.dtd-report .badge.warning { color:var(--warning); background:var(--warning-bg); }
.dtd-report .badge.danger  { color:var(--danger);  background:var(--danger-bg); }
.dtd-report .badge.neutral { color:var(--ink-soft); background:var(--neutral-bg); }
.dtd-report .badge.lg { font-size:12px; padding:6px 13px; }

/* Marca de agua SAMPLE + franja */
.dtd-report .wm { position:absolute; inset:0; z-index:0; pointer-events:none; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.dtd-report .wm span { font:900 150px/0.9 var(--f-display); color:rgba(127,15,26,0.07); letter-spacing:0.08em; transform:rotate(-32deg); white-space:nowrap; text-transform:uppercase; }
.dtd-report .sample-band { position:absolute; top:18px; right:-54px; z-index:3; background:var(--wine); color:#fff; font:800 10px/1 var(--f-sans); letter-spacing:0.18em; text-transform:uppercase; padding:6px 64px; transform:rotate(45deg); box-shadow:var(--shadow-sm); }

/* Score gauge */
.dtd-report .score-hero { display:flex; align-items:center; gap:var(--s-8); padding:var(--s-5) 0; }
.dtd-report .gauge { position:relative; width:150px; height:150px; flex-shrink:0; }
.dtd-report .gauge svg { width:100%; height:100%; transform:rotate(-90deg); }
.dtd-report .gauge .g-bg { fill:none; stroke:var(--bg-elevated); }
.dtd-report .gauge .g-fg { fill:none; stroke:var(--success); stroke-linecap:round; }
.dtd-report .gauge .g-val { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.dtd-report .gauge .g-num { font:800 38px/1 var(--f-display); color:var(--ink); }
.dtd-report .gauge .g-den { font:600 11px/1 var(--f-sans); color:var(--ink-mute); margin-top:2px; }

/* Galería */
.dtd-report .gal { display:grid; gap:var(--s-3); }
.dtd-report .gal.g3 { grid-template-columns:repeat(3, 1fr); }
.dtd-report .gal.g4 { grid-template-columns:repeat(4, 1fr); }
.dtd-report .shot { border:1px solid var(--border-strong); border-radius:var(--r-md); overflow:hidden; background:var(--bg-elevated); break-inside:avoid; }
.dtd-report .shot .img { aspect-ratio:4/3; overflow:hidden; background:#d9d6d1; }
.dtd-report .shot .img img { width:100%; height:100%; object-fit:cover; }
.dtd-report .shot .cap { padding:5px 8px; font-size:9.5px; color:var(--ink-soft); display:flex; align-items:center; justify-content:space-between; gap:6px; }
.dtd-report .shot .cap .lab { font-weight:600; color:var(--ink); }

/* Checklist */
.dtd-report .chk { font-size:11px; }
.dtd-report .chk .it { display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid var(--border); }
.dtd-report .chk .box { width:15px; height:15px; border:1.5px solid var(--border-strong); border-radius:3px; flex-shrink:0; position:relative; }
.dtd-report .chk .box.on { background:var(--ink); border-color:var(--ink); }
.dtd-report .chk .box.on::after { content:""; position:absolute; left:4px; top:1px; width:4px; height:8px; border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
.dtd-report .chk .it .lab { color:var(--ink); }

/* Footer */
.dtd-report .rp-foot { margin-top:var(--s-8); border-top:2px solid var(--ink); padding-top:var(--s-4); }
.dtd-report .foot-bar { display:flex; align-items:center; justify-content:space-between; gap:var(--s-4); }
.dtd-report .foot-brand { display:flex; align-items:center; gap:9px; }
.dtd-report .foot-brand .dtd-iso { width:26px; height:27px; position:relative; flex-shrink:0; }
.dtd-report .foot-brand .dtd-iso img { width:100%; height:100%; object-fit:contain; }
.dtd-report .foot-brand .tag { font:700 10px/1.2 var(--f-display); color:var(--ink); }
.dtd-report .foot-brand .tag small { display:block; font:500 8.5px/1.2 var(--f-sans); color:var(--ink-soft); letter-spacing:0.02em; }
.dtd-report .foot-contact { font:500 8.6px/1.5 var(--f-mono); color:var(--ink-soft); text-align:right; }
.dtd-report .foot-contact b { color:var(--ink); font-weight:700; }
.dtd-report .pageno { position:absolute; bottom:8mm; right:15mm; font:600 8.5px/1 var(--f-mono); color:var(--ink-mute); z-index:1; }
.dtd-report .val-empty { color:var(--ink-mute); }

/* Impresión: solo las hojas, a A4. GLOBAL a propósito. */
@media print {
  @page { size:A4; margin:0; }
  body { background:#fff !important; }
  body * { visibility:hidden; }
  .dtd-report, .dtd-report * { visibility:visible; }
  .dtd-report { position:absolute; inset:0; background:#fff; padding:0; margin:0; }
  .dtd-report .no-print { display:none !important; }
  .dtd-report .sheet { margin:0; box-shadow:none; page-break-after:always; width:210mm; min-height:297mm; }
  .dtd-report .sheet:last-child { page-break-after:auto; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`;
