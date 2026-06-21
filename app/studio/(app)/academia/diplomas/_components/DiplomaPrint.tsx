"use client";

/**
 * Diploma imprimible (SDD-0093, Feature B) — port del generador del Norte
 * (diplomas/diploma.js + Diploma · DTD-Cargo.html) a React. 4 variantes
 * (A minimal · B clásico · C banda navy · D elegante); la variante se elige de
 * forma ESTABLE por el folio (pickDiplomaVariant). Sello + QR REAL (SVG inline
 * server-side) + folio (mono) + nombre + curso + horas + fecha + lugar.
 *
 * Canvas 1123×794 (A4 landscape). Solo tokens var(--*); Archivo/Archivo Black
 * vía las fuentes de marca. La escala a pantalla la hace el contenedor padre;
 * en print el CSS @media print restaura tamaño real y oculta el cromo.
 */

import Image from "next/image";
import {
  pickDiplomaVariant,
  type DiplomaVariant,
} from "@/lib/studio/academia/types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[(m - 1) % 12]} de ${y}`;
}

export interface DiplomaData {
  folio: string;
  studentName: string;
  courseTitle: string;
  hours: number | null;
  place: string | null;
  issuedAt: string | null;
}

const ISSUER = "DTD Cargo · Academia DTD";
const DIR_ROLE = "Dirección de la Academia";
const INS_ROLE = "Facilitador del programa";

function metaLine(d: DiplomaData): string {
  const parts: string[] = [];
  if (d.hours != null) parts.push(`Duración: ${d.hours} horas`);
  if (d.place) parts.push(d.place);
  const date = fmtDate(d.issuedAt);
  if (date) parts.push(date);
  return parts.join("  ·  ");
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`dpl-wm${dark ? " dpl-wm--dark" : ""}`}>
      <span className="dpl-wm-d">DTD</span>
      <span className="dpl-wm-sp" />
      <span className="dpl-wm-c">Cargo</span>
    </span>
  );
}

function Seal({ dark = false }: { dark?: boolean }) {
  const iso = dark
    ? "/brand/dtdcargo-isologo-reverse.png"
    : "/brand/dtdcargo-isologo-primary.png";
  return (
    <div className={`dpl-seal${dark ? " dpl-seal--dark" : ""}`}>
      <svg className="dpl-seal-ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="96" fill="none" stroke="var(--seal-stroke)" strokeWidth="2" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="var(--seal-stroke)" strokeWidth="1" strokeDasharray="2 4" />
        <path id="dpl-sealtop" d="M100,100 m -72,0 a 72,72 0 1,1 144,0" fill="none" />
        <path id="dpl-sealbot" d="M100,100 m 72,0 a 72,72 0 1,1 -144,0" fill="none" />
        <text className="dpl-seal-txt">
          <textPath href="#dpl-sealtop" startOffset="50%" textAnchor="middle">
            CON CONFIANZA · DE CHINA A TU PUERTA
          </textPath>
        </text>
        <text className="dpl-seal-txt">
          <textPath href="#dpl-sealbot" startOffset="50%" textAnchor="middle">
            · CERTIFICADO OFICIAL · DTD CARGO ·
          </textPath>
        </text>
      </svg>
      <Image className="dpl-seal-iso" src={iso} alt="" width={58} height={58} unoptimized />
    </div>
  );
}

function QrBlock({ folio, qrSvg }: { folio: string; qrSvg: string }) {
  return (
    <div className="dpl-qrwrap">
      <div className="dpl-qr">
        {qrSvg ? (
          <div
            style={{ width: "100%", height: "100%" }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : (
          <div className="dpl-qr-faux" aria-label="Código de verificación (placeholder)">
            QR
          </div>
        )}
      </div>
      <div className="dpl-qr-cap">
        <span className="dpl-qr-l">Verifica este certificado</span>
        <span className="dpl-qr-f">{folio}</span>
      </div>
    </div>
  );
}

function Sig({ name, role }: { name: string; role: string }) {
  return (
    <div className="dpl-sig">
      {name ? (
        <div className="dpl-sig-nm">{name}</div>
      ) : (
        <div className="dpl-sig-nm dpl-sig-nm--empty" />
      )}
      <div className="dpl-sig-line" />
      <div className="dpl-sig-rl">{role}</div>
    </div>
  );
}

export function DiplomaPrint({
  data,
  qrSvg,
  variant: forced,
}: {
  data: DiplomaData;
  qrSvg: string;
  /** Forzar una variante (preview); por defecto se deriva del folio. */
  variant?: DiplomaVariant;
}) {
  const variant = forced ?? pickDiplomaVariant(data.folio);
  const meta = metaLine(data);

  return (
    <>
      <DiplomaStyles />
      {variant === "A" && <VariantA data={data} qrSvg={qrSvg} meta={meta} />}
      {variant === "B" && <VariantB data={data} qrSvg={qrSvg} meta={meta} />}
      {variant === "C" && <VariantC data={data} qrSvg={qrSvg} meta={meta} />}
      {variant === "D" && <VariantD data={data} qrSvg={qrSvg} meta={meta} />}
    </>
  );
}

type VProps = { data: DiplomaData; qrSvg: string; meta: string };

// ── Variante A · minimal asimétrico ──────────────────────────
function VariantA({ data, qrSvg, meta }: VProps) {
  return (
    <div className="dpl dpl-a">
      <div className="dpl-va-top">
        <div className="dpl-va-brand">
          <Wordmark />
          <div className="dpl-va-issuer">{ISSUER}</div>
        </div>
        <QrBlock folio={data.folio} qrSvg={qrSvg} />
      </div>
      <div className="dpl-va-body">
        <div className="dpl-va-eyebrow">Diploma de participación</div>
        <div className="dpl-va-rule" />
        <div className="dpl-va-label">Se otorga el presente diploma a</div>
        <h1 className="dpl-va-name">{data.studentName}</h1>
        <p className="dpl-va-lead">por haber completado satisfactoriamente el curso de</p>
        <div className="dpl-va-course">{data.courseTitle}</div>
        <div className="dpl-va-meta">{meta}</div>
      </div>
      <div className="dpl-va-foot">
        <div className="dpl-sigs">
          <Sig name="" role={DIR_ROLE} />
          <Sig name="" role={INS_ROLE} />
        </div>
        <Seal />
      </div>
    </div>
  );
}

// ── Variante B · clásico centrado ────────────────────────────
function VariantB({ data, qrSvg, meta }: VProps) {
  return (
    <div className="dpl dpl-b">
      <div className="dpl-vb-frame" />
      <div className="dpl-vb-inner">
        <Image
          className="dpl-vb-iso"
          src="/brand/dtdcargo-isologo-primary.png"
          alt=""
          width={60}
          height={60}
          unoptimized
        />
        <div className="dpl-vb-wm">
          <Wordmark />
        </div>
        <div className="dpl-vb-issuer">{ISSUER}</div>
        <div className="dpl-vb-eyebrow">Diploma de participación</div>
        <div className="dpl-vb-label">Se otorga el presente diploma a</div>
        <h1 className="dpl-vb-name">{data.studentName}</h1>
        <div className="dpl-vb-namerule" />
        <p className="dpl-vb-lead">
          por haber completado satisfactoriamente el curso de{" "}
          <b>{data.courseTitle}</b>
        </p>
        <div className="dpl-vb-meta">{meta}</div>
        <div className="dpl-vb-foot">
          <Sig name="" role={DIR_ROLE} />
          <Seal />
          <Sig name="" role={INS_ROLE} />
        </div>
      </div>
      <div className="dpl-vb-corner">
        <QrBlock folio={data.folio} qrSvg={qrSvg} />
      </div>
    </div>
  );
}

// ── Variante C · banda navy ──────────────────────────────────
function VariantC({ data, qrSvg, meta }: VProps) {
  return (
    <div className="dpl dpl-c">
      <div className="dpl-vc-band">
        <Image
          className="dpl-vc-iso"
          src="/brand/dtdcargo-isologo-reverse.png"
          alt="DTD Cargo"
          width={132}
          height={132}
          unoptimized
        />
        <div className="dpl-vc-tag">
          Con Confianza,
          <br />
          de China a tu puerta.
        </div>
        <div className="dpl-vc-bandfoot">
          <QrBlock folio={data.folio} qrSvg={qrSvg} />
        </div>
      </div>
      <div className="dpl-vc-main">
        <div className="dpl-vc-issuer">{ISSUER}</div>
        <div className="dpl-vc-eyebrow">Diploma de participación</div>
        <div className="dpl-vc-label">Se otorga el presente diploma a</div>
        <h1 className="dpl-vc-name">{data.studentName}</h1>
        <p className="dpl-vc-lead">por haber completado satisfactoriamente el curso de</p>
        <div className="dpl-vc-course">{data.courseTitle}</div>
        <div className="dpl-vc-meta">{meta}</div>
        <div className="dpl-vc-foot">
          <div className="dpl-sigs">
            <Sig name="" role={DIR_ROLE} />
            <Sig name="" role={INS_ROLE} />
          </div>
          <Seal />
        </div>
      </div>
    </div>
  );
}

// ── Variante D · clásico elegante (marco ornamental) ─────────
function Flourish() {
  return (
    <svg className="dpl-vd-fl" viewBox="0 0 220 14" aria-hidden="true">
      <line x1="0" y1="7" x2="92" y2="7" stroke="var(--wine-soft)" strokeWidth="1" />
      <path d="M104,7 l6,-5 6,5 -6,5 z" fill="none" stroke="var(--wine)" strokeWidth="1.2" />
      <circle cx="110" cy="7" r="1.6" fill="var(--wine)" />
      <line x1="128" y1="7" x2="220" y2="7" stroke="var(--wine-soft)" strokeWidth="1" />
    </svg>
  );
}

function CornerMotif() {
  return (
    <svg className="dpl-vd-corner" viewBox="0 0 60 60" aria-hidden="true">
      <path d="M2,30 Q2,2 30,2" fill="none" stroke="var(--wine)" strokeWidth="1.5" />
      <path d="M10,30 Q10,10 30,10" fill="none" stroke="var(--wine-soft)" strokeWidth="1" />
      <circle cx="14" cy="14" r="2.4" fill="var(--wine)" />
    </svg>
  );
}

function VariantD({ data, qrSvg, meta }: VProps) {
  return (
    <div className="dpl dpl-d">
      <svg className="dpl-vd-orn" viewBox="0 0 1123 794" preserveAspectRatio="none" aria-hidden="true">
        <rect x="30" y="30" width="1063" height="734" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        <rect x="40" y="40" width="1043" height="714" fill="none" stroke="var(--wine)" strokeWidth="1" />
      </svg>
      <div className="dpl-vd-c tl"><CornerMotif /></div>
      <div className="dpl-vd-c tr"><CornerMotif /></div>
      <div className="dpl-vd-c bl"><CornerMotif /></div>
      <div className="dpl-vd-c br"><CornerMotif /></div>
      <div className="dpl-vd-inner">
        <Image
          className="dpl-vd-iso"
          src="/brand/dtdcargo-isologo-primary.png"
          alt=""
          width={56}
          height={56}
          unoptimized
        />
        <div className="dpl-vd-wm">
          <Wordmark />
        </div>
        <div className="dpl-vd-issuer">{ISSUER}</div>
        <div className="dpl-vd-eyebrow">
          <Flourish />
          <span>Diploma de Participación</span>
          <Flourish />
        </div>
        <div className="dpl-vd-label">Se otorga el presente diploma a</div>
        <h1 className="dpl-vd-name">{data.studentName}</h1>
        <p className="dpl-vd-lead">
          por haber completado satisfactoriamente el curso de <b>{data.courseTitle}</b>
        </p>
        <div className="dpl-vd-meta">{meta}</div>
        <div className="dpl-vd-foot">
          <Sig name="" role={DIR_ROLE} />
          <Seal />
          <Sig name="" role={INS_ROLE} />
        </div>
      </div>
      <div className="dpl-vd-corner-qr">
        <QrBlock folio={data.folio} qrSvg={qrSvg} />
      </div>
    </div>
  );
}

// ── Estilos del diploma (scoped al prefijo dpl-) ─────────────
function DiplomaStyles() {
  return (
    <style>{`
.dpl {
  width: 1123px; height: 794px; position: relative;
  background: var(--bg-base); color: var(--ink);
  font-family: var(--f-sans); overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* wordmark */
.dpl-wm { font-family: var(--f-display); font-weight: 900; letter-spacing: -0.02em; font-size: 24px; white-space: nowrap; }
.dpl-wm-d { color: var(--wine); } .dpl-wm-c { color: var(--ink); }
.dpl-wm-sp { display: inline-block; width: 0.15em; }
.dpl-wm--dark .dpl-wm-d { color: var(--wine-soft); } .dpl-wm--dark .dpl-wm-c { color: #F2F0EC; }
/* QR */
.dpl-qrwrap { display: flex; align-items: center; gap: 12px; }
.dpl-qr { width: 78px; height: 78px; background: #fff; padding: 6px; border-radius: var(--r-sm); border: 1px solid var(--border); flex: 0 0 auto; box-sizing: border-box; }
.dpl-qr svg { display: block; width: 100%; height: 100%; }
.dpl-qr-faux { width: 100%; height: 100%; display: grid; place-items: center; font: 700 16px/1 var(--f-mono); color: var(--ink-mute); background: repeating-conic-gradient(var(--border) 0% 25%, #fff 0% 50%) 50% / 12px 12px; }
.dpl-qr-cap { display: flex; flex-direction: column; gap: 3px; }
.dpl-qr-l { font: 600 9px/1.25 var(--f-sans); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-mute); max-width: 96px; }
.dpl-qr-f { font: 600 13px/1 var(--f-mono); color: var(--wine); }
/* seal */
.dpl-seal { position: relative; width: 120px; height: 120px; flex: 0 0 auto; --seal-stroke: var(--wine); --seal-fill: var(--wine); }
.dpl-seal--dark { --seal-stroke: var(--wine-soft); --seal-fill: #F2F0EC; }
.dpl-seal-ring { position: absolute; inset: 0; width: 100%; height: 100%; }
.dpl-seal-txt { font: 700 9.2px var(--f-sans); letter-spacing: 0.14em; fill: var(--seal-fill); text-transform: uppercase; }
.dpl-seal-iso { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 58px; height: auto; }
/* signatures */
.dpl-sigs { display: flex; gap: 44px; }
.dpl-sig { min-width: 198px; }
.dpl-sig-nm { font: 600 16px/1.2 var(--f-display); color: var(--ink); margin-bottom: 4px; min-height: 19px; }
.dpl-sig-nm--empty { min-height: 19px; }
.dpl-sig-line { border-top: 1.5px solid var(--ink); margin-bottom: 7px; }
.dpl-sig-rl { font: 600 10.5px/1.2 var(--f-sans); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-mute); }
/* Variante A */
.dpl-a { padding: 64px 76px; display: flex; flex-direction: column; }
.dpl-va-top { display: flex; align-items: flex-start; justify-content: space-between; }
.dpl-va-issuer { font: 600 11px/1.2 var(--f-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-mute); margin-top: 8px; }
.dpl-va-body { margin-top: 52px; flex: 1; }
.dpl-va-eyebrow { font: 700 13px/1 var(--f-sans); letter-spacing: 0.22em; text-transform: uppercase; color: var(--wine); }
.dpl-va-rule { width: 56px; height: 3px; background: var(--wine); margin: 16px 0 28px; }
.dpl-va-label { font: 600 14px/1 var(--f-sans); letter-spacing: 0.04em; color: var(--ink-soft); margin-bottom: 14px; }
.dpl-va-name { font: 600 72px/1.0 var(--f-display); letter-spacing: -0.02em; color: var(--ink); margin: 0 0 22px; }
.dpl-va-lead { font: 400 17px/1.4 var(--f-sans); color: var(--ink-soft); margin: 0 0 8px; }
.dpl-va-course { font: 600 32px/1.1 var(--f-display); color: var(--wine); margin-bottom: 18px; }
.dpl-va-meta { font: 500 14px/1.5 var(--f-mono); color: var(--ink-soft); }
.dpl-va-foot { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 36px; }
/* Variante B */
.dpl-b { background: var(--bg-base); }
.dpl-vb-frame { position: absolute; inset: 26px; border: 1px solid var(--ink); pointer-events: none; }
.dpl-vb-frame::after { content: ''; position: absolute; inset: 5px; border: 1px solid var(--wine-soft); opacity: 0.5; }
.dpl-vb-inner { position: absolute; inset: 26px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 46px 90px 40px; }
.dpl-vb-iso { width: 60px; height: auto; margin-bottom: 12px; }
.dpl-vb-wm { margin-bottom: 6px; }
.dpl-vb-issuer { font: 600 10px/1 var(--f-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 22px; }
.dpl-vb-eyebrow { font: 700 12px/1 var(--f-sans); letter-spacing: 0.24em; text-transform: uppercase; color: var(--wine); margin-bottom: 18px; }
.dpl-vb-label { font: 600 13px/1 var(--f-sans); letter-spacing: 0.04em; color: var(--ink-soft); margin-bottom: 14px; }
.dpl-vb-name { font: 600 60px/1.0 var(--f-display); letter-spacing: -0.02em; color: var(--ink); margin: 0; }
.dpl-vb-namerule { width: 280px; height: 1.5px; background: var(--wine); margin: 18px 0 20px; }
.dpl-vb-lead { font: 400 16px/1.55 var(--f-sans); color: var(--ink-soft); max-width: 640px; margin: 0 0 16px; }
.dpl-vb-lead b { color: var(--wine); font-weight: 600; }
.dpl-vb-meta { font: 500 13px/1.5 var(--f-mono); color: var(--ink-soft); }
.dpl-vb-foot { display: flex; align-items: flex-end; justify-content: center; gap: 56px; margin-top: auto; width: 100%; }
.dpl-vb-foot .dpl-seal { margin-bottom: 4px; }
.dpl-vb-corner { position: absolute; right: 52px; bottom: 50px; }
.dpl-b .dpl-qrwrap { flex-direction: column; align-items: flex-end; gap: 5px; }
.dpl-b .dpl-qr-cap { text-align: right; }
.dpl-b .dpl-qr-l { max-width: 120px; }
/* Variante C */
.dpl-c { display: flex; }
.dpl-vc-band { width: 372px; flex: 0 0 372px; background: var(--bg-sidebar); color: #F2F0EC; padding: 64px 48px; display: flex; flex-direction: column; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dpl-vc-iso { width: 132px; height: auto; }
.dpl-vc-tag { font: 700 26px/1.18 var(--f-display); color: #F2F0EC; letter-spacing: -0.01em; margin-top: 32px; }
.dpl-vc-bandfoot { margin-top: auto; }
.dpl-vc-band .dpl-qr-l { color: rgba(242,240,236,0.75); }
.dpl-vc-band .dpl-qr-f { color: var(--wine-soft); }
.dpl-vc-main { flex: 1; padding: 64px 72px; display: flex; flex-direction: column; }
.dpl-vc-issuer { font: 600 11px/1 var(--f-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-mute); }
.dpl-vc-eyebrow { font: 700 13px/1 var(--f-sans); letter-spacing: 0.22em; text-transform: uppercase; color: var(--wine); margin-top: 36px; }
.dpl-vc-label { font: 600 14px/1 var(--f-sans); color: var(--ink-soft); margin-top: 22px; margin-bottom: 14px; }
.dpl-vc-name { font: 600 58px/1.0 var(--f-display); letter-spacing: -0.02em; color: var(--ink); margin: 0 0 22px; }
.dpl-vc-lead { font: 400 16px/1.4 var(--f-sans); color: var(--ink-soft); margin: 0 0 8px; }
.dpl-vc-course { font: 600 30px/1.1 var(--f-display); color: var(--wine); margin-bottom: 16px; }
.dpl-vc-meta { font: 500 13px/1.5 var(--f-mono); color: var(--ink-soft); }
.dpl-vc-foot { display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; }
.dpl-vc-foot .dpl-sigs { gap: 36px; }
.dpl-vc-foot .dpl-sig { min-width: 168px; }
.dpl-vc-foot .dpl-seal { width: 104px; height: 104px; }
/* Variante D */
.dpl-d { background: var(--bg-base); }
.dpl-vd-orn { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.dpl-vd-c { position: absolute; width: 60px; height: 60px; }
.dpl-vd-c.tl { left: 30px; top: 30px; }
.dpl-vd-c.tr { right: 30px; top: 30px; transform: scaleX(-1); }
.dpl-vd-c.bl { left: 30px; bottom: 30px; transform: scaleY(-1); }
.dpl-vd-c.br { right: 30px; bottom: 30px; transform: scale(-1, -1); }
.dpl-vd-corner { width: 100%; height: 100%; display: block; }
.dpl-vd-inner { position: absolute; inset: 40px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 96px 34px; }
.dpl-vd-iso { width: 56px; height: auto; margin-bottom: 10px; }
.dpl-vd-wm { margin-bottom: 5px; }
.dpl-vd-issuer { font: 600 10px/1 var(--f-sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 20px; }
.dpl-vd-eyebrow { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.dpl-vd-eyebrow span { font: 700 13px/1 var(--f-sans); letter-spacing: 0.2em; text-transform: uppercase; color: var(--wine); white-space: nowrap; }
.dpl-vd-fl { width: 130px; height: 12px; }
.dpl-vd-label { font: 600 13px/1 var(--f-sans); letter-spacing: 0.04em; color: var(--ink-soft); margin-bottom: 14px; }
.dpl-vd-name { font: 600 58px/1.0 var(--f-display); letter-spacing: -0.02em; color: var(--ink); margin: 0 0 18px; }
.dpl-vd-lead { font: 400 16px/1.55 var(--f-sans); color: var(--ink-soft); max-width: 660px; margin: 0 0 14px; }
.dpl-vd-lead b { color: var(--wine); font-weight: 600; }
.dpl-vd-meta { font: 500 13px/1.5 var(--f-mono); color: var(--ink-soft); }
.dpl-vd-foot { display: flex; align-items: flex-end; justify-content: center; gap: 52px; margin-top: auto; width: 100%; }
.dpl-vd-foot .dpl-seal { margin-bottom: 4px; }
.dpl-vd-corner-qr { position: absolute; right: 56px; bottom: 54px; }
.dpl-d .dpl-qrwrap { flex-direction: column; align-items: flex-end; gap: 5px; }
.dpl-d .dpl-qr-cap { text-align: right; }
`}</style>
  );
}
