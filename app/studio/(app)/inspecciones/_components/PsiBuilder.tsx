"use client";

/**
 * PsiBuilder — campos del payload de inspección de producto / PSI (SDD-0066
 * Fase 2). Refleja `Plantilla · Inspección de Producto.html`. Los `name` de cada
 * input matchean `parsePsiPayload` (validators.ts). Se monta DENTRO del <form>
 * del editor — no tiene <form> propio.
 */

import { useState } from "react";
import {
  ensurePsiPayload,
  PSI_CATEGORY_LABELS,
  PSI_OVERALL_OPTIONS,
  type InspectionReport,
  type PsiDefect,
  type PsiCategoryKey,
} from "@/lib/studio/inspecciones/types";
import { Field, Grid, SectionTitle } from "./builder-fields";

export function PsiBuilder({ report }: { report: InspectionReport }) {
  const p = ensurePsiPayload(report.payload);
  const [defects, setDefects] = useState<PsiDefect[]>(
    p.defects.length > 0 ? p.defects : [{ desc: "", critical: 0, major: 0, minor: 0 }],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>1 · Información de la orden</SectionTitle>
      <Grid cols={2}>
        <Field label="P/O #" name="order_po" defaultValue={p.order.po} />
        <Field label="Ítem #" name="order_itemNo" defaultValue={p.order.itemNo} />
        <Field label="Cantidad orden" name="order_orderQty" type="number" min={0} mono defaultValue={p.order.orderQty} />
        <Field label="Destino" name="order_destination" defaultValue={p.order.destination} />
        <Field label="Shipping Mark" name="order_shippingMark" defaultValue={p.order.shippingMark} />
        <Field label="Llegada a fábrica" name="order_arrival" defaultValue={p.order.arrival} placeholder="2026-06-20" />
        <Field label="Salida de fábrica" name="order_departure" defaultValue={p.order.departure} placeholder="2026-06-22" />
      </Grid>

      <SectionTitle>AQL · Nivel de calidad aceptable</SectionTitle>
      <Grid cols={2}>
        <Field label="Norma" name="aql_standard" defaultValue={p.aql.standard} />
        <Field label="Nivel" name="aql_level" defaultValue={p.aql.level} />
        <Field label="Tamaño de muestra" name="aql_sampleSize" type="number" min={0} mono defaultValue={p.aql.sampleSize} />
      </Grid>
      <Grid cols={3}>
        <Field label="Encontrados · Crítico" name="aql_found_critical" type="number" min={0} mono defaultValue={p.aql.found.critical} />
        <Field label="Encontrados · Mayor" name="aql_found_major" type="number" min={0} mono defaultValue={p.aql.found.major} />
        <Field label="Encontrados · Menor" name="aql_found_minor" type="number" min={0} mono defaultValue={p.aql.found.minor} />
        <Field label="Máx. permitido · Crítico" name="aql_max_critical" type="number" min={0} step="0.1" mono defaultValue={p.aql.maxAllowed.critical} />
        <Field label="Máx. permitido · Mayor" name="aql_max_major" type="number" min={0} step="0.1" mono defaultValue={p.aql.maxAllowed.major} />
        <Field label="Máx. permitido · Menor" name="aql_max_minor" type="number" min={0} step="0.1" mono defaultValue={p.aql.maxAllowed.minor} />
      </Grid>

      <SectionTitle>Categorías</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {p.categories.map((c) => {
          const key = c.key as PsiCategoryKey;
          return (
            <div
              key={c.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 2fr",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div
                style={{
                  font: "600 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  paddingBottom: 9,
                }}
              >
                {PSI_CATEGORY_LABELS[key] ?? c.key}
              </div>
              <div>
                <label className="studio-label" htmlFor={`cat_conform_${c.key}`}>
                  Conforme
                </label>
                <select
                  id={`cat_conform_${c.key}`}
                  name={`cat_conform_${c.key}`}
                  className="studio-input"
                  defaultValue={c.conform === true ? "true" : c.conform === false ? "false" : ""}
                >
                  <option value="">—</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
              <Field
                label="Comentario"
                name={`cat_comment_${c.key}`}
                defaultValue={c.comment}
              />
            </div>
          );
        })}
      </div>

      <SectionTitle>2 · Desglose de defectos</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {defects.map((d, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2.6fr 0.8fr 0.8fr 0.8fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              name={`def_desc_${i}`}
              className="studio-input"
              defaultValue={d.desc}
              placeholder="Descripción del defecto"
              autoComplete="off"
            />
            <input name={`def_critical_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={d.critical} placeholder="Crít." />
            <input name={`def_major_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={d.major} placeholder="May." />
            <input name={`def_minor_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={d.minor} placeholder="Men." />
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
              onClick={() => setDefects((rows) => rows.filter((_, j) => j !== i))}
              aria-label="Quitar defecto"
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() =>
              setDefects((rows) => [...rows, { desc: "", critical: 0, major: 0, minor: 0 }])
            }
          >
            + Agregar defecto
          </button>
        </div>
      </div>

      <SectionTitle>3 · Estado y embalaje</SectionTitle>
      <Grid cols={3}>
        <Field label="Ordenado" name="prod_ordered" type="number" min={0} mono defaultValue={p.production.ordered} />
        <Field label="Disponible" name="prod_available" type="number" min={0} mono defaultValue={p.production.available} />
        <Field label="% terminado" name="prod_pctDone" type="number" min={0} step="0.1" mono defaultValue={p.production.pctDone} />
        <Field label="Cajas embaladas" name="prod_boxesPacked" type="number" min={0} mono defaultValue={p.production.boxesPacked} />
        <Field label="PCS / caja" name="prod_pcsPerBox" type="number" min={0} mono defaultValue={p.production.pcsPerBox} />
        <Field label="% embalado" name="prod_pctPacked" type="number" min={0} step="0.1" mono defaultValue={p.production.pctPacked} />
      </Grid>

      <SectionTitle>Medidas y peso</SectionTitle>
      <Grid cols={3}>
        <Field label="Caja máster (L×A×H cm)" name="meas_masterBox" defaultValue={p.measures.masterBox} placeholder="60×40×30" />
        <Field label="PB caja (kg)" name="meas_grossKg" type="number" min={0} step="0.01" mono defaultValue={p.measures.grossKg} />
        <Field label="Color box (L×A×H cm)" name="meas_colorBox" defaultValue={p.measures.colorBox} />
        <Field label="PB color box (g)" name="meas_colorBoxGrossG" type="number" min={0} step="0.1" mono defaultValue={p.measures.colorBoxGrossG} />
        <Field label="Producto (L×A×H cm)" name="meas_product" defaultValue={p.measures.product} />
        <Field label="Peso neto (g)" name="meas_netG" type="number" min={0} step="0.1" mono defaultValue={p.measures.netG} />
      </Grid>

      <SectionTitle>Resultado general</SectionTitle>
      <div style={{ maxWidth: 280 }}>
        <label className="studio-label" htmlFor="overall">
          Resultado
        </label>
        <select id="overall" name="overall" className="studio-input" defaultValue={p.overall}>
          {PSI_OVERALL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
