"use client";

/**
 * Pestaña «Actividad» de la ficha (SDD-0622): quién dio o quitó cada acceso
 * extra, cuándo y con qué motivo. Sale de `entity_audit_log` (append-only), no
 * de la tabla de extras: lo quitado sigue apareciendo aquí.
 *
 * Los cambios de ROL viven en otra bitácora (`user_role_audit`); esta pestaña
 * no los mezcla todavía y lo dice.
 */

import { useEffect, useState } from "react";
import { listUserAccessActivityAction, type AccessActivityEvent } from "../../actions";
import { moduleLabel } from "./AccesoPanel";
import "./permisos.css";

const fecha = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Caracas",
});

const VERBO: Record<AccessActivityEvent["event"], string> = {
  created: "Se concedió",
  updated: "Se cambió",
  revoked: "Se quitó",
};

export function ActividadAcceso({
  userId,
  nombres,
  /** Cambia cuando cambian los extras: vuelve a leer. */
  version,
}: {
  userId: string;
  nombres: Record<string, string>;
  version: string;
}) {
  const [estado, setEstado] = useState<
    { kind: "cargando" } | { kind: "error"; msg: string } | { kind: "ok"; events: AccessActivityEvent[] }
  >({ kind: "cargando" });

  useEffect(() => {
    let cancelled = false;
    void listUserAccessActivityAction(userId).then((res) => {
      if (cancelled) return;
      setEstado("error" in res ? { kind: "error", msg: res.error } : { kind: "ok", events: res.events });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  if (estado.kind === "cargando") {
    return (
      <p role="status" className="perm-empty" style={{ paddingLeft: 0 }}>
        Cargando actividad…
      </p>
    );
  }
  if (estado.kind === "error") {
    return (
      <p role="alert" style={{ margin: 0, font: "600 12.5px/1.45 var(--f-sans)", color: "var(--danger)" }}>
        {estado.msg}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      {estado.events.length === 0 ? (
        <p className="perm-empty" style={{ paddingLeft: 0 }}>
          Todavía no hay cambios de accesos extra para esta persona.
        </p>
      ) : (
        <ul className="perm-activity" aria-label="Cambios de accesos extra">
          {estado.events.map((e) => (
            <li key={e.id}>
              <span className="perm-activity-dot" data-kind={e.event} aria-hidden />
              <div>
                <div className="perm-activity-title">
                  {VERBO[e.event]} {moduleLabel(e.moduleId)}
                  {e.event !== "revoked" && e.canEdit !== null ? (e.canEdit ? " · ver y editar" : " · solo ver") : ""}
                </div>
                <div className="perm-activity-meta">
                  {e.actorId ? (nombres[e.actorId] ?? "Un admin") : "Sistema"} · {fecha.format(new Date(e.occurredAt))}
                  {e.reason ? ` · «${e.reason}»` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: 0, font: "400 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
        Los cambios de rol y de almacén quedan en su propia auditoría.
      </p>
    </div>
  );
}
