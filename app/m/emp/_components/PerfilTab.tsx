"use client";

/**
 * PerfilTab · ficha del empleado con GATE de edición (SDD-0113 Slice C).
 * Read-only: nombre, cédula, cargo, departamento, sueldo, estado, ingreso.
 * Editable: teléfono, correo, datos bancarios. El cambio bancario queda PENDIENTE
 * de verificación del admin (no entra directo). Defensa en 3 capas: (1) la UI no
 * muestra inputs para los campos no editables; (2) updateMyProfileAction descarta
 * lo demás; (3) las RPCs de la DB solo tocan columnas seguras.
 */

import { useActionState } from "react";
import type { MyEmployee, MyBankChange } from "@/lib/studio/nomina/employee-self-queries";
import { updateMyProfileAction, type EmpActionState } from "../actions";

const INITIAL: EmpActionState = {};

export function PerfilTab({ me, pendingBank }: { me: MyEmployee; pendingBank: MyBankChange | null }) {
  const [state, action, pending] = useActionState(updateMyProfileAction, INITIAL);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Datos que define la empresa — SOLO LECTURA (sin inputs) */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "14px 14px",
        }}
      >
        <h2 style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 8px" }}>
          Datos de la empresa
        </h2>
        <ReadRow label="Nombre" value={me.full_name} />
        <ReadRow label="Cédula" value={me.national_id ?? "—"} />
        <ReadRow label="Cargo" value={me.position_label ?? "—"} />
        <ReadRow label="Departamento" value={me.department ?? "—"} />
        <ReadRow label="Sueldo (USD)" value={me.salary_usd != null ? `$${Number(me.salary_usd).toFixed(2)}` : "—"} />
        <ReadRow label="Fecha de ingreso" value={me.hire_date ?? "—"} />
        <p style={{ font: "400 10.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 8 }}>
          Para corregir estos datos, contacta a Recursos Humanos.
        </p>
      </section>

      {/* Datos editables por el empleado */}
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 14px",
          }}
        >
          <h2 style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 10px" }}>
            Mis datos de contacto
          </h2>
          <EditField label="Teléfono" name="phone" defaultValue={me.phone} type="tel" error={state.fieldErrors?.phone} />
          <EditField label="Correo" name="email" defaultValue={me.email} type="email" error={state.fieldErrors?.email} />
        </section>

        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "14px 14px",
            marginTop: 14,
          }}
        >
          <h2 style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 4px" }}>
            Datos bancarios
          </h2>
          <p style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: "0 0 10px" }}>
            Un cambio de cuenta queda pendiente de verificación del administrador antes de usarse en el pago.
          </p>

          {pendingBank && (
            <div
              style={{
                background: "var(--warning-soft, var(--bg-base))",
                border: "1px solid var(--warning)",
                borderRadius: "var(--r-md, 10px)",
                padding: "9px 11px",
                marginBottom: 10,
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              Tienes un cambio bancario pendiente de verificación ({pendingBank.bank_name ?? "—"} ·{" "}
              {pendingBank.bank_account ?? "—"}).
            </div>
          )}

          <EditField label="Banco" name="bank_name" defaultValue={me.bank_name} error={state.fieldErrors?.bank_name} />
          <label style={{ display: "block", marginBottom: 12 }}>
            <span className="studio-label" style={{ display: "block", marginBottom: 4 }}>Tipo de cuenta</span>
            <select className="studio-input" name="bank_account_type" defaultValue={me.bank_account_type ?? ""} style={{ width: "100%" }}>
              <option value="">—</option>
              <option value="corriente">Corriente</option>
              <option value="ahorro">Ahorro</option>
            </select>
          </label>
          <EditField label="Número de cuenta" name="bank_account" defaultValue={me.bank_account} error={state.fieldErrors?.bank_account} />
        </section>

        {state.error && (
          <p style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--danger)", marginTop: 10 }}>{state.error}</p>
        )}
        {state.ok && (
          <p style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--success)", marginTop: 10 }}>
            {state.bankPending
              ? "Contacto guardado. El cambio bancario quedó pendiente de verificación."
              : "Cambios guardados."}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: 14,
            background: "var(--ink)",
            color: "var(--ink-inv)",
            border: "none",
            borderRadius: "var(--r-md, 10px)",
            padding: "12px 16px",
            font: "700 14px/1 var(--f-sans)",
            cursor: "pointer",
          }}
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", gap: 12 }}>
      <span style={{ font: "400 12.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>{label}</span>
      <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  error?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span className="studio-label" style={{ display: "block", marginBottom: 4 }}>{label}</span>
      <input
        className="studio-input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        style={{ width: "100%" }}
      />
      {error && <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--danger)" }}>{error}</span>}
    </label>
  );
}
