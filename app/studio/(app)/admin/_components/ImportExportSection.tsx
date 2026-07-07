"use client";

/**
 * ImportExportSection — sección "Importar / Exportar" del admin (SDD-0130).
 *
 * V1: EXPORT real (CSV client-side, sin dependencias) de los catálogos que
 * viven en el dominio admin (feriados/ferias, oficinas, cuentas bancarias).
 * IMPORT (carga masiva) queda por implementar: requiere validación por entidad,
 * mapeo de columnas y dedup → spec dedicada.
 */

import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  calCountryLabel,
  calKindLabel,
  type CalendarEvent,
} from "@/lib/studio/op-calendar-types";
import {
  officeCountryLabel,
  bankCurrencyLabel,
  type CompanyBankAccount,
  type CompanyOffice,
} from "@/lib/studio/company-types";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function download(filename: string, csv: string) {
  // BOM para que Excel abra UTF-8 correctamente.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ImportExportSection({
  calendar,
  offices,
  bankAccounts,
}: {
  calendar: CalendarEvent[];
  offices: CompanyOffice[];
  bankAccounts: CompanyBankAccount[];
}) {
  const toast = useToast();

  const exports = [
    {
      title: "Feriados & ferias",
      count: calendar.length,
      run: () =>
        download(
          "feriados-ferias.csv",
          toCsv(
            ["pais", "tipo", "nombre", "inicio", "fin", "nota"],
            calendar.map((e) => [
              calCountryLabel(e.country),
              calKindLabel(e.kind),
              e.name,
              e.startDate,
              e.endDate ?? "",
              e.note,
            ]),
          ),
        ),
    },
    {
      title: "Oficinas",
      count: offices.length,
      run: () =>
        download(
          "oficinas.csv",
          toCsv(
            ["pais", "nombre", "direccion"],
            offices.map((o) => [officeCountryLabel(o.country), o.name, o.address]),
          ),
        ),
    },
    {
      title: "Cuentas bancarias",
      count: bankAccounts.length,
      run: () =>
        download(
          "cuentas-bancarias.csv",
          toCsv(
            ["banco", "tipo", "moneda", "numero"],
            bankAccounts.map((b: CompanyBankAccount) => [
              b.bankName,
              b.accountType,
              bankCurrencyLabel(b.currency),
              b.accountNumber,
            ]),
          ),
        ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Export */}
      <Card>
        <CardEyebrow>Exportar (CSV)</CardEyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exports.map((x) => (
            <div key={x.title} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 12, padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)", alignItems: "center" }}>
              <div style={{ font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{x.title}</div>
              <span style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>{x.count} filas</span>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                style={{ justifySelf: "end" }}
                disabled={x.count === 0}
                onClick={() => {
                  x.run();
                  toast.success(`${x.title} exportado`);
                }}
              >
                Descargar CSV
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Import por implementar */}
      <section style={{ background: "var(--bg-surface)", border: "2px dashed var(--border-strong)", borderRadius: "var(--r-lg)", padding: "20px 24px" }}>
        <div style={{ font: "700 10px/1 var(--f-sans)", color: "var(--wine)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>
          Importar (CSV / XLSX) · por implementar
        </div>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "64ch" }}>
          La carga masiva (clientes, tarifas, históricos) necesita validación por entidad, mapeo de columnas y control
          de duplicados — cada entidad con su propia lógica. Queda para una spec dedicada; el export ya funciona.
        </p>
      </section>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "22px 24px" }}>
      {children}
    </section>
  );
}
function CardEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 14 }}>{children}</div>;
}
