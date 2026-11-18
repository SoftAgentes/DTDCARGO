"use client";

/**
 * Bandeja «N cambios para <persona>» (SDD-0635 §3.3).
 *
 * Junta lo que se eligió en el mapa sin guardarlo todavía: un solo motivo y un
 * vencimiento opcional para todos. Guardar es del panel (una llamada por
 * módulo, con el mismo motivo); aquí solo se arma y se valida lo escrito.
 * La etiqueta «No cambia el rol» dice el alcance antes de guardar.
 */

import { useState } from "react";
import { MOTIVO_AVISO_PII, NIVEL_LARGO, reasonError, type NivelExtra } from "@/lib/studio/user-module-grants";
import "./permisos.css";

export type CambioPendiente = {
  moduleId: string;
  label: string;
  nivel: NivelExtra;
  /** Ya tenía un extra vigente (entonces «none» = quitarlo). */
  teniaExtra: boolean;
};

export function CambiosPendientes({
  persona,
  rol,
  cambios,
  pending,
  error,
  onDeshacer,
  onDescartar,
  onGuardar,
}: {
  persona: string;
  rol: string;
  cambios: CambioPendiente[];
  pending: boolean;
  error?: string;
  onDeshacer: (moduleId: string) => void;
  onDescartar: () => void;
  onGuardar: (input: { reason: string; expiresOn: string | null }) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [vence, setVence] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  if (cambios.length === 0) return null;

  const n = cambios.length;
  const quita = cambios.some((c) => c.nivel === "none");
  const algunoTenia = cambios.some((c) => c.teniaExtra && c.nivel !== "none");

  function guardar() {
    const err = reasonError(motivo);
    if (err) {
      setErrorLocal(err);
      return;
    }
    setErrorLocal(null);
    onGuardar({ reason: motivo.trim(), expiresOn: vence || null });
  }

  const titulo = `${n} ${n === 1 ? "cambio" : "cambios"} para ${persona}`;
  return (
    <section className="perm-tray" aria-label={titulo}>
      <div className="perm-tray-title">
        <span>{titulo}</span>
        <small>No cambia el rol {rol}</small>
      </div>
      <ul>
        {cambios.map((c) => (
          <li key={c.moduleId}>
            <span>
              {c.nivel === "none" ? `Quitar extra · ${c.label}` : `+ ${c.label} · ${NIVEL_LARGO[c.nivel]}`}
            </span>
            <button type="button" className="perm-link" disabled={pending} aria-label={`Deshacer ${c.label}`} onClick={() => onDeshacer(c.moduleId)}>
              Deshacer
            </button>
          </li>
        ))}
      </ul>
      <div className="perm-form-row">
        <div>
          <label className="studio-label" htmlFor="perm-motivo">
            Motivo (obligatorio)
          </label>
          <input
            id="perm-motivo"
            className="studio-input"
            maxLength={500}
            placeholder={quita && cambios.every((c) => c.nivel === "none") ? "Ej: ya no cubre el CRM" : "Ej: cubre el CRM durante una ausencia"}
            aria-describedby="perm-motivo-aviso"
            aria-invalid={errorLocal ? true : undefined}
            value={motivo}
            disabled={pending}
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                guardar();
              }
            }}
          />
          <p id="perm-motivo-aviso" className="perm-motivo-aviso">
            {MOTIVO_AVISO_PII}
          </p>
        </div>
        <div>
          <label className="studio-label" htmlFor="perm-vence">
            Vence (opcional)
          </label>
          <input
            id="perm-vence"
            type="date"
            className="studio-input"
            value={vence}
            disabled={pending}
            aria-describedby={algunoTenia ? "perm-vence-nota" : undefined}
            onChange={(e) => setVence(e.target.value)}
          />
          {algunoTenia && (
            <p id="perm-vence-nota" className="perm-motivo-aviso">
              Vacío: los extras que ya tenían vencimiento lo conservan.
            </p>
          )}
        </div>
      </div>
      {(errorLocal || error) && (
        <p role="alert" className="perm-error">
          {errorLocal ?? error}
        </p>
      )}
      <div className="perm-tray-actions">
        <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={pending} onClick={onDescartar}>
          Descartar
        </button>
        <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" disabled={pending} aria-busy={pending} onClick={guardar}>
          {pending ? "Guardando…" : n === 1 ? "Guardar cambio" : `Guardar ${n} cambios`}
        </button>
      </div>
    </section>
  );
}
