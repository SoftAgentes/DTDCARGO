"use client";

/**
 * FactoryBuilder — campos del payload de auditoría de fábrica (SDD-0066 Fase 3).
 * Refleja `Plantilla · Inspección de Fábrica.html`. Los `name` matchean
 * `parseFactoryPayload`. El `score` (campo `score`) va a la columna y al payload.
 * Se monta DENTRO del <form> del editor — sin <form> propio.
 */

import { useState } from "react";
import {
  ensureFactoryPayload,
  FACTORY_COMPANY_TYPE_OPTIONS,
  type InspectionReport,
  type FactoryMachine,
  type FactoryRequirement,
} from "@/lib/studio/inspecciones/types";
import { Field, TriSelect, Grid, SectionTitle } from "./builder-fields";

export function FactoryBuilder({ report }: { report: InspectionReport }) {
  const f = ensureFactoryPayload(report.payload);
  const [machines, setMachines] = useState<FactoryMachine[]>(
    f.machines.length > 0 ? f.machines : [{ name: "", qty: null, state: "" }],
  );
  const [reqs, setReqs] = useState<FactoryRequirement[]>(
    f.requirements.length > 0 ? f.requirements : [{ question: "", answer: "" }],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle>1 · Perfil · validez legal</SectionTitle>
      <Grid cols={2}>
        <Field label="Nombre proveedor" name="legal_supplierName" defaultValue={f.legal.supplierName} />
        <Field label="Nombre registrado (local)" name="legal_registeredName" defaultValue={f.legal.registeredName} />
        <Field label="N.º licencia comercial" name="legal_licenseNo" defaultValue={f.legal.licenseNo} />
        <Field label="Año establecimiento" name="legal_estYear" type="number" min={0} mono defaultValue={f.legal.estYear} placeholder="2012" />
        <Field label="Representante legal" name="legal_legalRep" defaultValue={f.legal.legalRep} />
        <Field label="Capital registrado" name="legal_regCapital" defaultValue={f.legal.regCapital} />
      </Grid>
      <Field label="Dirección registrada" name="legal_address" defaultValue={f.legal.address} />
      <Grid cols={3}>
        <div>
          <label className="studio-label" htmlFor="legal_companyType">
            Tipo de empresa
          </label>
          <select
            id="legal_companyType"
            name="legal_companyType"
            className="studio-input"
            defaultValue={f.legal.companyType ?? ""}
          >
            <option value="">Sin determinar</option>
            {FACTORY_COMPANY_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <TriSelect label="¿Producto del cliente en alcance?" name="legal_clientProductInScope" value={f.legal.clientProductInScope} />
        <TriSelect label="¿En lista de operación anormal?" name="legal_abnormalList" value={f.legal.abnormalList} />
      </Grid>

      <SectionTitle>Resumen del edificio (m²)</SectionTitle>
      <Grid cols={3}>
        <Field label="Área construida total" name="build_totalArea" type="number" min={0} step="0.1" mono defaultValue={f.building.totalArea} />
        <Field label="N.º edificios" name="build_buildings" type="number" min={0} mono defaultValue={f.building.buildings} />
        <Field label="Oficinas" name="build_offices" type="number" min={0} step="0.1" mono defaultValue={f.building.offices} />
        <Field label="Producción" name="build_production" type="number" min={0} step="0.1" mono defaultValue={f.building.production} />
        <Field label="Almacén" name="build_warehouse" type="number" min={0} step="0.1" mono defaultValue={f.building.warehouse} />
      </Grid>

      <SectionTitle>Información bancaria</SectionTitle>
      <Grid cols={2}>
        <Field label="Beneficiario" name="bank_beneficiary" defaultValue={f.bank.beneficiary} />
        <Field label="Banco" name="bank_bank" defaultValue={f.bank.bank} />
        <Field label="N.º cuenta (USD)" name="bank_accountNo" mono defaultValue={f.bank.accountNo} />
        <TriSelect label="¿Sello de empresa?" name="bank_companySeal" value={f.bank.companySeal} />
      </Grid>

      <SectionTitle>2 · Recursos humanos</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {f.hr.map((h, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input type="hidden" name={`hr_dept_${i}`} value={h.dept} readOnly />
            <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {h.dept}
            </div>
            <input name={`hr_perFactory_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={h.perFactory ?? ""} placeholder="Según fábrica" />
            <input name={`hr_actual_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={h.actual ?? ""} placeholder="Hallazgo real" />
          </div>
        ))}
      </div>

      <SectionTitle>3 · Producto y mercado</SectionTitle>
      <Field label="Productos principales" name="prod_mainProducts" defaultValue={f.product.mainProducts} />
      <Grid cols={2}>
        <Field label="Producto de interés del cliente" name="prod_clientProduct" defaultValue={f.product.clientProduct} />
        <TriSelect label="Licencia de exportación vigente" name="prod_exportLicense" value={f.product.exportLicense} />
        <Field label="% exportación" name="prod_pctExport" type="number" min={0} step="0.1" mono defaultValue={f.product.pctExport} />
        <Field label="% OEM" name="prod_pctOem" type="number" min={0} step="0.1" mono defaultValue={f.product.pctOem} />
      </Grid>

      <SectionTitle>Facturación últimos 3 años (USD)</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2].map((i) => {
          const t = f.turnover[i] ?? { year: null, amount: null, topMarkets: null, pctVolume: null };
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr 1.4fr 1fr",
                gap: 10,
              }}
            >
              <input name={`turn_year_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={t.year ?? ""} placeholder="Año" />
              <input name={`turn_amount_${i}`} className="studio-input" defaultValue={t.amount ?? ""} placeholder="Facturación" autoComplete="off" />
              <input name={`turn_topMarkets_${i}`} className="studio-input" defaultValue={t.topMarkets ?? ""} placeholder="Top mercados" autoComplete="off" />
              <input name={`turn_pctVolume_${i}`} type="number" min={0} step="0.1" className="studio-input studio-input-mono" defaultValue={t.pctVolume ?? ""} placeholder="% vol." />
            </div>
          );
        })}
      </div>

      <SectionTitle>4 · Instalaciones y maquinaria</SectionTitle>
      <Grid cols={4}>
        <TriSelect label="Línea ordenada" name="fac_tidy" value={f.facilities.tidy} />
        <TriSelect label="Bien iluminada" name="fac_lit" value={f.facilities.lit} />
        <TriSelect label="Ventilada" name="fac_ventilated" value={f.facilities.ventilated} />
        <TriSelect label="Energía estable" name="fac_power" value={f.facilities.power} />
      </Grid>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {machines.map((m, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 1.4fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input name={`mach_name_${i}`} className="studio-input" defaultValue={m.name} placeholder="Máquina" autoComplete="off" />
            <input name={`mach_qty_${i}`} type="number" min={0} className="studio-input studio-input-mono" defaultValue={m.qty ?? ""} placeholder="Cant." />
            <input name={`mach_state_${i}`} className="studio-input" defaultValue={m.state ?? ""} placeholder="Estado" autoComplete="off" />
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
              onClick={() => setMachines((rows) => rows.filter((_, j) => j !== i))}
              aria-label="Quitar máquina"
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => setMachines((rows) => [...rows, { name: "", qty: null, state: "" }])}
          >
            + Agregar máquina
          </button>
        </div>
      </div>

      <SectionTitle>5 · Requerimientos del cliente</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reqs.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input name={`req_question_${i}`} className="studio-input" defaultValue={r.question} placeholder="Pregunta" autoComplete="off" />
            <input name={`req_answer_${i}`} className="studio-input" defaultValue={r.answer ?? ""} placeholder="Respuesta / hallazgo" autoComplete="off" />
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              style={{ color: "var(--danger)" }}
              onClick={() => setReqs((rows) => rows.filter((_, j) => j !== i))}
              aria-label="Quitar requerimiento"
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => setReqs((rows) => [...rows, { question: "", answer: "" }])}
          >
            + Agregar requerimiento
          </button>
        </div>
      </div>

      <SectionTitle>6 · Puntaje final</SectionTitle>
      <div style={{ maxWidth: 240 }}>
        <Field label="Puntaje / 100" name="score" type="number" min={0} max={100} mono defaultValue={f.score ?? report.score} placeholder="85" />
      </div>
    </div>
  );
}
