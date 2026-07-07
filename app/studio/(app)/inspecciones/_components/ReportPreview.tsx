"use client";

/**
 * ReportPreview — render white-label del reporte de inspección (SDD-0066).
 *
 * Llena la plantilla del Norte (Producto/PSI o Fábrica) con los datos del
 * payload + cabecera. Marca DTD: lockup, RIF J-50648869-8, footer canónico.
 *
 * REGLA DURA (white-label): este componente NUNCA renderiza `provider_internal`
 * ni el nombre del tercero ("Canopy") en la salida del reporte. El campo puede
 * llegar en el objeto `report` (lo usa el editor interno), pero acá no se pinta
 * en ninguna hoja → el cliente final, que solo recibe el PDF/impresión, jamás
 * lo ve. (El editor es solo-staff del tenant; el cliente nunca entra al Studio.)
 *
 * Modo "sample": redacta cliente/fábrica (campos sensibles → "—" / "[ejemplo]")
 * y muestra una franja + marca de agua "EJEMPLO".
 *
 * Botón "Imprimir / Guardar PDF" → window.print() (el @media print de report-css
 * deja solo las hojas). Server-side PDF determinista = V2 (no acá).
 */

import { useMemo } from "react";
import Image from "next/image";
import {
  ensurePsiPayload,
  ensureFactoryPayload,
  inspectionConclusionLabel,
  factoryCompanyTypeLabel,
  psiOverallLabel,
  PSI_CATEGORY_LABELS,
  type InspectionReport,
  type PsiCategoryKey,
} from "@/lib/studio/inspecciones/types";
import type { InspectionPhotoItem } from "@/lib/studio/inspecciones/photos";
import { REPORT_CSS } from "./report-css";

const ISO_SRC = "/brand/dtdcargo-isologo-primary.png";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Valor o "—" (en sample, los sensibles ya llegan redactados). */
function V({ v }: { v: string | number | null | undefined }) {
  if (v == null || v === "") return <span className="val-empty">—</span>;
  return <>{v}</>;
}

function YesNo({ v }: { v: boolean | null | undefined }) {
  if (v == null) return <span className="val-empty">—</span>;
  return <>{v ? "Sí" : "No"}</>;
}

function Lockup() {
  return (
    <div className="rp-lockup">
      <span className="dtd-iso">
        <Image src={ISO_SRC} alt="DTD" fill sizes="40px" />
      </span>
      <div>
        <div className="wordmark">
          <span className="w-dtd">DTD</span>
          <span className="w-sep" />
          <span className="w-cargo">Cargo</span>
        </div>
        <div className="lk-sub">Control de Calidad · Origen China</div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="rp-foot">
      <div className="foot-bar">
        <div className="foot-brand">
          <span className="dtd-iso">
            <Image src={ISO_SRC} alt="DTD" fill sizes="27px" />
          </span>
          <div className="tag">
            Con Confianza, de China a tu puerta.
            <small>info@dtdcargo.com · +58 241 414 7886</small>
          </div>
        </div>
        <div className="foot-contact">
          <b>DTD&nbsp;Cargo</b> · RIF&nbsp;J-50648869-8
          <br />
          Av.&nbsp;Bolívar&nbsp;Norte&nbsp;14, Valencia
        </div>
      </div>
    </div>
  );
}

function Head({
  docType,
  reportNo,
  date,
}: {
  docType: string;
  reportNo: string;
  date: string;
}) {
  return (
    <header className="rp-head">
      <Lockup />
      <div className="rp-meta">
        <div className="doc-type">{docType}</div>
        <dl>
          <dt>Servicio N.º</dt>
          <dd className="mono">{reportNo}</dd>
          <dt>Fecha · Date</dt>
          <dd className="mono">{date}</dd>
        </dl>
      </div>
    </header>
  );
}

export function ReportPreview({
  report,
  photos,
  sample = false,
  onClose,
}: {
  report: InspectionReport;
  photos: InspectionPhotoItem[];
  sample?: boolean;
  onClose?: () => void;
}) {
  const isFactory = report.type === "factory_audit";
  const date = fmtDate(report.inspection_date);

  // En sample, el cliente/fábrica se redacta.
  const redact = (v: string | number | null | undefined) =>
    sample ? "[ejemplo]" : v;

  const psi = useMemo(
    () => (isFactory ? null : ensurePsiPayload(report.payload)),
    [isFactory, report.payload],
  );
  const fac = useMemo(
    () => (isFactory ? ensureFactoryPayload(report.payload) : null),
    [isFactory, report.payload],
  );

  const imgPhotos = photos.filter((p) => p.url);

  return (
    <div className="dtd-report">
      <style>{REPORT_CSS}</style>

      {/* Barra de acciones (no imprime) */}
      <div
        className="no-print"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
          maxWidth: "210mm",
          margin: "0 auto 12px",
          padding: "0 4px",
        }}
      >
        {sample && (
          <span
            style={{
              marginRight: "auto",
              font: "600 11px/1 var(--f-sans)",
              color: "var(--ink-inv-soft)",
            }}
          >
            Modo ejemplo · datos del cliente redactados
          </span>
        )}
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => window.print()}
        >
          Imprimir / Guardar PDF
        </button>
        {onClose && (
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        )}
      </div>

      {isFactory ? (
        <FactorySheets
          report={report}
          fac={fac!}
          date={date}
          redact={redact}
          sample={sample}
          photos={imgPhotos}
        />
      ) : (
        <PsiSheets
          report={report}
          psi={psi!}
          date={date}
          redact={redact}
          sample={sample}
          photos={imgPhotos}
        />
      )}
    </div>
  );
}

// ── Producto / PSI ──────────────────────────────────────────────
function PsiSheets({
  report,
  psi,
  date,
  redact,
  sample,
  photos,
}: {
  report: InspectionReport;
  psi: ReturnType<typeof ensurePsiPayload>;
  date: string;
  redact: (v: string | number | null | undefined) => string | number | null | undefined;
  sample: boolean;
  photos: InspectionPhotoItem[];
}) {
  return (
    <>
      <section className="sheet">
        {sample && <div className="sample-band">Ejemplo</div>}
        {sample && (
          <div className="wm">
            <span>Ejemplo</span>
          </div>
        )}
        <Head docType="Inspección de Producto" reportNo={report.report_no} date={date} />

        <div className="eyebrow">Reporte de Inspección Pre-Embarque · PSI</div>
        <h1 className="rp-title">{report.title}</h1>
        <p className="rp-title-sub">
          Producto: <V v={redact(report.product)} />
        </p>

        <h2 className="sec">
          <span className="sec-no">1</span> Información de la orden
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Producto</th>
              <td><V v={redact(report.product)} /></td>
              <th style={{ width: "30%" }}>Ítem #</th>
              <td><V v={psi.order.itemNo} /></td>
            </tr>
            <tr>
              <th>P/O #</th>
              <td><V v={redact(psi.order.po)} /></td>
              <th>Cantidad orden</th>
              <td className="num"><V v={psi.order.orderQty} /></td>
            </tr>
            <tr>
              <th>Destino</th>
              <td><V v={redact(psi.order.destination)} /></td>
              <th>Shipping Mark</th>
              <td><V v={redact(psi.order.shippingMark)} /></td>
            </tr>
            <tr>
              <th>Llegada a fábrica</th>
              <td><V v={psi.order.arrival} /></td>
              <th>Salida de fábrica</th>
              <td><V v={psi.order.departure} /></td>
            </tr>
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">AQL</span> Nivel de calidad aceptable
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th>Norma</th>
              <th>Nivel</th>
              <th className="num">Crítico</th>
              <th className="num">Mayor</th>
              <th className="num">Menor</th>
            </tr>
            <tr>
              <td><V v={psi.aql.standard} /></td>
              <td><V v={psi.aql.level} /></td>
              <td className="num">{psi.aql.maxAllowed.critical}</td>
              <td className="num">{psi.aql.maxAllowed.major}</td>
              <td className="num">{psi.aql.maxAllowed.minor}</td>
            </tr>
            <tr>
              <th colSpan={2} style={{ textAlign: "left" }}>
                Encontrados · muestra <V v={psi.aql.sampleSize} />
              </th>
              <td className="num">{psi.aql.found.critical}</td>
              <td className="num">{psi.aql.found.major}</td>
              <td className="num">{psi.aql.found.minor}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="sub">Categorías</h3>
        <table className="dt">
          <tbody>
            <tr>
              <th>Categoría</th>
              <th style={{ width: 120 }}>Conforme</th>
              <th>Comentario</th>
            </tr>
            {psi.categories.map((c) => (
              <tr key={c.key}>
                <td>{PSI_CATEGORY_LABELS[c.key as PsiCategoryKey] ?? c.key}</td>
                <td>
                  {c.conform == null ? (
                    <span className="val-empty">—</span>
                  ) : c.conform ? (
                    <span className="badge success">Conforme</span>
                  ) : (
                    <span className="badge danger">No conforme</span>
                  )}
                </td>
                <td><V v={c.comment} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            gap: "var(--s-4)",
            alignItems: "center",
            marginTop: "var(--s-4)",
            border: "1.5px solid var(--ink)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
          }}
        >
          <strong style={{ font: "700 13px/1 var(--f-display)" }}>
            Resultado general
          </strong>
          <span style={{ marginLeft: "auto" }} className="badge lg">
            {psiOverallLabel(psi.overall)}
          </span>
        </div>
        <div className="pageno">Inspección de Producto · pág. 1</div>
      </section>

      <section className="sheet">
        {sample && <div className="sample-band">Ejemplo</div>}
        <Head docType="Inspección de Producto" reportNo={report.report_no} date={date} />

        <h2 className="sec">
          <span className="sec-no">2</span> Desglose de defectos
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th>Descripción del defecto</th>
              <th className="num">Crítico</th>
              <th className="num">Mayor</th>
              <th className="num">Menor</th>
            </tr>
            {psi.defects.length === 0 ? (
              <tr>
                <td colSpan={4} className="val-empty">
                  Sin defectos registrados.
                </td>
              </tr>
            ) : (
              psi.defects.map((d, i) => (
                <tr key={i}>
                  <td>{d.desc}</td>
                  <td className="num">{d.critical}</td>
                  <td className="num">{d.major}</td>
                  <td className="num">{d.minor}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">3</span> Estado y embalaje
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th>Ordenado</th>
              <th>Disponible</th>
              <th>% terminado</th>
              <th>Cajas embaladas</th>
              <th>PCS / caja</th>
              <th>% embalado</th>
            </tr>
            <tr>
              <td className="num"><V v={psi.production.ordered} /></td>
              <td className="num"><V v={psi.production.available} /></td>
              <td className="num"><V v={psi.production.pctDone} /></td>
              <td className="num"><V v={psi.production.boxesPacked} /></td>
              <td className="num"><V v={psi.production.pcsPerBox} /></td>
              <td className="num"><V v={psi.production.pctPacked} /></td>
            </tr>
          </tbody>
        </table>
        <h3 className="sub">Medidas y peso</h3>
        <table className="dt">
          <tbody>
            <tr>
              <th>Caja máster (L×A×H cm)</th>
              <th>PB caja (kg)</th>
              <th>Color box (L×A×H cm)</th>
              <th>PB color box (g)</th>
              <th>Producto (L×A×H cm)</th>
              <th>Peso neto (g)</th>
            </tr>
            <tr>
              <td><V v={psi.measures.masterBox} /></td>
              <td className="num"><V v={psi.measures.grossKg} /></td>
              <td><V v={psi.measures.colorBox} /></td>
              <td className="num"><V v={psi.measures.colorBoxGrossG} /></td>
              <td><V v={psi.measures.product} /></td>
              <td className="num"><V v={psi.measures.netG} /></td>
            </tr>
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">4</span> Evidencia fotográfica
        </h2>
        <PhotoGallery photos={photos} sample={sample} cols={3} />

        {report.conclusion && (
          <div
            style={{
              marginTop: "var(--s-5)",
              font: "600 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Conclusión: {inspectionConclusionLabel(report.conclusion)}
          </div>
        )}

        <Footer />
        <div className="pageno">Inspección de Producto · pág. 2</div>
      </section>
    </>
  );
}

// ── Auditoría de Fábrica ────────────────────────────────────────
function FactorySheets({
  report,
  fac,
  date,
  redact,
  sample,
  photos,
}: {
  report: InspectionReport;
  fac: ReturnType<typeof ensureFactoryPayload>;
  date: string;
  redact: (v: string | number | null | undefined) => string | number | null | undefined;
  sample: boolean;
  photos: InspectionPhotoItem[];
}) {
  const score = fac.score ?? report.score;
  return (
    <>
      <section className="sheet">
        {sample && <div className="sample-band">Ejemplo</div>}
        {sample && (
          <div className="wm">
            <span>Ejemplo</span>
          </div>
        )}
        <Head docType="Inspección de Fábrica" reportNo={report.report_no} date={date} />

        <div className="eyebrow">Reporte de Auditoría de Fábrica</div>
        <h1 className="rp-title">{report.title}</h1>
        <p className="rp-title-sub">Auditoría de planta en sitio.</p>

        {typeof score === "number" && (
          <div className="score-hero">
            <ScoreGauge score={score} />
            <div>
              <div className="eyebrow">Puntaje de la auditoría</div>
              <div style={{ font: "600 12.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", marginTop: 6 }}>
                Resultado global sobre 100 puntos.
              </div>
            </div>
          </div>
        )}

        <h2 className="sec">
          <span className="sec-no">1</span> Perfil · validez legal
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th style={{ width: "33%" }}>Nombre proveedor</th>
              <td><V v={redact(fac.legal.supplierName)} /></td>
              <th style={{ width: "33%" }}>Nombre registrado</th>
              <td><V v={redact(fac.legal.registeredName)} /></td>
            </tr>
            <tr>
              <th>N.º licencia comercial</th>
              <td><V v={redact(fac.legal.licenseNo)} /></td>
              <th>Año establecimiento</th>
              <td><V v={fac.legal.estYear} /></td>
            </tr>
            <tr>
              <th>Representante legal</th>
              <td><V v={redact(fac.legal.legalRep)} /></td>
              <th>Capital registrado</th>
              <td><V v={fac.legal.regCapital} /></td>
            </tr>
            <tr>
              <th>Dirección registrada</th>
              <td colSpan={3}><V v={redact(fac.legal.address)} /></td>
            </tr>
            <tr>
              <th>Tipo de empresa</th>
              <td>{factoryCompanyTypeLabel(fac.legal.companyType)}</td>
              <th>¿Producto del cliente en alcance?</th>
              <td><YesNo v={fac.legal.clientProductInScope} /></td>
            </tr>
            <tr>
              <th>¿En lista de operación anormal?</th>
              <td colSpan={3}><YesNo v={fac.legal.abnormalList} /></td>
            </tr>
          </tbody>
        </table>

        <h3 className="sub">Resumen del edificio</h3>
        <table className="dt">
          <tbody>
            <tr>
              <th>Área total (m²)</th>
              <th>N.º edificios</th>
              <th>Oficinas (m²)</th>
              <th>Producción (m²)</th>
              <th>Almacén (m²)</th>
            </tr>
            <tr>
              <td className="num"><V v={fac.building.totalArea} /></td>
              <td className="num"><V v={fac.building.buildings} /></td>
              <td className="num"><V v={fac.building.offices} /></td>
              <td className="num"><V v={fac.building.production} /></td>
              <td className="num"><V v={fac.building.warehouse} /></td>
            </tr>
          </tbody>
        </table>

        <h3 className="sub">Información bancaria</h3>
        <table className="dt">
          <tbody>
            <tr>
              <th style={{ width: "25%" }}>Beneficiario</th>
              <td><V v={redact(fac.bank.beneficiary)} /></td>
              <th style={{ width: "18%" }}>Banco</th>
              <td><V v={redact(fac.bank.bank)} /></td>
            </tr>
            <tr>
              <th>N.º cuenta (USD)</th>
              <td><V v={redact(fac.bank.accountNo)} /></td>
              <th>¿Sello de empresa?</th>
              <td><YesNo v={fac.bank.companySeal} /></td>
            </tr>
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">2</span> Recursos humanos
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th>Departamento</th>
              <th className="num">Según fábrica</th>
              <th className="num">Hallazgo real</th>
            </tr>
            {fac.hr.map((h, i) => (
              <tr key={i}>
                <td>{h.dept}</td>
                <td className="num"><V v={h.perFactory} /></td>
                <td className="num"><V v={h.actual} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pageno">Inspección de Fábrica · pág. 1</div>
      </section>

      <section className="sheet">
        {sample && <div className="sample-band">Ejemplo</div>}
        <Head docType="Inspección de Fábrica" reportNo={report.report_no} date={date} />

        <h2 className="sec">
          <span className="sec-no">3</span> Producto y mercado
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th style={{ width: "33%" }}>Productos principales</th>
              <td colSpan={3}><V v={fac.product.mainProducts} /></td>
            </tr>
            <tr>
              <th>Producto de interés del cliente</th>
              <td><V v={redact(fac.product.clientProduct)} /></td>
              <th style={{ width: "20%" }}>Licencia exportación</th>
              <td><YesNo v={fac.product.exportLicense} /></td>
            </tr>
            <tr>
              <th>% exportación</th>
              <td className="num"><V v={fac.product.pctExport} /></td>
              <th>% OEM</th>
              <td className="num"><V v={fac.product.pctOem} /></td>
            </tr>
          </tbody>
        </table>
        <h3 className="sub">Facturación últimos 3 años (USD)</h3>
        <table className="dt">
          <tbody>
            <tr>
              <th>Año</th>
              <th className="num">Facturación</th>
              <th>Top mercados</th>
              <th className="num">% volumen</th>
            </tr>
            {fac.turnover.map((t, i) => (
              <tr key={i}>
                <td><V v={t.year} /></td>
                <td className="num"><V v={t.amount} /></td>
                <td><V v={t.topMarkets} /></td>
                <td className="num"><V v={t.pctVolume} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">4</span> Instalaciones y maquinaria
        </h2>
        <div className="chk" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 var(--s-6)", marginBottom: "var(--s-3)" }}>
          <FacItem on={fac.facilities.tidy} label="Línea ordenada" />
          <FacItem on={fac.facilities.lit} label="Bien iluminada" />
          <FacItem on={fac.facilities.ventilated} label="Ventilada" />
          <FacItem on={fac.facilities.power} label="Suministro eléctrico estable" />
        </div>
        <table className="dt">
          <tbody>
            <tr>
              <th>Máquina</th>
              <th className="num">Cant.</th>
              <th>Estado</th>
            </tr>
            {fac.machines.length === 0 ? (
              <tr>
                <td colSpan={3} className="val-empty">Sin maquinaria registrada.</td>
              </tr>
            ) : (
              fac.machines.map((m, i) => (
                <tr key={i}>
                  <td>{m.name}</td>
                  <td className="num"><V v={m.qty} /></td>
                  <td><V v={m.state} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">5</span> Requerimientos del cliente
        </h2>
        <table className="dt">
          <tbody>
            <tr>
              <th style={{ width: "50%" }}>Pregunta</th>
              <th>Respuesta / hallazgo</th>
            </tr>
            {fac.requirements.length === 0 ? (
              <tr>
                <td colSpan={2} className="val-empty">Sin requerimientos registrados.</td>
              </tr>
            ) : (
              fac.requirements.map((r, i) => (
                <tr key={i}>
                  <td>{r.question}</td>
                  <td><V v={r.answer} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h2 className="sec">
          <span className="sec-no">6</span> Evidencia fotográfica
        </h2>
        <PhotoGallery photos={photos} sample={sample} cols={4} />

        <Footer />
        <div className="pageno">Inspección de Fábrica · pág. 2</div>
      </section>
    </>
  );
}

function FacItem({ on, label }: { on: boolean | null; label: string }) {
  return (
    <div className="it">
      <span className={`box${on ? " on" : ""}`} />
      <span className="lab">{label}</span>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const r = 64;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className="gauge">
      <svg viewBox="0 0 150 150">
        <circle className="g-bg" cx="75" cy="75" r={r} strokeWidth="12" />
        <circle
          className="g-fg"
          cx="75"
          cy="75"
          r={r}
          strokeWidth="12"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="g-val">
        <div className="g-num">{Math.round(score)}</div>
        <div className="g-den">/ 100</div>
      </div>
    </div>
  );
}

function PhotoGallery({
  photos,
  sample,
  cols,
}: {
  photos: InspectionPhotoItem[];
  sample: boolean;
  cols: 3 | 4;
}) {
  if (sample || photos.length === 0) {
    return (
      <p style={{ font: "600 10px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        {sample
          ? "Las fotos se omiten en el modo ejemplo."
          : "Sin fotos adjuntas todavía."}
      </p>
    );
  }
  return (
    <div className={`gal g${cols}`}>
      {photos.map((p) => (
        <div className="shot" key={p.id}>
          <div className="img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url!} alt={p.caption ?? "Foto de inspección"} loading="lazy" />
          </div>
          {(p.category || p.caption) && (
            <div className="cap">
              <span className="lab">{p.category ?? ""}</span>
              <span>{p.caption ?? ""}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
